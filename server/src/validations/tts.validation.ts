import z from 'zod';

export const SynthesizeSpeechSchema = z.object({
  text: z.string().trim().min(1, 'Text is required').max(600),
  voice: z.string().trim().min(1).max(100).optional(),
  language: z.string().trim().min(1).max(50).optional(),
  instructions: z.string().trim().min(1).max(500).optional(),
  format: z.enum(['wav', 'mp3']).default('wav'),
});

export type SynthesizeSpeechRequest = z.infer<typeof SynthesizeSpeechSchema>;
