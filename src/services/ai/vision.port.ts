/**
 * Vision port.
 *
 * The seam between "we need a picture read" and "which model reads it".
 * Local dev points at an Ollama container; production (Railway has no GPU)
 * points at a hosted OpenAI-compatible vision endpoint. Swapping one for the
 * other is an adapter change and an env var — no service code moves.
 *
 * Implementations return RAW parsed JSON (`unknown`). Schema validation is the
 * caller's job, so a model that answers with the wrong shape fails in one
 * well-tested place instead of leaking `any` through the service layer.
 */

export interface VisionImage {
  buffer: Buffer
  mimeType: string
}

export interface VisionExtractRequest {
  systemPrompt: string
  userPrompt: string
  images: VisionImage[]
  /**
   * Optional JSON Schema for constrained decoding. Hosts that support
   * structured output will refuse to emit anything off-shape; hosts that
   * don't are handled by the adapter falling back to free-form text.
   */
  jsonSchema?: { name: string, schema: Record<string, unknown> }
}

export interface VisionExtractResult {
  /** Parsed JSON from the model. Shape is unverified — validate before use. */
  json: unknown
  model: string
  /** Wall-clock time spent inside the model call. */
  latencyMs: number
}

export interface VisionExtractor {
  readonly model: string
  extract: (req: VisionExtractRequest) => Promise<VisionExtractResult>
}
