import sharp from 'sharp';
import { logger } from '../../config/logger';

/**
 * Screenshots routinely arrive at 3x retina resolution (e.g. 1170x2532) —
 * several times more pixels than a 7B vision model's own preprocessor uses
 * internally. Sending them full-size doesn't improve transcription accuracy
 * (the model downsamples anyway) but does multiply the host's per-image
 * preprocessing time and the base64 payload shipped over the wire — on
 * modest local hardware (LM Studio on a laptop GPU/CPU) that is routinely
 * the difference between finishing in 20s and blowing past VISION_TIMEOUT_MS.
 *
 * Only dimensions are capped, never re-encoded to a lossy format: the digits
 * in an amount are exactly what JPEG artifacting could blur, and this is
 * financial data.
 */
const MAX_DIMENSION = parseInt(process.env.VISION_MAX_IMAGE_DIMENSION ?? '1600', 10);

export interface RawUploadedImage {
  buffer: Buffer
  mimetype: string
  originalname: string
}

export interface PreparedImage {
  buffer: Buffer
  mimeType: string
}

/**
 * Downscale one uploaded screenshot to fit within `MAX_DIMENSION` on its
 * longest edge, preserving aspect ratio and original format. A no-op when
 * the image is already small enough. Never throws — a corrupt or
 * unsupported input (e.g. HEIC libvips can't decode) is passed through
 * as-is so the vision host can reject it with a clearer message than we
 * could give here.
 */
export async function prepareImage (file: RawUploadedImage): Promise<PreparedImage> {
  const mimeType = file.mimetype.startsWith('image/') ? file.mimetype : 'image/png';

  try {
    const image = sharp(file.buffer, { failOn: 'none' });
    const meta = await image.metadata();
    const longestEdge = Math.max(meta.width ?? 0, meta.height ?? 0);

    if (longestEdge <= MAX_DIMENSION) {
      return { buffer: file.buffer, mimeType };
    }

    const resized = await image
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true
      })
      .toBuffer();

    logger.info(
      `Downscaled ${file.originalname}: ${meta.width}x${meta.height} -> fit ${MAX_DIMENSION}px ` +
      `(${(file.buffer.length / 1024).toFixed(0)}KB -> ${(resized.length / 1024).toFixed(0)}KB)`
    );

    return { buffer: resized, mimeType };
  } catch (err) {
    logger.warn(
      `Image preprocessing skipped for ${file.originalname}: ${err instanceof Error ? err.message : String(err)}`
    );
    return { buffer: file.buffer, mimeType };
  }
}
