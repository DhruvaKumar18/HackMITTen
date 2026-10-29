const canvas = document.querySelector("canvas");
const targetInput = document.querySelector("#target");
const encryptionInput = document.querySelector("#encryption");
const saveButton = document.querySelector("button");
const status = document.querySelector("#status");

let targetImage;
let encryptionImage;

targetInput.addEventListener("change", () => loadSelectedImage(targetInput, "target"));
encryptionInput.addEventListener("change", () =>
  loadSelectedImage(encryptionInput, "encryption")
);
saveButton.addEventListener("click", save);

function loadSelectedImage(input, imageType) {
  const file = input.files[0];
  if (!file) {
    return;
  }

  const image = new Image();
  image.onload = () => {
    if (imageType === "target") {
      targetImage = image;
    } else {
      encryptionImage = image;
    }
    updateStatus();
  };
  image.onerror = () => {
    setStatus("The selected file is not a readable image.");
    saveButton.disabled = true;
  };
  image.src = URL.createObjectURL(file);
}

function updateStatus() {
  if (!targetImage) {
    setStatus("Select both images.");
    saveButton.disabled = true;
    return;
  }

  if (!encryptionImage) {
    setStatus("Select both images.");
    saveButton.disabled = true;
    return;
  }

  canvas.width = targetImage.naturalWidth;
  canvas.height = targetImage.naturalHeight;
  const encryptionWasResized =
    targetImage.naturalWidth !== encryptionImage.naturalWidth ||
    targetImage.naturalHeight !== encryptionImage.naturalHeight;
  setStatus(
    encryptionWasResized
      ? `Ready: encryption image will be resized to ${canvas.width} × ${canvas.height}.`
      : `Ready: ${canvas.width} × ${canvas.height} pixels.`
  );
  saveButton.disabled = false;
}

function save() {
  if (!targetImage || !encryptionImage) {
    return;
  }

  const width = targetImage.naturalWidth;
  const height = targetImage.naturalHeight;
  const targetPixels = getPixels(targetImage, width, height);
  const encryptionPixels = getPixels(encryptionImage, width, height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const output = context.createImageData(width, height);

  for (let i = 0; i < output.data.length; i += 4) {
    output.data[i] = (encryptionPixels[i] & 0xf0) | (targetPixels[i] >> 4);
    output.data[i + 1] =
      (encryptionPixels[i + 1] & 0xf0) | (targetPixels[i + 1] >> 4);
    output.data[i + 2] =
      (encryptionPixels[i + 2] & 0xf0) | (targetPixels[i + 2] >> 4);
    output.data[i + 3] = encryptionPixels[i + 3];
  }

  context.putImageData(output, 0, 0);
  downloadCanvas("encrypted-image.png");
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

function downloadCanvas(filename) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function setStatus(message) {
  status.textContent = message;
}
