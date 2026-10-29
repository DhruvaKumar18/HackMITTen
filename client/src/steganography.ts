/**
 * Steganography Module for Chatvia
 * 
 * Based on 4-bit LSB (Least Significant Bit) Image Steganography:
 * - Public Cover Image: Upper 4 bits retained (0xF0) -> Visually identical to normal photo
 * - Private Secret Image: Upper 4 bits shifted to lower 4 bits (>> 4)
 * - Decryption: Lower nibble extracted and expanded ((nibble << 4) | nibble)
 * - View-Once & Auto-Vanish: Private image is decrypted once on-demand and wiped upon dismissal.
 */

export interface StegoResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Load an image safely from File, Blob, or URL
 */
export function loadImage(src: string | Blob | File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    let urlToRevoke: string | null = null;
    if (src instanceof Blob) {
      urlToRevoke = URL.createObjectURL(src);
      img.src = urlToRevoke;
    } else {
      // If relative or same-domain URL, fetch as blob to avoid canvas tainting
      if (src.startsWith("/") || src.startsWith("data:") || src.startsWith("blob:")) {
        img.src = src;
      } else {
        // Cross-origin fallback
        fetch(src)
          .then((res) => res.blob())
          .then((b) => {
            urlToRevoke = URL.createObjectURL(b);
            img.src = urlToRevoke;
          })
          .catch(() => {
            img.src = src;
          });
      }
    }

    img.onload = () => {
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
      resolve(img);
    };

    img.onerror = () => {
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
      reject(new Error("Failed to load image for steganography."));
    };
  });
}

/**
 * Extract pixel data from an image on an offscreen canvas
 */
function getPixels(image: HTMLImageElement, width: number, height: number): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not create 2D canvas context.");
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(image, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

/**
 * Embeds a Private Image inside a Public Cover Image using 4-bit LSB Steganography.
 * Returns a lossless PNG Blob and data URL.
 */
export async function embedSteganography(
  coverSource: string | Blob | File,
  secretSource: string | Blob | File | HTMLCanvasElement
): Promise<StegoResult> {
  const coverImg = await loadImage(coverSource instanceof HTMLCanvasElement ? coverSource.toDataURL() : coverSource);
  
  let secretImg: HTMLImageElement;
  if (secretSource instanceof HTMLCanvasElement) {
    secretImg = await loadImage(secretSource.toDataURL());
  } else {
    secretImg = await loadImage(secretSource);
  }

  // Use the cover image's dimensions (or secret's if cover is smaller)
  const width = Math.max(coverImg.naturalWidth, secretImg.naturalWidth || 600);
  const height = Math.max(coverImg.naturalHeight, secretImg.naturalHeight || 400);

  const coverData = getPixels(coverImg, width, height);
  const secretData = getPixels(secretImg, width, height);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not create canvas context.");

  const output = ctx.createImageData(width, height);
  const coverPixels = coverData.data;
  const secretPixels = secretData.data;

  // 4-bit LSB Steganography embedding algorithm
  for (let i = 0; i < output.data.length; i += 4) {
    // Red, Green, Blue
    output.data[i] = (coverPixels[i] & 0xf0) | (secretPixels[i] >> 4);
    output.data[i + 1] = (coverPixels[i + 1] & 0xf0) | (secretPixels[i + 1] >> 4);
    output.data[i + 2] = (coverPixels[i + 2] & 0xf0) | (secretPixels[i + 2] >> 4);
    // Alpha channel fully opaque
    output.data[i + 3] = 255;
  }

  ctx.putImageData(output, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to export steganographic PNG canvas."));
        return;
      }
      const dataUrl = canvas.toDataURL("image/png");
      resolve({ blob, dataUrl, width, height });
    }, "image/png");
  });
}

/**
 * Extracts and decodes the hidden Private Image from an encoded Steganographic PNG.
 */
