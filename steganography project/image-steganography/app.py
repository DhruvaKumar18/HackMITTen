"""Local Flask interface for image-to-image steganography."""

from __future__ import annotations

import base64
from io import BytesIO
from pathlib import Path

from flask import Flask, jsonify, render_template, request
from PIL import Image, UnidentifiedImageError

from encryption import EncryptionError, decrypt_image_bytes, encrypt_image_bytes
from steganography import (
    SteganographyError,
    capacity_bytes,
    embed_payload,
    extract_payload,
    resize_cover,
)

BASE_DIR = Path(__file__).resolve().parent
app = Flask(__name__, template_folder=BASE_DIR / "templates", static_folder=BASE_DIR / "static")
app.config["MAX_CONTENT_LENGTH"] = 100 * 1024 * 1024


@app.get("/")
def index():
    return render_template("index.html")


@app.post("/api/encrypt")
def encrypt():
    private_file = request.files.get("private_image")
    cover_file = request.files.get("cover_image")
    if private_file is None or cover_file is None:
        return _error("Upload both a private image and a public cover image.")

    private_bytes = private_file.read()
    cover_bytes = cover_file.read()
    if not private_bytes or not cover_bytes:
        return _error("Both image files must contain data.")

    try:
        private_image = _validate_image(private_bytes, "The private file")
        _validate_image(cover_bytes, "The cover file")
        resized_cover_bytes = resize_cover(
            cover_bytes, private_image.width, private_image.height
        )
        cover_image = _validate_image(resized_cover_bytes, "The resized cover")
        payload, _ = encrypt_image_bytes(private_bytes)
        encoded_bytes = embed_payload(resized_cover_bytes, payload)
    except (EncryptionError, SteganographyError, UnidentifiedImageError, OSError) as error:
        return _error(str(error))

    encoded_image = Image.open(BytesIO(encoded_bytes))
    return jsonify(
        {
            "encoded_image": _data_url(encoded_bytes),
            "encoded_filename": "encoded-public-image.png",
            "private": {
                "filename": private_file.filename,
                "size": len(private_bytes),
                "dimensions": [private_image.width, private_image.height],
            },
            "cover": {
                **_image_metadata(cover_image, resized_cover_bytes),
                "resized": True,
            },
            "capacity": capacity_bytes(resized_cover_bytes),
            "payload_size": len(payload),
            "encoded_dimensions": [encoded_image.width, encoded_image.height],
        }
    )


@app.post("/api/decrypt")
def decrypt():
    encoded_file = request.files.get("encoded_image")
    if encoded_file is None:
        return _error("Upload an encoded PNG.")

    encoded_bytes = encoded_file.read()
    try:
        payload = extract_payload(encoded_bytes)
        recovered_bytes = decrypt_image_bytes(payload)
        recovered_image = _validate_image(recovered_bytes, "The recovered payload")
    except (EncryptionError, SteganographyError, UnidentifiedImageError, OSError) as error:
        return _error(str(error))

    return jsonify(
        {
            "recovered_image": _data_url(recovered_bytes, recovered_image.format),
            "filename": "recovered-" + (encoded_file.filename or "image").rsplit(".", 1)[0],
            "size": len(recovered_bytes),
            "dimensions": [recovered_image.width, recovered_image.height],
        }
    )


def _validate_image(image_bytes: bytes, label: str) -> Image.Image:
    try:
        image = Image.open(BytesIO(image_bytes))
        image.load()
        return image
    except (UnidentifiedImageError, OSError) as error:
        raise SteganographyError(f"{label} is not a valid image.") from error


def _image_metadata(image: Image.Image, image_bytes: bytes) -> dict[str, object]:
    return {"dimensions": [image.width, image.height], "size": len(image_bytes)}


def _data_url(image_bytes: bytes, image_format: str = "PNG") -> str:
    encoded = base64.b64encode(image_bytes).decode("ascii")
    mime_type = {"JPEG": "jpeg", "WEBP": "webp"}.get(image_format.upper(), "png")
    return f"data:image/{mime_type};base64,{encoded}"


def _error(message: str):
    return jsonify({"error": message}), 400


if __name__ == "__main__":
    app.run(debug=False)
