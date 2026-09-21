import multer from 'multer';
import fs from 'node:fs';
import { nanoid } from 'nanoid';
import { MAX_IMAGE_BYTES } from '@shared';
import { badRequest } from '@/utils/errors';

const ALLOWED: Record<string, string> = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' };

/** Question / choice images: random file names on local disk, served under /uploads. */
export function createImageUpload(uploadDir: string) {
  fs.mkdirSync(uploadDir, { recursive: true });
  return multer({
    storage: multer.diskStorage({ destination: uploadDir, filename: (_req, file, cb) => cb(null, `${nanoid(20)}${ALLOWED[file.mimetype] ?? ''}`) }),
    limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => (ALLOWED[file.mimetype] ? cb(null, true) : cb(badRequest('Only PNG, JPEG, WEBP or GIF images are allowed'))),
  });
}
