import type { Response } from 'express';
import type { AuthRequest } from '#src/types/authRequest.js';
import {
  synthesizeSpeech,
  TtsConfigurationError,
  TtsProviderError,
  TtsValidationError,
} from '#src/services/tts.service.ts';
import type { SynthesizeSpeechRequest } from '#src/validations/tts.validation.ts';
import { sendApiError } from '#src/utils/api-response.ts';

export const synthesizeSpeechHandler = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const result = await synthesizeSpeech(req.body as SynthesizeSpeechRequest);
    res.set({
      'Cache-Control': 'no-store',
      'Content-Length': String(result.buffer.length),
      'Content-Type': result.mimeType,
      'Content-Disposition': 'inline',
    });
    return res.status(200).send(result.buffer);
  } catch (error) {
    if (error instanceof TtsValidationError) {
      return sendApiError(res, { status: 400, message: error.message });
    }

    if (error instanceof TtsConfigurationError) {
      return sendApiError(res, { status: 503, message: error.message });
    }

    if (error instanceof TtsProviderError) {
      return sendApiError(res, {
        status: error.status === 429 ? 429 : 502,
        message: 'TTS provider request failed',
      });
    }

    return sendApiError(res, {
      status: 500,
      message: 'Failed to synthesize speech',
    });
  }
};
