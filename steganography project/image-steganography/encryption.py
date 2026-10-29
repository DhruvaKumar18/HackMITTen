"""AES-256-GCM helpers for private image bytes."""

from __future__ import annotations

import base64
import binascii
import secrets
import zlib

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

KEY_SIZE = 32
NONCE_SIZE = 12
PAYLOAD_MAGIC = b"IMGSTEG3"
LEGACY_PAYLOAD_MAGIC = b"IMGSTEG2"
COMPRESSION_LEVEL = 6


class EncryptionError(ValueError):
    """Raised when an encryption key or payload is invalid."""


def generate_key() -> bytes:
    return secrets.token_bytes(KEY_SIZE)


def encode_key(key: bytes) -> str:
    if len(key) != KEY_SIZE:
        raise EncryptionError("The key must be exactly 32 bytes.")
    return base64.urlsafe_b64encode(key).decode("ascii")


def decode_key(value: str) -> bytes:
    try:
        key = base64.urlsafe_b64decode(value.encode("ascii"))
    except (UnicodeEncodeError, binascii.Error, ValueError) as error:
        raise EncryptionError("The encryption key is not valid base64.") from error
    if len(key) != KEY_SIZE:
        raise EncryptionError("The encryption key must decode to 32 bytes.")
    return key


def encrypt_image_bytes(image_bytes: bytes) -> tuple[bytes, str]:
    key = generate_key()
    nonce = secrets.token_bytes(NONCE_SIZE)
    compressed_bytes = zlib.compress(image_bytes, level=COMPRESSION_LEVEL)
    ciphertext = AESGCM(key).encrypt(nonce, compressed_bytes, PAYLOAD_MAGIC)
    payload = PAYLOAD_MAGIC + key + nonce + ciphertext
    return payload, encode_key(key)


def decrypt_image_bytes(payload: bytes, encoded_key: str | None = None) -> bytes:
    minimum_size = len(PAYLOAD_MAGIC) + KEY_SIZE + NONCE_SIZE + 16
    if len(payload) < minimum_size:
        raise EncryptionError("The embedded payload is incomplete.")
    magic = payload[: len(PAYLOAD_MAGIC)]
    if magic not in (PAYLOAD_MAGIC, LEGACY_PAYLOAD_MAGIC):
        raise EncryptionError("The embedded payload format is invalid.")

    key_start = len(PAYLOAD_MAGIC)
    if magic == LEGACY_PAYLOAD_MAGIC:
        if encoded_key is None:
            raise EncryptionError(
                "This older encoded image requires its original encryption key."
            )
        key = decode_key(encoded_key.strip())
        nonce_start = key_start
    else:
        embedded_key = payload[key_start : key_start + KEY_SIZE]
        key = decode_key(encoded_key.strip()) if encoded_key else embedded_key
        nonce_start = key_start + KEY_SIZE
    nonce = payload[nonce_start : nonce_start + NONCE_SIZE]
    ciphertext = payload[nonce_start + NONCE_SIZE :]
    try:
        compressed_bytes = AESGCM(key).decrypt(nonce, ciphertext, PAYLOAD_MAGIC)
        try:
            return zlib.decompress(compressed_bytes)
        except zlib.error as error:
            raise EncryptionError("The decrypted image payload is corrupted.") from error
    except InvalidTag as error:
        raise EncryptionError("The key is incorrect or the payload is corrupted.") from error