export async function extractSteganography(
  encodedSource: string | Blob | File
): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = await loadImage(encodedSource);
  const width = img.naturalWidth;
  const height = img.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not create canvas context.");

  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, width, height);
  const pixels = imgData.data;

  const output = ctx.createImageData(width, height);

  // Expand the lower 4 bits (nibble) back to 8 bits
  function expandNibble(value: number): number {
    const nibble = value & 0x0f;
    return (nibble << 4) | nibble;
  }

  for (let i = 0; i < output.data.length; i += 4) {
    output.data[i] = expandNibble(pixels[i]);
    output.data[i + 1] = expandNibble(pixels[i + 1]);
    output.data[i + 2] = expandNibble(pixels[i + 2]);
    output.data[i + 3] = 255;
  }

  ctx.putImageData(output, 0, 0);
  const dataUrl = canvas.toDataURL("image/png");
  return { dataUrl, width, height };
}

/**
 * Creates a visually styled card canvas containing private secret text
 * so confidential text messages can also be hidden using the exact same image steganography!
 */
export function createSecretTextCard(
  text: string,
  width = 640,
  height = 420
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // Background gradient: sleek dark security theme
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, "#0f172a");
  bgGrad.addColorStop(0.5, "#1e1b4b");
  bgGrad.addColorStop(1, "#311042");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Border & Glow
  ctx.strokeStyle = "#818cf8";
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  // Security Header
  ctx.fillStyle = "#a5b4fc";
  ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
  ctx.fillText("🔒 CONFIDENTIAL PRIVATE MESSAGE", 36, 56);

  // Subtitle
  ctx.fillStyle = "#94a3b8";
  ctx.font = "14px system-ui, -apple-system, sans-serif";
  ctx.fillText("Decrypted via 4-bit LSB Image Steganography • View Once", 36, 84);

  // Separator Line
  ctx.strokeStyle = "rgba(148, 163, 184, 0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(36, 102);
  ctx.lineTo(width - 36, 102);
  ctx.stroke();

  // Secret Message Box
  ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
  ctx.roundRect ? ctx.roundRect(36, 120, width - 72, height - 190, 12) : ctx.fillRect(36, 120, width - 72, height - 190);
  ctx.fill();

  // Message Text Wrap
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 22px system-ui, -apple-system, sans-serif";
  
  const maxWidth = width - 110;
  const lineHeight = 32;
  const words = text.split(" ");
  let line = "";
  let y = 165;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, 56, y);
      line = words[n] + " ";
      y += lineHeight;
      if (y > height - 90) {
        ctx.fillText("...", 56, y);
        break;
      }
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, 56, y);

  // Bottom Notice
  ctx.fillStyle = "#f43f5e";
  ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
  ctx.fillText("⚠️ This private message will vanish after closing or timeout.", 36, height - 36);

  return canvas;
}

/**
 * Sample Cover Images for quick 1-click testing
 */
