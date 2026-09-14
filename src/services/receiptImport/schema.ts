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
  amountText: SHORT_TEXT.nullish().transform((v) => v ?? ''),
  signText: z.enum(['+', '-']).nullish().transform((v) => v ?? '+'),
  subtitle: SHORT_TEXT.nullish().transform((v) => v ?? null),
  timeText: SHORT_TEXT.nullish().transform((v) => v ?? null)
});

export const visionDateHeaderSchema = z.object({
  raw: SHORT_TEXT,
  appliesToRows: z.array(z.number().int().nonnegative().max(500)).nullish()
    .transform((v) => v ?? [])
});

export const visionOutputSchema = z.object({
  dateHeaders: z.array(visionDateHeaderSchema).nullish().transform((v) => v ?? []),
  // A single screenshot holds ~6 cards; 200 is far beyond any real batch and
  // catches a model that has started looping.
  rows: z.array(visionRowSchema).max(200)
});

export type VisionRow = z.infer<typeof visionRowSchema>;
export type VisionDateHeader = z.infer<typeof visionDateHeaderSchema>;
export type VisionOutput = z.infer<typeof visionOutputSchema>;
