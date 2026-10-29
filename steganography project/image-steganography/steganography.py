"""Lossless LSB payload embedding for PNG images."""

from __future__ import annotations

from io import BytesIO
import struct

from PIL import Image, UnidentifiedImageError

HEADER_SIZE = 4
MAX_PAYLOAD_SIZE = (2**32) - 1
MIN_BITS_PER_CHANNEL = 1
MAX_BITS_PER_CHANNEL = 4


class SteganographyError(ValueError):
    """Raised when an image cannot carry or yield a payload."""


def _open_image(image_bytes: bytes) -> Image.Image:
    try:
        image = Image.open(BytesIO(image_bytes))
        image.load()
        return image
    except (UnidentifiedImageError, OSError) as error:
        raise SteganographyError("The cover file is not a valid image.") from error


def _prepare_cover(image: Image.Image) -> Image.Image:
    if image.mode in ("RGB", "RGBA"):
        return image.copy()
    return image.convert("RGBA" if "transparency" in image.info else "RGB")


def capacity_bytes(cover_bytes: bytes) -> int:
    image = _prepare_cover(_open_image(cover_bytes))
    return max(
        _capacity_for_bits(image, bits)
        for bits in range(MIN_BITS_PER_CHANNEL, MAX_BITS_PER_CHANNEL + 1)
    )


def resize_cover(cover_bytes: bytes, width: int, height: int) -> bytes:
    """Resize only the public cover and return it as a lossless PNG."""
    image = _prepare_cover(_open_image(cover_bytes))
    resized = image.resize((width, height), Image.Resampling.LANCZOS)
    output = BytesIO()
    resized.save(output, format="PNG")
    return output.getvalue()


def embed_payload(cover_bytes: bytes, payload: bytes) -> bytes:
    if len(payload) > MAX_PAYLOAD_SIZE:
        raise SteganographyError("The payload is too large.")

    image = _prepare_cover(_open_image(cover_bytes))
    bits_per_channel = _bits_needed(image, len(payload))
    if bits_per_channel is None:
        capacity = _capacity_for_bits(image, MAX_BITS_PER_CHANNEL)
        raise SteganographyError(
            f"Cover image capacity is {capacity:,} bytes, but the encrypted "
            f"private image needs {len(payload):,} bytes."
        )

    header = struct.pack(">I", len(payload)) + payload
    pixel_data = bytearray(image.tobytes())
    channel_count = len(image.getbands())
    bit_index = 0
    total_bits = len(header) * 8
    for pixel_index in range(image.width * image.height):
        pixel_offset = pixel_index * channel_count
        for channel in range(3):
            channel_index = pixel_index * 3 + channel
            data_index = pixel_offset + channel
            if channel_index < 8:
                marker_bit = (bits_per_channel >> (7 - channel_index)) & 1
                pixel_data[data_index] = (pixel_data[data_index] & 0xFE) | marker_bit
            else:
                for bit in range(bits_per_channel):
                    if bit_index >= total_bits:
                        break
                    byte_index, bit_offset = divmod(bit_index, 8)
                    header_bit = (header[byte_index] >> (7 - bit_offset)) & 1
                    pixel_data[data_index] = (
                        pixel_data[data_index] & ~(1 << bit)
                    ) | (header_bit << bit)
                    bit_index += 1

    image.frombytes(bytes(pixel_data))
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def extract_payload(encoded_bytes: bytes) -> bytes:
    image = _open_image(encoded_bytes)
    if image.format != "PNG":
        raise SteganographyError("Encoded images must be PNG files.")
    image = _prepare_cover(image)
    if image.width * image.height * 3 < 8:
        raise SteganographyError("The encoded image does not contain a payload.")
    raw = image.tobytes()
    channel_count = len(image.getbands())
    marker = bytearray()
    for channel_index in range(8):
        pixel_index, channel = divmod(channel_index, 3)
        marker.append((raw[pixel_index * channel_count + channel] & 1))
    bits_per_channel = _bits_to_bytes(marker)[0]
    if not MIN_BITS_PER_CHANNEL <= bits_per_channel <= MAX_BITS_PER_CHANNEL:
        return _extract_legacy_payload(image)
    header = _read_lsb_bytes(image, bits_per_channel, 8, HEADER_SIZE)
    payload_size = struct.unpack(">I", header)[0]
    available = _capacity_for_bits(image, bits_per_channel)
    if payload_size > available:
        return _extract_legacy_payload(image)
    header_channels = (32 + bits_per_channel - 1) // bits_per_channel
    return _read_lsb_bytes(
        image, bits_per_channel, 8 + header_channels, payload_size
    )


def _extract_legacy_payload(image: Image.Image) -> bytes:
    """Read the original one-LSB format for previously generated PNGs."""
    header = _read_lsb_bytes(image, 1, 0, HEADER_SIZE)
    if len(header) < HEADER_SIZE:
        raise SteganographyError("The encoded image does not contain a payload.")
    payload_size = struct.unpack(">I", header)[0]
    available = image.width * image.height * 3 // 8 - HEADER_SIZE
    if payload_size > available:
        raise SteganographyError("The encoded payload is truncated or corrupted.")
    return _read_lsb_bytes(image, 1, HEADER_SIZE * 8, payload_size)


def _capacity_for_bits(image: Image.Image, bits_per_channel: int) -> int:
    data_channels = max(0, image.width * image.height * 3 - 8)
    header_channels = (HEADER_SIZE * 8 + bits_per_channel - 1) // bits_per_channel
    return max(0, ((data_channels - header_channels) * bits_per_channel) // 8)


def _bits_needed(image: Image.Image, payload_size: int) -> int | None:
    for bits_per_channel in range(MIN_BITS_PER_CHANNEL, MAX_BITS_PER_CHANNEL + 1):
        if payload_size <= _capacity_for_bits(image, bits_per_channel):
            return bits_per_channel
    return None


def _read_lsb_bytes(
    image: Image.Image, bits_per_channel: int, skip_channels: int, count: int
) -> bytes:
    result = bytearray(count)
    bit_count = count * 8
    channel_index = 0
    channel_count = len(image.getbands())
    raw = image.tobytes()
    for pixel_index in range(image.width * image.height):
        pixel_offset = pixel_index * channel_count
        for channel in range(3):
            if channel_index < skip_channels:
                channel_index += 1
                continue
            for bit in range(bits_per_channel):
                bit_index = channel_index * bits_per_channel + bit - skip_channels * bits_per_channel
                if bit_index >= bit_count:
                    return bytes(result)
                result[bit_index // 8] |= (
                    (raw[pixel_offset + channel] >> bit) & 1
                ) << (7 - bit_index % 8)
            channel_index += 1
    return bytes(result)


def _bits_to_bytes(bits: list[int]) -> bytes:
    return bytes(
        sum(bit << (7 - offset) for offset, bit in enumerate(bits[index : index + 8]))
        for index in range(0, len(bits), 8)
    )
