import { Router } from 'express';
import { synthesizeSpeechHandler } from '#src/controllers/tts.controller.ts';
import {
  authMiddleware,
  validateRequest,
} from '#src/middlewares/authenticate.middleware.ts';
import { SynthesizeSpeechSchema } from '#src/validations/tts.validation.ts';

const router = Router();

router.use(authMiddleware);
router.post('/', validateRequest(SynthesizeSpeechSchema), synthesizeSpeechHandler);

export default router;
