import { logger } from '@/config/logger';
import { VisionOutputInvalidError, VisionUnavailableError } from '@/errors/ReceiptImportErrors';
import type { VisionExtractRequest, VisionExtractResult, VisionExtractor } from '../vision.port';

/**
 * OpenAI-compatible vision adapter.
 *
 * Speaks `POST /v1/chat/completions` with image_url content parts, which is
 * the shape LM Studio, Ollama, vLLM and every hosted provider share. Pointing
 * at a different host is a VISION_BASE_URL change and nothing else.
 *
 * Defaults target LM Studio's local server (Developer tab -> Start Server).
 */

const DEFAULT_BASE_URL = 'http://localhost:1234/v1';
const DEFAULT_MODEL = 'qwen/qwen2.5-vl-7b';
const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * How to ask for JSON back. Hosts disagree:
 *   LM Studio -> 'json_schema' or 'text' only
 *   Ollama    -> 'json_object'
 *   hosted    -> usually all three
 * Default to the strictest and degrade automatically on rejection.
 */
type ResponseFormatMode = 'json_schema' | 'json_object' | 'text';

function configuredMode (): ResponseFormatMode {
  const raw = process.env.VISION_RESPONSE_FORMAT;
  if (raw === 'json_object' || raw === 'text' || raw === 'json_schema') { return raw; }
  return 'json_schema';
}

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

export class OpenAiCompatibleVisionAdapter implements VisionExtractor {
  readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;
  private readonly maxTokens: number;

  constructor () {
    this.baseUrl = (process.env.VISION_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.model = process.env.VISION_MODEL ?? DEFAULT_MODEL;
    this.apiKey = process.env.VISION_API_KEY;
    this.timeoutMs = parseInt(process.env.VISION_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS), 10);
    this.maxTokens = parseInt(process.env.VISION_MAX_TOKENS ?? '4096', 10);
  }

  private responseFormat (
    mode: ResponseFormatMode,
    jsonSchema: VisionExtractRequest['jsonSchema']
  ): Record<string, unknown> {
    if (mode === 'json_schema' && jsonSchema) {
      return {
        type: 'json_schema',
        json_schema: { name: jsonSchema.name, schema: jsonSchema.schema, strict: true }
      };
    }
    if (mode === 'json_object') { return { type: 'json_object' }; }
    return { type: 'text' };
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

    let mode = configuredMode();
    if (mode === 'json_schema' && !req.jsonSchema) { mode = 'json_object'; }

    const call = async (m: ResponseFormatMode): Promise<Response> => {
      try {
        return await fetch(`${this.baseUrl}/chat/completions`, {
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
            // Generous: a long movements list is still only a few hundred
            // tokens, but an unset cap lets some hosts default to ~256 and
            // truncate mid-list.
            max_tokens: this.maxTokens,
            response_format: this.responseFormat(m, req.jsonSchema),
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
    };

    let response = await call(mode);

    // Hosts reject response_format shapes they don't implement with a 400.
    // Degrade to plain text once rather than failing the user's upload; the
    // prompt still asks for JSON and parseLooseJson recovers it.
    if (response.status === 400 && mode !== 'text') {
      const body = await response.text().catch(() => '');
      if (body.includes('response_format')) {
        logger.warn(`Host rejected response_format '${mode}', retrying as text: ${body.slice(0, 200)}`);
        mode = 'text';
        response = await call(mode);
      } else {
        logger.error(`Vision host 400: ${body.slice(0, 500)}`);
        throw new VisionUnavailableError(
          `The vision model rejected the request: ${body.slice(0, 200)}`
        );
      }
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      logger.error(`Vision host ${response.status}: ${body.slice(0, 500)}`);
      throw new VisionUnavailableError(
        `The vision model returned ${response.status}. Check that "${this.model}" is loaded and supports images.`
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

export const visionAdapter = new OpenAiCompatibleVisionAdapter();
