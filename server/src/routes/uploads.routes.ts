import { Router } from 'express';
import multer from 'multer';
import { config } from '../config';
import { ValidationError } from '../lib/errors';
import { ALLOWED_MIME_TYPES, matchesSignature, storage } from '../lib/storage';
import { requireAuth, requireRole } from '../middleware/auth';

export const uploadsRouter = Router();
uploadsRouter.use(requireAuth, requireRole('author', 'approver'));

/**
 * FR-SOP-03: upload an existing diagram (PNG/JPG/PDF). Files are validated
 * by declared type, real magic bytes, and size before storage (PRD §9.2).
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if ((ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new ValidationError('Only PNG, JPG, or PDF files are allowed'));
    }
  },
});

uploadsRouter.post('/diagram', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    throw new ValidationError('No file uploaded. Send the file in the "file" field.');
  }
  if (!matchesSignature(file.buffer, file.mimetype)) {
    throw new ValidationError('The file content does not match its declared type');
  }

  const stored = await storage.save(file.buffer, file.mimetype, file.originalname);
  res.status(201).json({
    ...stored,
    mimeType: file.mimetype,
    sizeBytes: file.size,
  });
});