export function createSampleCoverCanvas(type: "nature" | "city" | "abstract" = "nature"): string {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 400;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  if (type === "nature") {
    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, 240);
    sky.addColorStop(0, "#38bdf8");
    sky.addColorStop(1, "#bae6fd");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 600, 240);

    // Sun
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.arc(480, 80, 45, 0, Math.PI * 2);
    ctx.fill();

    // Mountains
    ctx.fillStyle = "#475569";
    ctx.beginPath();
    ctx.moveTo(0, 240);
    ctx.lineTo(150, 110);
    ctx.lineTo(320, 240);
    ctx.fill();

    ctx.fillStyle = "#64748b";
    ctx.beginPath();
    ctx.moveTo(220, 240);
    ctx.lineTo(390, 90);
    ctx.lineTo(540, 240);
    ctx.fill();

    // Hills
    ctx.fillStyle = "#15803d";
    ctx.beginPath();
    ctx.moveTo(0, 240);
    ctx.quadraticCurveTo(200, 190, 600, 240);
    ctx.lineTo(600, 400);
    ctx.lineTo(0, 400);
    ctx.fill();

    // Caption
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText("🏔️ Scenic Landscape (Public Cover Photo)", 20, 360);
  } else if (type === "city") {
    // Sunset
    const sunset = ctx.createLinearGradient(0, 0, 0, 400);
    sunset.addColorStop(0, "#f97316");
    sunset.addColorStop(0.5, "#ec4899");
    sunset.addColorStop(1, "#312e81");
    ctx.fillStyle = sunset;
    ctx.fillRect(0, 0, 600, 400);

    // Skyline
    ctx.fillStyle = "#0f172a";
    const bldgs = [
      [20, 160, 60, 240], [90, 110, 70, 290], [170, 190, 50, 210],
      [230, 80, 80, 320], [320, 140, 65, 260], [395, 100, 75, 300],
      [480, 170, 90, 230]
    ];
    for (const [x, y, w, h] of bldgs) {
      ctx.fillRect(x, y, w, h);
      // Windows
      ctx.fillStyle = "#fef08a";
      for (let wy = y + 15; wy < 380; wy += 25) {
        for (let wx = x + 10; wx < x + w - 10; wx += 16) {
          if (Math.random() > 0.3) ctx.fillRect(wx, wy, 8, 12);
        }
      }
      ctx.fillStyle = "#0f172a";
    }

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText("🌆 City Sunset (Public Cover Photo)", 20, 375);
  } else {
    // Abstract
    const grad = ctx.createLinearGradient(0, 0, 600, 400);
    grad.addColorStop(0, "#6366f1");
    grad.addColorStop(0.5, "#a855f7");
    grad.addColorStop(1, "#ec4899");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 600, 400);

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText("🎨 Modern Artwork (Public Cover Photo)", 30, 200);
  }

  return canvas.toDataURL("image/png");
}

/**
 * Sample Secret Image for quick 1-click testing
 */
export function createSampleSecretCanvas(note = "CONFIDENTIAL: Project Apollo Launch Key #8841-Alpha"): string {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 400;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Dark secret background
  ctx.fillStyle = "#09090b";
  ctx.fillRect(0, 0, 600, 400);

  // Red alert header
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(0, 0, 600, 50);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px monospace";
  ctx.fillText("🚨 TOP SECRET • FOR YOUR EYES ONLY", 30, 34);

  // Secret QR / Blueprint Pattern
  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 80, 200, 200);
  ctx.fillStyle = "#14532d";
  ctx.fillRect(50, 90, 180, 180);

  ctx.fillStyle = "#86efac";
  ctx.font = "14px monospace";
  ctx.fillText("[CLASSIFIED ASSET]", 60, 190);

  // Secret Text
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "16px monospace";
  ctx.fillText("SECRET DATA PAYLOAD:", 270, 110);

  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 15px monospace";
  const lines = [
    note,
    "Target: Node-7 Central Core",
    "Time: 23:45 UTC",
    "Self-Destruct: Activated on read"
  ];
  let y = 145;
  for (const l of lines) {
    ctx.fillText(l, 270, y);
    y += 30;
  }

  // Warning Footer
  ctx.fillStyle = "#facc15";
  ctx.font = "bold 14px monospace";
  ctx.fillText("⚠️ Image will vanish at receiver end once viewed.", 40, 340);

  return canvas.toDataURL("image/png");
}

/**
 * Check if a message's stego secret has vanished for this user
 */
export function isStegoVanished(msgId: string, userId: string, isVanishedServer?: boolean): boolean {
  if (isVanishedServer) return true;
  try {
    return localStorage.getItem(`stego_vanished_${userId}_${msgId}`) === "true";
  } catch {
    return false;
  }
}

/**
 * Mark a message's stego secret as vanished for this user
 */
export function markStegoVanished(msgId: string, userId: string): void {
  try {
    localStorage.setItem(`stego_vanished_${userId}_${msgId}`, "true");
  } catch (e) {
    console.error("Failed to mark stego vanished in localStorage:", e);
  }
}
