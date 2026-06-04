import type { Request, Response, NextFunction } from 'express';
import multer, { MulterError } from 'multer';
import { FileTooLargeError, UnsupportedFileTypeError } from '../errors/XlsxImportErrors';

const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB ?? '10', 10);
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

// Only .xlsx (Open XML spreadsheet). Some browsers send a generic type, so we
// also accept octet-stream and let the parser reject a genuinely bad file.
const ACCEPTED_MIME = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream'
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const isXlsx = ACCEPTED_MIME.includes(file.mimetype) || file.originalname.toLowerCase().endsWith('.xlsx');
    if (isXlsx) {
      cb(null, true);
    } else {
      cb(new UnsupportedFileTypeError());
    }
  }
});

/** Single-file (.xlsx) upload that maps multer failures to typed errors. */
export function xlsxUpload (req: Request, res: Response, next: NextFunction): void {
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
    if (err) { next(err); return; }
    next();
  });
}
