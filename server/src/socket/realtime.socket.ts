import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '#src/utils/jwt/tokens.ts';
import {
  appendTranscriptChunk,
  createSession,
  endSession,
  getSessionById,
} from '#src/services/session.service.ts';
import { handleTextInput } from '#src/services/text-input.service.ts';
import { transcribeAudioBuffer } from '#src/services/stt.service.ts';
import {
  ensureFinalEvaluation,
  generateRealtimeFeedback,
  generateSessionStartResponse,
} from '#src/services/evaluation.service.ts';
import {
  getSessionMetadata,
  mergeSessionResources,
  type SessionResourceMetadata,
} from '#src/services/session-cache.service.ts';
import { preprocessTranscriptText } from '#src/services/transcript-preprocess.service.ts';
import { env } from '#config/env.ts';
import logger from '#config/logger.ts';
import { synthesizeSpeech } from '#src/services/tts.service.ts';

const getTokenFromSocket = (socket: Socket): string | null => {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.length) {
    return authToken;
  }

  const header = socket.handshake.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.split(' ')[1];
  }

  return null;
};

export const registerRealtimeSocket = (io: Server) => {
  const realtimeAnalysisTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  const sessionMemoryMap = new Map<string, SocketLearningSessionState>();

  type SocketLearningSessionState = {
    currentQuestion?: string | null;
    currentConceptId?: string | null;
    questionDepth?: number;
    failedAttempts?: number;
    detectedGaps?: string[];
    masteredConcepts?: string[];
    conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
    finalSummary?: unknown;
    showSummaryCard?: boolean;
    triggerMasteryFallback?: boolean;
  };

  io.use(async (socket, next) => {
    try {
      const token = getTokenFromSocket(socket);
      if (!token) {
        return next(new Error('Unauthorized'));
      }

      const payload = await verifyAccessToken(token);
      if (!payload?.userId) {
        return next(new Error('Unauthorized'));
      }

      socket.data.userId = payload.userId;
      socket.data.sessionId = payload.sessionId;
      return next();
    } catch (error) {
      return next(new Error('Unauthorized'));
    }
  });

  const emitLlmResponse = async (
    sessionId: string,
    phase: 'start' | 'realtime' | 'end',
    content: string
  ) => {
    // Browser speech is the free production default. In that mode, emit the
    // answer immediately and let the client speak the visible text locally.
    const text = extractSpeechText(content);
    let speech: {
      audioBase64: string;
      mimeType: string;
    } | null = null;
    if (phase !== 'end' && env.TTS_PROVIDER !== 'browser') {
      try {
        const result = await synthesizeSpeech({ text });
        speech = {
          audioBase64: result.buffer.toString('base64'),
          mimeType: result.mimeType,
        };
      } catch (error) {
        logger.warn('TTS generation failed; delivering text response', {
          error,
          phase,
        });
      }
    }
    io.to(sessionId).emit('llm:response', {
      sessionId,
      phase,
      content,
      speech,
    });
  };

  const extractSpeechText = (content: string): string => {
    try {
      const parsed = JSON.parse(content) as {
        question?: string;
        clarifications?: string[];
      };
      return [
        ...(parsed.clarifications || []),
        parsed.question || '',
      ]
        .filter(value => typeof value === 'string' && value.trim())
        .join('\n\n');
    } catch {
      return content.trim();
    }
  };

  const normalizeState = (
    state?: SocketLearningSessionState
  ): SocketLearningSessionState => ({
    currentQuestion: state?.currentQuestion ?? null,
    currentConceptId: state?.currentConceptId ?? null,
    questionDepth: state?.questionDepth ?? 0,
    failedAttempts: state?.failedAttempts ?? 0,
    detectedGaps: Array.isArray(state?.detectedGaps)
      ? state.detectedGaps.filter(Boolean)
      : [],
    masteredConcepts: Array.isArray(state?.masteredConcepts)
      ? state.masteredConcepts.filter(Boolean)
      : [],
    conversationHistory: Array.isArray(state?.conversationHistory)
      ? state.conversationHistory.filter(
          entry =>
            entry &&
            (entry.role === 'user' || entry.role === 'assistant') &&
            typeof entry.content === 'string' &&
            entry.content.trim().length > 0
        )
      : [],
    finalSummary: state?.finalSummary ?? null,
    showSummaryCard: Boolean(state?.showSummaryCard),
    triggerMasteryFallback: Boolean(state?.triggerMasteryFallback),
  });

  const mergeSessionMemory = (
    sessionId: string,
    snapshot?: SocketLearningSessionState
  ) => {
    const current = normalizeState(sessionMemoryMap.get(sessionId));
    const incoming = normalizeState(snapshot);
    const mergedHistory = [
      ...(current.conversationHistory || []),
      ...(incoming.conversationHistory || []),
    ].slice(-12);
    const mergedGaps = Array.from(
      new Set([
        ...(current.detectedGaps || []),
        ...(incoming.detectedGaps || []),
      ])
    );
    const mergedMastered = Array.from(
      new Set([
        ...(current.masteredConcepts || []),
        ...(incoming.masteredConcepts || []),
      ])
    );

    const merged: SocketLearningSessionState = {
      ...current,
      ...incoming,
      conversationHistory: mergedHistory,
      detectedGaps: mergedGaps,
      masteredConcepts: mergedMastered,
      failedAttempts: Math.max(
        current.failedAttempts || 0,
        incoming.failedAttempts || 0
      ),
      questionDepth: Math.max(
        current.questionDepth || 0,
        incoming.questionDepth || 0
      ),
    };

    sessionMemoryMap.set(sessionId, merged);
    return merged;
  };

  const updateFromUserText = (
    sessionId: string,
    text: string,
    snapshot?: SocketLearningSessionState
  ) => {
    const memory = mergeSessionMemory(sessionId, snapshot);
    const trimmed = text.trim().toLowerCase();
    const failureSignals = [
      "i don't know",
      'i do not know',
      'not sure',
      'please explain',
      'i am not sure',
      'i dont know',
    ];

    const repeatedConfusion =
      memory.conversationHistory
        ?.filter(entry => entry.role === 'user')
        .slice(-3)
        .map(entry => entry.content.trim().toLowerCase())
        .every(entry => entry === trimmed) || false;

    const userFailedConcept =
      !trimmed ||
      failureSignals.some(signal => trimmed.includes(signal)) ||
      repeatedConfusion;

    const nextFailedAttempts = userFailedConcept
      ? (memory.failedAttempts || 0) + 1
      : 0;

    const updated: SocketLearningSessionState = {
      ...memory,
      conversationHistory: [
        ...(memory.conversationHistory || []),
        { role: 'user' as const, content: text.trim() },
      ].slice(-12),
      failedAttempts: nextFailedAttempts,
      triggerMasteryFallback: nextFailedAttempts >= 5,
    };

    sessionMemoryMap.set(sessionId, updated);
    return updated;
  };

  const updateFromAiResponse = (
    sessionId: string,
    response: { question?: string; detected_gaps?: string[] },
    phase: 'start' | 'realtime'
  ) => {
    const memory = mergeSessionMemory(sessionId);
    const currentQuestion =
      response.question?.trim() || memory.currentQuestion || null;
    const detectedGaps = Array.from(
      new Set([
        ...(memory.detectedGaps || []),
        ...(response.detected_gaps || []),
      ])
    );
    const hasGaps = detectedGaps.length > 0;
    const masteredConcepts = new Set(memory.masteredConcepts || []);

    if (
      !hasGaps &&
      memory.currentConceptId &&
      (memory.questionDepth || 0) >= 1
    ) {
      masteredConcepts.add(memory.currentConceptId);
    }

    const updated: SocketLearningSessionState = {
      ...memory,
      currentQuestion,
      detectedGaps,
      masteredConcepts: Array.from(masteredConcepts),
      failedAttempts: hasGaps ? (memory.failedAttempts || 0) + 1 : 0,
      questionDepth:
        phase === 'start' ? 1 : (memory.questionDepth || 0) + (hasGaps ? 0 : 1),
      triggerMasteryFallback: hasGaps && (memory.failedAttempts || 0) + 1 >= 5,
    };

    sessionMemoryMap.set(sessionId, updated);
    return updated;
  };

  const resolveTurnResources = async (
    sessionId: string,
    resources?: SessionResourceMetadata[]
  ): Promise<SessionResourceMetadata[]> => {
    if (resources?.length) {
      await mergeSessionResources(sessionId, resources);
      return resources;
    }

    const metadata = await getSessionMetadata(sessionId);
    return metadata?.resources || [];
  };

  const generateAndEmitRealtimeResponse = async (params: {
    sessionId: string;
    userId: string;
    sessionState?: SocketLearningSessionState;
    resources?: SessionResourceMetadata[];
  }) => {
    const session = await getSessionById(params.sessionId);
    if (!session || session.userId !== params.userId) {
      return null;
    }

    const mergedState = mergeSessionMemory(
      params.sessionId,
      params.sessionState
    );
    const sessionResources = await resolveTurnResources(
      params.sessionId,
      params.resources
    );

    const evaluation = await generateRealtimeFeedback({
      sessionId: params.sessionId,
      subject: session.subject || undefined,
      topic: session.topic || undefined,
      resourceIds: session.resources.map(item => item.resourceId),
      sessionResources,
      goal: session.goal || undefined,
      sessionState: mergedState,
    });

    if (evaluation?.rawContent) {
      if (evaluation.structured) {
        const structured = evaluation.structured as {
          question?: string;
          detected_gaps?: string[];
        };
        updateFromAiResponse(
          params.sessionId,
          {
            question: structured.question,
            detected_gaps: structured.detected_gaps || [],
          },
          'realtime'
        );
      }
      await emitLlmResponse(
        params.sessionId,
        'realtime',
        evaluation.rawContent
      );
    }

    return evaluation;
  };

  const clearScheduledRealtimeResponse = (sessionId: string) => {
    const timer = realtimeAnalysisTimers.get(sessionId);
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    realtimeAnalysisTimers.delete(sessionId);
  };

  const scheduleRealtimeResponse = (params: {
    sessionId: string;
    userId: string;
    sessionState?: SocketLearningSessionState;
    resources?: SessionResourceMetadata[];
  }) => {
    if (realtimeAnalysisTimers.has(params.sessionId)) {
      return;
    }

    const delayMs = (env.LLM_ANALYSIS_INTERVAL || 30) * 1000;
    const timer = setTimeout(async () => {
      realtimeAnalysisTimers.delete(params.sessionId);

      try {
        await generateAndEmitRealtimeResponse(params);
      } catch (error) {
        logger.error('Realtime LLM response failed', { error });
      }
    }, delayMs);

    timer.unref?.();
    realtimeAnalysisTimers.set(params.sessionId, timer);
  };

  const handleEndSession = async (socket: Socket, payload: any, cb?: any) => {
    try {
      if (!payload?.sessionId) {
        cb?.({ ok: false, error: 'sessionId is required' });
        return;
      }

      const session = await getSessionById(payload.sessionId);
      if (!session || session.userId !== socket.data.userId) {
        cb?.({ ok: false, error: 'Session not found' });
        return;
      }

      clearScheduledRealtimeResponse(payload.sessionId);
      await endSession(payload.sessionId);
      const memory = mergeSessionMemory(
        payload.sessionId,
        payload.sessionState
      );

      const metadata = await getSessionMetadata(payload.sessionId);
      const evaluation = await ensureFinalEvaluation({
        sessionId: payload.sessionId,
        subject: session.subject || undefined,
        topic: session.topic || undefined,
        resourceIds: session.resources.map(item => item.resourceId),
        sessionResources: metadata?.resources,
        goal: session.goal || undefined,
        sessionState: memory,
      });

      if (evaluation?.rawContent) {
        await emitLlmResponse(payload.sessionId, 'end', evaluation.rawContent);
      }

      cb?.({ ok: true });
    } catch (error) {
      logger.error('Realtime session end failed', { error });
      cb?.({ ok: false, error: 'Failed to end session' });
    }
  };

  const handlePauseSession = async (socket: Socket, payload: any, cb?: any) => {
    try {
      if (!payload?.sessionId) {
        cb?.({ ok: false, error: 'sessionId is required' });
        return;
      }

      const session = await getSessionById(payload.sessionId);
      if (!session || session.userId !== socket.data.userId) {
        cb?.({ ok: false, error: 'Session not found' });
        return;
      }

      clearScheduledRealtimeResponse(payload.sessionId);
      await generateAndEmitRealtimeResponse({
        sessionId: payload.sessionId,
        userId: socket.data.userId,
        sessionState: payload.sessionState,
      });

      cb?.({ ok: true });
    } catch (error) {
      logger.error('Realtime session pause failed', { error });
      cb?.({ ok: false, error: 'Failed to pause session' });
    }
  };

  io.on('connection', socket => {
    socket.on('session:start', async (payload, cb) => {
      try {
        const session = await createSession({
          userId: socket.data.userId,
          subject: payload?.subject,
          topic: payload?.topic,
          goal: payload?.goal,
          resourceIds: payload?.resourceIds,
          resources: payload?.resources,
        });
        socket.join(session.id);
        const metadata = await getSessionMetadata(session.id);
        const selectedResourceIds = Array.from(
          new Set([
            ...(payload?.resourceIds || []),
            ...(payload?.resources || []).map(
              (resource: { id: string }) => resource.id
            ),
          ])
        );
        const startResponse = await generateSessionStartResponse({
          subject: session.subject || undefined,
          topic: session.topic || undefined,
          goal: session.goal || undefined,
          resourceIds: selectedResourceIds,
          sessionResources: metadata?.resources,
          sessionState: payload?.sessionState,
        });
        const parsedStart = JSON.parse(startResponse.content) as {
          question?: string;
        };
        mergeSessionMemory(session.id, {
          ...payload?.sessionState,
          currentQuestion: parsedStart.question || null,
          questionDepth: 1,
          failedAttempts: 0,
          triggerMasteryFallback: false,
        });
        await emitLlmResponse(session.id, 'start', startResponse.content);
        cb?.({ ok: true, session });
      } catch (error) {
        logger.error('Realtime session start failed', { error });
        cb?.({ ok: false, error: 'Failed to start session' });
      }
    });

    socket.on('session:end', (payload, cb) =>
      handleEndSession(socket, payload, cb)
    );

    socket.on('user:pause', (payload, cb) =>
      handlePauseSession(socket, payload, cb)
    );

    socket.on('user:end', (payload, cb) =>
      handleEndSession(socket, payload, cb)
    );

    socket.on('audio:chunk', async (payload, cb) => {
      try {
        const sessionId = payload?.sessionId;
        const audioBase64 = payload?.audioBase64;
        const endMes = payload?.endMessage;
        logger.debug('Received audio chunk', { sessionId, endMessage: endMes });
        if (!sessionId || !audioBase64) {
          cb?.({ ok: false, error: 'sessionId and audioBase64 are required' });
          return;
        }

        const session = await getSessionById(sessionId);
        if (!session || session.userId !== socket.data.userId) {
          cb?.({ ok: false, error: 'Session not found' });
          return;
        }
        socket.join(sessionId);

        const buffer = Buffer.from(audioBase64, 'base64');
        const transcript = await transcribeAudioBuffer({
          buffer,
          fileName: payload?.fileName || `chunk-${Date.now()}.webm`,
          mimeType: payload?.mimeType,
        });

        const chunk = await appendTranscriptChunk({
          sessionId,
          text: transcript.text,
          startTimeMs: payload?.startTimeMs,
          endTimeMs: payload?.endTimeMs,
        });

        const memory = updateFromUserText(
          sessionId,
          transcript.text,
          payload?.sessionState
        );

        io.to(sessionId).emit('transcript:chunk', {
          sessionId,
          chunk,
        });

        if (payload?.turnEnded === true) {
          scheduleRealtimeResponse({
            sessionId,
            userId: socket.data.userId,
            sessionState: memory,
            resources: payload?.resources,
          });
        }

        cb?.({ ok: true, chunk });
      } catch (error) {
        logger.error('Realtime audio chunk failed', { error });
        cb?.({ ok: false, error: 'Failed to process audio chunk' });
      }
    });

    socket.on('text:input', async (payload, cb) => {
      try {
        const sessionId = payload?.sessionId;
        const text = payload?.text;

        if (!sessionId || !text) {
          cb?.({ ok: false, error: 'sessionId and text are required' });
          return;
        }

        const session = await getSessionById(sessionId);
        if (!session || session.userId !== socket.data.userId) {
          cb?.({ ok: false, error: 'Session not found' });
          return;
        }
        socket.join(sessionId);

        await handleTextInput({
          sessionId,
          userId: socket.data.userId,
          text,
        });

        const chunk = await appendTranscriptChunk({
          sessionId,
          text: preprocessTranscriptText(text),
          startTimeMs: payload?.startTimeMs,
          endTimeMs: payload?.endTimeMs,
        });

        const memory = updateFromUserText(
          sessionId,
          text,
          payload?.sessionState
        );

        io.to(sessionId).emit('transcript:chunk', {
          sessionId,
          chunk,
        });

        scheduleRealtimeResponse({
          sessionId,
          userId: socket.data.userId,
          sessionState: memory,
          resources: payload?.resources,
        });

        cb?.({ ok: true, chunk });
      } catch (error) {
        logger.error('Realtime text input failed', { error });
        cb?.({ ok: false, error: 'Failed to process text input' });
      }
    });
  });
};
