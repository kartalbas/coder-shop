import sharp from "sharp";

const IMAGE_SIZE = "768x768";
const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 1000;

class ImageApiError extends Error {}

export interface ImageApiOptions {
  url: string;
  apiKey: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface ImagesResponse {
  data?: { b64_json?: string; url?: string }[];
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function requestImage(
  prompt: string,
  seed: number,
  options: ImageApiOptions,
): Promise<Buffer> {
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(options.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({ prompt, size: IMAGE_SIZE, seed }),
      });
      if (!response.ok) {
        const body = (await response.text()).slice(0, 300);
        lastError = `HTTP ${response.status}: ${body}`;
        if (!isRetryableStatus(response.status)) {
          throw new ImageApiError(`image API rejected the request (${lastError})`);
        }
      } else {
        return await readImageBuffer(await response.json());
      }
    } catch (error) {
      if (error instanceof ImageApiError) throw error;
      lastError = error instanceof Error ? error.message : String(error);
    }
    if (attempt < MAX_ATTEMPTS) await delay(BASE_DELAY_MS * 2 ** (attempt - 1));
  }
  throw new ImageApiError(
    `image API failed after ${MAX_ATTEMPTS} attempts (last error: ${lastError})`,
  );
}

async function readImageBuffer(body: ImagesResponse): Promise<Buffer> {
  const entry = body.data?.[0];
  if (entry?.b64_json) return Buffer.from(entry.b64_json, "base64");
  if (entry?.url) {
    const response = await fetch(entry.url);
    if (!response.ok) throw new ImageApiError(`could not fetch image URL (HTTP ${response.status})`);
    return Buffer.from(await response.arrayBuffer());
  }
  throw new ImageApiError("image API returned no image data");
}

export async function generatePhoto(
  prompt: string,
  seed: number,
  options: ImageApiOptions,
): Promise<Buffer> {
  const raw = await requestImage(prompt, seed, options);
  try {
    return await sharp(raw).webp({ quality: 90 }).toBuffer();
  } catch (error) {
    throw new ImageApiError(
      `could not decode image response as WebP/JPEG/PNG: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
