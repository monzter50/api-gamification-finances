import type { Request, Response, NextFunction } from 'express';
import multer, { MulterError } from 'multer';
import { FileTooLargeError, UnsupportedFileTypeError } from '../errors/ImportErrors';

const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB ?? '10', 10);
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/**
 * Accepted statement-upload mime types.
 *
 * ⚠️ PDF expansion: when we add PDF statements, add `'application/pdf'` to this
 * list AND make the extractor handle PDFs. That is the only change needed here.
 */
export const ACCEPTED_UPLOAD_MIME = ['image/jpeg', 'image/png', 'image/webp'];

// In-memory only — the image is never written to disk and is GC'd after the
// request (statements are processed and discarded).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ACCEPTED_UPLOAD_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new UnsupportedFileTypeError());
    }
  }
});

/**
 * Single-file ("file") upload middleware that turns multer's own failures into
 * the project's typed errors so the global errorHandler maps them cleanly.
 */
export function statementUpload (req: Request, res: Response, next: NextFunction): void {
  // Cast around a nested @types/express-serve-static-core mismatch (multer's
  // bundled copy vs the app's) under exactOptionalPropertyTypes.
  const runUpload = upload.single('file') as unknown as (
    r: Request, s: Response, cb: (err: unknown) => void
  ) => void;
  runUpload(req, res, (err: unknown) => {
    if (err instanceof MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        next(new FileTooLargeError(`File exceeds the ${MAX_UPLOAD_MB}MB limit.`));
        return;
      }
      next(new UnsupportedFileTypeError('Invalid file upload.'));
      return;
    }
    if (err) {
      // Our typed fileFilter error (UnsupportedFileTypeError) or anything else.
      next(err);
      return;
    }
    next();
  });
}
