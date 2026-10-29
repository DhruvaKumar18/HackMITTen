const message = document.querySelector("#message");
let encodedDownload;
let recoveredDownload;

for (const input of document.querySelectorAll('input[type="file"]')) {
  input.addEventListener("change", () => updateFileInfo(input));
}

document.querySelector("#encrypt-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitForm(event.currentTarget, "/api/encrypt", (data) => {
    document.querySelector("#encoded-preview").src = data.encoded_image;
    document.querySelector("#encrypt-details").textContent =
      `${data.encoded_dimensions[0]} × ${data.encoded_dimensions[1]} pixels • ` +
      `${formatBytes(data.payload_size)} payload • capacity ${formatBytes(data.capacity)} • ` +
      `cover resized to private image dimensions`;
    document.querySelector("#encrypt-result").classList.remove("hidden");
    encodedDownload = { url: data.encoded_image, filename: data.encoded_filename };
    showMessage("Image encrypted successfully. The encoded PNG can decrypt automatically.", false);
  });
});

document.querySelector("#decrypt-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitForm(event.currentTarget, "/api/decrypt", (data) => {
    document.querySelector("#recovered-preview").src = data.recovered_image;
    document.querySelector("#decrypt-details").textContent =
      `${data.dimensions[0]} × ${data.dimensions[1]} pixels • ${formatBytes(data.size)} exact original bytes`;
    document.querySelector("#decrypt-result").classList.remove("hidden");
    recoveredDownload = { url: data.recovered_image, filename: data.filename };
    showMessage("Image decrypted successfully.", false);
  });
});

document.querySelector("#download-encoded").addEventListener("click", () => download(encodedDownload));
document.querySelector("#download-recovered").addEventListener("click", () => download(recoveredDownload));

async function submitForm(form, endpoint, onSuccess) {
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  showMessage("Processing locally…", false);
  try {
    const response = await fetch(endpoint, { method: "POST", body: new FormData(form) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The operation failed.");
    onSuccess(data);
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    button.disabled = false;
  }
}

function updateFileInfo(input) {
  const file = input.files[0];
  const info = document.querySelector(`#${input.id.replace("-image", "-info")}`);
  if (!file || !info) return;
  info.textContent = `${file.name} • ${formatBytes(file.size)}`;
  const preview = document.querySelector(`#${input.id.replace("-image", "-preview")}`);
  if (preview) preview.src = URL.createObjectURL(file);
}

function download(file) {
  if (!file) return;
  const link = document.createElement("a");
  link.href = file.url;
  link.download = file.filename;
  link.click();
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function showMessage(text, isError) {
  message.textContent = text;
  message.className = `message ${isError ? "error" : "success"}`;
}
