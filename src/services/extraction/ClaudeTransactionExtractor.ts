import { ExtractionUnavailableError } from '../../errors/ImportErrors';
import { type ExtractionResult, type TransactionExtractor } from './types';

/**
 * Real Claude vision extractor — PLACEHOLDER.
 *
 * Not yet implemented: the project has no Anthropic API key configured, so the
 * factory in `./index.ts` selects the MockTransactionExtractor instead. This
 * class exists so the swap is a one-line factory change once the key lands;
 * until then `extract()` fails loud rather than returning empty data.
 *
 * ─── Implementation blueprint (when the key is available) ───────────────────
 *  1. `yarn add @anthropic-ai/sdk`; read `ANTHROPIC_API_KEY` (+ optional
 *     `ANTHROPIC_MODEL`, default `claude-sonnet-4-6`).
 *  2. Force structured output with a single tool call:
 *       tool_choice: { type: 'tool', name: 'record_transactions' }
 *     whose input_schema mirrors `ExtractionResult` (transactions[] + currencyHint).
 *  3. Message = [ { type: 'image', source: { type: 'base64', media_type, data } },
 *                 { type: 'text', text: 'Extract all transactions…' } ].
 *  4. System prompt + tool schema are static → mark with
 *     cache_control: { type: 'ephemeral' } for prompt caching.
 *  5. max_tokens ~8192; if stop_reason === 'max_tokens' → ExtractionFailedError.
 *  6. Re-validate the tool input server-side (amount > 0, type enum, ISO date)
 *     before returning — never trust model output shape blindly.
 *  7. Map SDK/network errors → ExtractionFailedError (502) / retries via the SDK.
 */
export class ClaudeTransactionExtractor implements TransactionExtractor {
  readonly source = 'claude' as const;

  async extract (_image: Buffer, _mimeType: string): Promise<ExtractionResult> {
    throw new ExtractionUnavailableError(
      'Claude extraction is not implemented yet. Set USE_MOCK_EXTRACTION=true to use the mock extractor.'
    );
  }
}
