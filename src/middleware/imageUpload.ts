import type { Request, Response, NextFunction } from 'express';
import multer, { MulterError } from 'multer';
import { FileTooLargeError, UnsupportedFileTypeError } from '../errors/XlsxImportErrors';

const MAX_IMAGE_MB = parseInt(process.env.MAX_IMAGE_UPLOAD_MB ?? '12', 10);
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;
const MAX_IMAGE_FILES = parseInt(process.env.MAX_IMAGE_UPLOAD_FILES ?? '5', 10);

/**
 * Screenshots arrive as PNG (iOS/Android screen capture) or JPEG (photos).
 * HEIC is accepted at the door but most vision hosts cannot decode it, so the
 * adapter will surface a model-side error rather than us guessing here.
 */
const ACCEPTED_MIME = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/heic',
  'image/heif'
];

const ACCEPTED_EXT = /\.(png|jpe?g|webp|heic|heif)$/i;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_IMAGE_FILES },
  fileFilter: (_req, file, cb) => {
    const isImage =
      ACCEPTED_MIME.includes(file.mimetype.toLowerCase()) ||
      ACCEPTED_EXT.test(file.originalname);
    if (isImage) {
      cb(null, true);
    } else {
      cb(new UnsupportedFileTypeError('Unsupported file type. Upload a PNG, JPEG or WebP image.'));
    }
  }
});

/** Multi-file image upload that maps multer failures to typed errors. */
export function imageUpload (req: Request, res: Response, next: NextFunction): void {
  const runUpload = upload.array('files', MAX_IMAGE_FILES) as unknown as (
    r: Request, s: Response, cb: (err: unknown) => void
  ) => void;
  runUpload(req, res, (err: unknown) => {
    if (err instanceof MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        next(new FileTooLargeError(`Each image must be under ${MAX_IMAGE_MB}MB.`));
        return;
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        next(new FileTooLargeError(`Upload at most ${MAX_IMAGE_FILES} images at a time.`));
        return;
      }
      next(new UnsupportedFileTypeError('Invalid file upload.'));
      return;
    }
    if (err) { next(err); return; }
    next();
  });
}
