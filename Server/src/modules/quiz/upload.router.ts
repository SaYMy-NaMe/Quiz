import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { MAX_IMAGE_BYTES } from '@shared';
import { requireInstructor } from '@/modules/auth';
import { badRequest } from '@/utils/errors';

const ALLOWED: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

/** Image prompts are stored on disk with random names and served statically. */
export function createUploadRouter(uploadDir: string): Router {
  fs.mkdirSync(uploadDir, { recursive: true });
  const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => cb(null, `${nanoid(20)}${ALLOWED[file.mimetype] ?? ''}`),
  });
  const upload = multer({
    storage,
    limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED[file.mimetype]) cb(null, true);
      else cb(badRequest('Only PNG, JPEG, WEBP or GIF images are allowed'));
    },
  });

  const router = Router();
  router.use(requireInstructor);
  router.post('/image', (req, res, next) => {
    upload.single('image')(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        next(badRequest(err.code === 'LIMIT_FILE_SIZE' ? 'Image exceeds 2 MB' : err.message));
        return;
      }
      if (err) {
        next(err);
        return;
      }
      if (!req.file) {
        next(badRequest('No image provided'));
        return;
      }
      res.status(201).json({ url: `/uploads/${path.basename(req.file.filename)}` });
    });
  });
  return router;
}
