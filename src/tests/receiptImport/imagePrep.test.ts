import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import type { prepareImage as PrepareImageFn } from '../../services/receiptImport/imagePrep';

/**
 * `imagePrep.MAX_DIMENSION` is read from env once at module load, so tests
 * that need a specific value reset the module registry and re-import fresh
 * rather than relying on import order across the suite.
 */
async function freshPrepareImage (): Promise<typeof PrepareImageFn> {
  vi.resetModules();
  const mod = await import('../../services/receiptImport/imagePrep');
  return mod.prepareImage;
}

async function pngBuffer (width: number, height: number): Promise<Buffer> {
  return await sharp({
    create: { width, height, channels: 3, background: { r: 10, g: 20, b: 30 } }
  }).png().toBuffer();
}

describe('prepareImage', () => {
  beforeEach(() => {
    delete process.env.VISION_MAX_IMAGE_DIMENSION;
  });

  afterEach(() => {
    delete process.env.VISION_MAX_IMAGE_DIMENSION;
  });

  it('downscales an image larger than the max dimension, keeping aspect ratio and format', async () => {
    process.env.VISION_MAX_IMAGE_DIMENSION = '400';
    const prepareImage = await freshPrepareImage();

    const buffer = await pngBuffer(1200, 600); // 2:1
    const result = await prepareImage({ buffer, mimetype: 'image/png', originalname: 'tall.png' });

    const meta = await sharp(result.buffer).metadata();
    expect(meta.width).toBeLessThanOrEqual(400);
    expect(meta.height).toBeLessThanOrEqual(400);
    expect(meta.width).toBe(400); // longest edge hits the cap exactly
    expect(meta.height).toBe(200); // aspect ratio preserved (1200:600 = 2:1)
    expect(meta.format).toBe('png');
    expect(result.mimeType).toBe('image/png');
  });

  it('leaves an image at or under the max dimension untouched', async () => {
    process.env.VISION_MAX_IMAGE_DIMENSION = '1600';
    const prepareImage = await freshPrepareImage();

    const buffer = await pngBuffer(800, 400);
    const result = await prepareImage({ buffer, mimetype: 'image/png', originalname: 'small.png' });

    expect(result.buffer).toBe(buffer); // same reference: true no-op, not a re-encode
  });

  it('falls back to the original buffer for undecodable input instead of throwing', async () => {
    process.env.VISION_MAX_IMAGE_DIMENSION = '400';
    const prepareImage = await freshPrepareImage();

    const garbage = Buffer.from('this is not an image');
    const result = await prepareImage({ buffer: garbage, mimetype: 'image/png', originalname: 'bad.png' });

    expect(result.buffer).toBe(garbage);
    expect(result.mimeType).toBe('image/png');
  });

  it('defaults unrecognized mimetypes to image/png', async () => {
    process.env.VISION_MAX_IMAGE_DIMENSION = '1600';
    const prepareImage = await freshPrepareImage();

    const buffer = await pngBuffer(100, 100);
    const result = await prepareImage({ buffer, mimetype: 'application/octet-stream', originalname: 'x.png' });

    expect(result.mimeType).toBe('image/png');
  });
});
