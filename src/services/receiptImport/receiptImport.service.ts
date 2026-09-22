import { logger } from '../../config/logger';
import { NoRowsDetectedError, VisionDisabledError, VisionOutputInvalidError } from '../../errors/ReceiptImportErrors';
import { visionAdapter } from '../ai/adapters/openaiCompatible.vision.adapter';
import type { VisionExtractor, VisionImage } from '../ai/vision.port';
import { prepareImage } from './imagePrep';
import { normalizeRows } from './normalize';
import { SYSTEM_PROMPT, USER_PROMPT } from './prompt';
import { VISION_JSON_SCHEMA, visionOutputSchema } from './schema';
import type { AccountKind, ParseImageOptions, ParseImageResult } from './types';

/**
 * Bank-screenshot import service.
 *
 * READ-ONLY by design. `parse` reads an image and returns draft rows; it never
 * touches the database. That keeps the endpoint idempotent — a user can
 * re-upload and re-review as often as they like with no consequence — and
 * means a model hallucination can never reach the ledger on its own.
 *
 * Creating Transactions from these rows is a separate confirm step, not yet
 * built, which will reuse the existing xlsx confirm pipeline.
 */
export class ReceiptImportService {
  constructor (private readonly vision: VisionExtractor = visionAdapter) {}

  private isEnabled (): boolean {
    // Default ON in dev so `yarn dev` works with a local Ollama; production
    // must opt in explicitly, since Railway has no model host to talk to.
    const flag = process.env.VISION_ENABLED;
    if (flag === undefined) { return process.env.NODE_ENV !== 'production'; }
    return flag === 'true' || flag === '1';
  }

  async parse (
    files: Array<{ buffer: Buffer, mimetype: string, originalname: string }>,
    options: ParseImageOptions
  ): Promise<ParseImageResult> {
    if (!this.isEnabled()) {
      throw new VisionDisabledError();
    }

    // Downscale before the model ever sees them — the single biggest lever
    // on local-host latency (see imagePrep.ts). Runs in parallel; each file
    // is an independent sharp pipeline.
    const images: VisionImage[] = await Promise.all(files.map(async (file) => await prepareImage(file)));

    const result = await this.vision.extract({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: USER_PROMPT,
      images,
      jsonSchema: {
        name: 'bank_movements',
        schema: VISION_JSON_SCHEMA as unknown as Record<string, unknown>
      }
    });

    const parsed = visionOutputSchema.safeParse(result.json);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.') || 'root'}: ${i.message}`)
        .join('; ');
      logger.warn(`Vision output failed schema validation — ${detail}`);
      throw new VisionOutputInvalidError(
        `The model returned JSON in an unexpected shape (${detail}).`
      );
    }

    const { rows, duplicatesInBatch, warnings } = normalizeRows(
      parsed.data.rows,
      parsed.data.dateHeaders,
      {
        accountKind: options.accountKind,
        referenceDate: options.referenceDate,
        primaryDateHeading: parsed.data.primaryDateHeading
      }
    );

    if (rows.length === 0) {
      throw new NoRowsDetectedError(
        'No transaction rows were detected. Check the screenshot shows the movements list.'
      );
    }

    // The model told us how many cards it could see. Fewer rows than that
    // means it dropped some — silent data loss is the worst outcome here, so
    // surface it rather than returning a confident-looking short list.
    const claimed = parsed.data.rowsVisible;
    if (claimed !== null && claimed > rows.length + duplicatesInBatch) {
      warnings.push(
        `The model reported ${claimed} rows in the image but returned ${rows.length + duplicatesInBatch}. ` +
        'Some transactions may be missing — check the bottom of the screenshot.'
      );
    }

    const needsReview = rows.filter((r) => r.needsReview).length;
    const transfers = rows.filter((r) => r.kind === 'transfer').length;

    logger.info(
      `Screenshot parse: ${rows.length} rows (${needsReview} need review, ` +
      `${transfers} transfers) from ${images.length} image(s) in ${result.latencyMs}ms`
    );

    return {
      rows,
      counts: { rows: rows.length, needsReview, transfers, duplicatesInBatch },
      source: {
        model: result.model,
        imagesProcessed: images.length,
        accountKind: options.accountKind,
        latencyMs: result.latencyMs
      },
      warnings
    };
  }
}

export const receiptImportService = new ReceiptImportService();
export type { AccountKind };
