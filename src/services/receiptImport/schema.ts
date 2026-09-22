import { z } from 'zod';

/**
 * The validation boundary between the model and the rest of the app.
 *
 * Everything the model says is untrusted: it may hallucinate fields, emit
 * strings where numbers belong, or echo an injected instruction from inside
 * the image. Nothing downstream sees model output until it has passed through
 * here.
 */

/** Screenshots are text — a field longer than this is a runaway generation. */
const SHORT_TEXT = z.string().max(300);

export const visionRowSchema = z.object({
  vendorRaw: SHORT_TEXT,
  truncated: z.boolean().nullish().transform((v) => v ?? false),
  subtitle: SHORT_TEXT.nullish().transform((v) => v ?? null),
  timeText: SHORT_TEXT.nullish().transform((v) => v ?? null)
});

export const visionDateHeaderSchema = z.object({
  raw: SHORT_TEXT,
  appliesToRows: z.array(z.number().int().nonnegative().max(500)).nullish()
    .transform((v) => v ?? [])
});

export const visionOutputSchema = z.object({
  /** The model's own count of cards it can see — a self-check on recall. */
  rowsVisible: z.number().int().nonnegative().max(500).nullish().transform((v) => v ?? null),
  /**
   * The heading above the FIRST card, verbatim. A required scalar, because
   * the model intermittently returns an empty `dateHeaders` array and a
   * strict-mode required field is the only reliable way to make it look.
   */
  primaryDateHeading: SHORT_TEXT.nullish().transform((v) => v ?? null),
  dateHeaders: z.array(visionDateHeaderSchema).nullish().transform((v) => v ?? []),
  // A single screenshot holds ~6 cards; 200 is far beyond any real batch and
  // catches a model that has started looping.
  rows: z.array(visionRowSchema).max(200)
});

export type VisionRow = z.infer<typeof visionRowSchema>;
export type VisionDateHeader = z.infer<typeof visionDateHeaderSchema>;
export type VisionOutput = z.infer<typeof visionOutputSchema>;

/**
 * JSON Schema handed to the model for constrained decoding.
 *
 * Kept hand-written rather than derived from the Zod schema above: providers
 * that support structured output require `strict` mode (every property listed
 * in `required`, `additionalProperties: false`), which the Zod schema's
 * optional/transform fields do not satisfy. The two serve different jobs —
 * this one CONSTRAINS generation, the Zod one VALIDATES whatever comes back.
 * The Zod schema stays the authority, because a host may ignore this entirely.
 */
export const VISION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  // Property order is load-bearing: constrained decoding emits fields in
  // schema order, and the model spends its attention on whatever it writes
  // first. Asking for the date heading before the rows is the difference
  // between getting it and getting null.
  required: ['primaryDateHeading', 'rowsVisible', 'dateHeaders', 'rows'],
  properties: {
    primaryDateHeading: { type: ['string', 'null'] },
    rowsVisible: { type: 'integer' },
    dateHeaders: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['raw', 'appliesToRows'],
        properties: {
          raw: { type: 'string' },
          appliesToRows: { type: 'array', items: { type: 'integer' } }
        }
      }
    },
    rows: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['vendorRaw', 'truncated', 'subtitle', 'timeText'],
        properties: {
          vendorRaw: { type: 'string' },
          truncated: { type: 'boolean' },
          subtitle: { type: ['string', 'null'] },
          timeText: { type: ['string', 'null'] }
        }
      }
    }
  }
} as const;
