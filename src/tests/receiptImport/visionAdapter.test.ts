import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenAiCompatibleVisionAdapter } from '../../services/ai/adapters/openaiCompatible.vision.adapter';
import { VisionTimeoutError, VisionUnavailableError } from '../../errors/ReceiptImportErrors';
import type { VisionExtractRequest } from '../../services/ai/vision.port';

/**
 * Covers the timeout-related fixes: the per-image timeout scaling, and
 * telling "the host is slow" (VisionTimeoutError, retryable) apart from
 * "the host is down" (VisionUnavailableError) so a client can react
 * differently to each.
 */

const BASE_TIMEOUT_MS = 5_000;
const PER_IMAGE_MS = 1_000;

function makeRequest (imageCount: number): VisionExtractRequest {
  return {
    systemPrompt: 'system',
    userPrompt: 'user',
    images: Array.from({ length: imageCount }, () => ({
      buffer: Buffer.from('fake-image-bytes'),
      mimeType: 'image/png'
    }))
  };
}

function okResponse (): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: '{"rows":[]}' } }] }),
    text: async () => ''
  } as unknown as Response;
}

describe('OpenAiCompatibleVisionAdapter timeout handling', () => {
  beforeEach(() => {
    process.env.VISION_TIMEOUT_MS = String(BASE_TIMEOUT_MS);
    process.env.VISION_TIMEOUT_PER_IMAGE_MS = String(PER_IMAGE_MS);
    vi.spyOn(AbortSignal, 'timeout');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.VISION_TIMEOUT_MS;
    delete process.env.VISION_TIMEOUT_PER_IMAGE_MS;
  });

  it('uses the base timeout alone for a single image', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse()));
    const adapter = new OpenAiCompatibleVisionAdapter();

    await adapter.extract(makeRequest(1));

    expect(AbortSignal.timeout).toHaveBeenCalledWith(BASE_TIMEOUT_MS);
  });

  it('adds the per-image surcharge for each additional image', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse()));
    const adapter = new OpenAiCompatibleVisionAdapter();

    await adapter.extract(makeRequest(5));

    expect(AbortSignal.timeout).toHaveBeenCalledWith(BASE_TIMEOUT_MS + PER_IMAGE_MS * 4);
  });

  it('throws VisionTimeoutError (504) when the fetch aborts on timeout', async () => {
    const timeoutError = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeoutError));
    const adapter = new OpenAiCompatibleVisionAdapter();

    await expect(adapter.extract(makeRequest(2))).rejects.toMatchObject({
      errorCode: 'VISION_TIMEOUT',
      statusCode: 504
    });
    await expect(adapter.extract(makeRequest(2))).rejects.toBeInstanceOf(VisionTimeoutError);
  });

  it('throws VisionUnavailableError (503) for a non-timeout network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    const adapter = new OpenAiCompatibleVisionAdapter();

    await expect(adapter.extract(makeRequest(1))).rejects.toMatchObject({
      errorCode: 'VISION_UNAVAILABLE',
      statusCode: 503
    });
    await expect(adapter.extract(makeRequest(1))).rejects.toBeInstanceOf(VisionUnavailableError);
  });
});
