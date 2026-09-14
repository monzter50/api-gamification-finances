import { logger } from '../../../config/logger';
import { VisionOutputInvalidError, VisionUnavailableError } from '../../../errors/ReceiptImportErrors';
import type { VisionExtractRequest, VisionExtractResult, VisionExtractor } from '../vision.port';

/**
 * OpenAI-compatible vision adapter.
 *
 * Works against Ollama (`/v1/chat/completions`), vLLM, LM Studio, or any
 * hosted provider speaking the same shape — only VISION_BASE_URL changes.
 */

const DEFAULT_BASE_URL = 'http://localhost:11434/v1';
const DEFAULT_MODEL = 'qwen2.5vl:7b';
const DEFAULT_TIMEOUT_MS = 120_000;

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>
}

/**
 * Models routinely wrap JSON in markdown fences or bracket it with prose even
 * when told not to. Recover the outermost JSON object rather than failing the
 * whole request over formatting.
 */
export function parseLooseJson (raw: string): unknown {
  const trimmed = raw.trim();

  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(trimmed);
  const candidate = fenced?.[1] ?? trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    // Fall through to brace scanning.
  }

  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      // Fall through to the typed error below.
    }
  }

  throw new VisionOutputInvalidError('The model did not return valid JSON.');
}

export class OllamaVisionAdapter implements VisionExtractor {
  readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;

  constructor () {
    this.baseUrl = (process.env.VISION_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.model = process.env.VISION_MODEL ?? DEFAULT_MODEL;
    this.apiKey = process.env.VISION_API_KEY;
    this.timeoutMs = parseInt(process.env.VISION_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS), 10);
  }

  async extract (req: VisionExtractRequest): Promise<VisionExtractResult> {
    const content = [
      { type: 'text', text: req.userPrompt },
      ...req.images.map((img) => ({
        type: 'image_url',
        image_url: { url: `data:${img.mimeType};base64,${img.buffer.toString('base64')}` }
      }))
    ];

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) { headers.Authorization = `Bearer ${this.apiKey}`; }

    const startedAt = Date.now();
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(this.timeoutMs),
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: req.systemPrompt },
            { role: 'user', content }
          ],
          // Deterministic transcription: never let the model get creative
          // about somebody's money.
          temperature: 0,
          response_format: { type: 'json_object' },
          stream: false
        })
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      logger.error(`Vision host unreachable at ${this.baseUrl}: ${reason}`);
      throw new VisionUnavailableError(
        `Could not reach the vision model at ${this.baseUrl}. Is it running?`
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      logger.error(`Vision host ${response.status}: ${body.slice(0, 500)}`);
      throw new VisionUnavailableError(
        `The vision model returned ${response.status}. Check that "${this.model}" is pulled and supports images.`
      );
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const text = payload.choices?.[0]?.message?.content;

    if (typeof text !== 'string' || text.trim() === '') {
      throw new VisionOutputInvalidError('The vision model returned an empty response.');
    }

    return {
      json: parseLooseJson(text),
      model: this.model,
      latencyMs: Date.now() - startedAt
    };
  }
}

export const ollamaVisionAdapter = new OllamaVisionAdapter();
