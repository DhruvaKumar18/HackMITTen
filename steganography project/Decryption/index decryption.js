const canvas = document.querySelector("canvas");
const targetInput = document.querySelector("#target");
const saveButton = document.querySelector("button");
const status = document.querySelector("#status");

let encryptedImage;

targetInput.addEventListener("change", () => {
  const file = targetInput.files[0];
  if (!file) {
    encryptedImage = undefined;
    saveButton.disabled = true;
    return;
  }

  encryptedImage = new Image();
  encryptedImage.onload = () => {
    canvas.width = encryptedImage.naturalWidth;
    canvas.height = encryptedImage.naturalHeight;
    saveButton.disabled = false;
    setStatus(`Ready: ${canvas.width} × ${canvas.height} pixels.`);
    URL.revokeObjectURL(encryptedImage.src);
  };
  encryptedImage.onerror = () => {
    setStatus("The selected file is not a readable image.");
    saveButton.disabled = true;
  };
  encryptedImage.src = URL.createObjectURL(file);
});

saveButton.addEventListener("click", save);

function save() {
  if (!encryptedImage) {
    return;
  }

  try {
    const width = encryptedImage.naturalWidth;
    const height = encryptedImage.naturalHeight;
    const pixels = getPixels(encryptedImage, width, height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const output = context.createImageData(width, height);

    for (let i = 0; i < output.data.length; i += 4) {
      output.data[i] = expandNibble(pixels[i]);
      output.data[i + 1] = expandNibble(pixels[i + 1]);
      output.data[i + 2] = expandNibble(pixels[i + 2]);
      output.data[i + 3] = 255;
    }

    context.putImageData(output, 0, 0);
    downloadCanvas("decrypted-image.png");
    setStatus("Image decrypted successfully. Download started.");
  } catch (error) {
    setStatus("The image could not be decrypted in this browser.");
    saveButton.disabled = true;
  }
}

function getPixels(image, width, height) {
  const context = document.createElement("canvas").getContext("2d", {
    willReadFrequently: true,
  });
  context.canvas.width = width;
  context.canvas.height = height;
  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, width, height).data;
}

function expandNibble(value) {
  const nibble = value & 0x0f;
  return (nibble << 4) | nibble;
}

function downloadCanvas(filename) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function setStatus(message) {
  status.textContent = message;
}
