import { Router } from 'express';
import multer from 'multer';
import * as c from './quiz.controller';
import { QuizUpsertSchema } from './quiz.schemas';
import { requireInstructor } from '@/modules/auth';
import { validateBody } from '@/middleware/validate';
import { asyncHandler } from '@/middleware/async-handler';
import { createImageUpload } from '@/middleware/upload';
import { badRequest } from '@/utils/errors';
import { env } from '@/config/env';

export const quizRoutes = Router();
quizRoutes.use(requireInstructor);

quizRoutes.get('/', asyncHandler(c.list));
quizRoutes.post('/', validateBody(QuizUpsertSchema), asyncHandler(c.create));
quizRoutes.get('/:id', asyncHandler(c.get));
quizRoutes.put('/:id', validateBody(QuizUpsertSchema), asyncHandler(c.update));
quizRoutes.delete('/:id', asyncHandler(c.remove));
quizRoutes.post('/:id/publish', asyncHandler(c.lifecycle('publish')));
quizRoutes.post('/:id/unpublish', asyncHandler(c.lifecycle('unpublish')));
quizRoutes.post('/:id/close', asyncHandler(c.lifecycle('close')));
quizRoutes.post('/:id/reopen', asyncHandler(c.lifecycle('reopen')));
quizRoutes.post('/:id/rotate-token', asyncHandler(c.rotateToken));

/** Image upload for question / choice prompts (instructor-only). */
export const uploadRoutes = Router();
uploadRoutes.use(requireInstructor);
const upload = createImageUpload(env.UPLOAD_DIR);
uploadRoutes.post('/image', (req, res, next) => {
  upload.single('image')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) return next(badRequest(err.code === 'LIMIT_FILE_SIZE' ? 'Image exceeds 2 MB' : err.message));
    if (err) return next(err);
    if (!req.file) return next(badRequest('No image provided'));
    c.uploadImage(req, res);
  });
});
