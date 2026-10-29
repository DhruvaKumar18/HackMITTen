# Image-to-Image Steganography

A standalone local Flask application that encrypts a private image with AES-256-GCM and hides the encrypted bytes in the RGB least-significant bits of a public cover image. Encoded files are always lossless PNG files.

This prototype uses automatic decryption: the AES key is embedded in the encoded payload. Anyone who obtains an encoded PNG can therefore decrypt it; this mode is convenient for messaging but does not provide secrecy from recipients or other holders of the file.

## Requirements

- Python 3.12
- Pillow
- Flask
- cryptography

## Run locally

From this directory:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

Open `http://127.0.0.1:5000`.

The application does not store uploads, keys, or generated files on the server. Decryption reads the embedded key automatically.

## How it works

1. The private image is read as its original bytes. It is not resized or recompressed.
2. The public cover is resized to the private image's pixel dimensions before embedding.
3. The private bytes are losslessly compressed at a balanced level before encryption; decompression restores the exact original bytes without the extra CPU cost of maximum compression.
4. AES-256-GCM uses a fresh random 32-byte key and 12-byte nonce for every encryption.
5. A magic value, key, nonce, and authenticated ciphertext are packed into a payload.
6. The embedder uses 1 to 4 RGB LSBs per channel as needed, preserving cover dimensions.
7. The result is saved as PNG so the embedded bits survive file transfer.
8. Decryption authenticates, decompresses, and returns the original private bytes exactly.

Capacity is up to `(width × height × 3 × 4) / 8 - 5` bytes. The application starts with one LSB per channel and uses up to four only when required. A clear error is returned before embedding when the cover is still too small. The alpha channel is preserved and is not used for payload bits.

The embedder works directly on the image byte buffer instead of creating full
pixel and bit lists. This keeps memory usage lower and makes larger images
faster to encode and decode while preserving the same payload format.

## Validation and limitations

- Private PNG, JPEG, and WebP files are accepted.
- Encoded files must be PNG.
- Wrong keys, changed payload bits, malformed files, and truncated payloads are rejected.
- The cover image is resized to the private image dimensions and converted to RGB/RGBA when necessary; its visible image remains visually close, but LSB embedding changes at most one value per RGB channel.
- This local prototype keeps the key in the browser response only; it is never hardcoded.
