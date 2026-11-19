import { Request, Response } from 'express';
import passport from 'passport';
import logger from '#config/logger.ts';
import '../config/google.config.ts';
import { createUser, findUserByEmail } from '#src/services/user.service.ts';

import {
  clearTokens,
  createRandomToken,
  generateTokens,
  hashTokenCrypto,
  saveToCookie,
  verifyRefreshToken,
} from '#src/utils/jwt/tokens.ts';
import {
  deleteAllRefreshTokens,
  deleteCurrentRefreshToken,
  findRefreshToken,
  revokeSession,
  saveRefreshToken,
} from '#src/services/token.service.ts';
import { hashing, verifyHash } from '#src/utils/auth/hash.ts';
import { AuthRequest } from '#src/types/authRequest.js';
import {
  invalidateCache,
  makeUserSessionCacheKey,
  setCache,
} from '#src/utils/redis.ts';
import {
  consumeOAuthExchange,
  createOAuthExchange,
} from '#src/services/oauth-exchange.service.ts';
import z from 'zod';
import { ReturnUserDto } from '#src/types/user.js';
import {
  sendVerificationEmail,
  sendWelcomeEmail,
} from '#src/utils/mail/sendMail.ts';
import { sendApiError, sendApiSuccess } from '#src/utils/api-response.ts';

// A revoked/rotated-out refresh token is rejected by findRefreshToken's
// isActive+expiresAt check, so a stolen or replayed old token can no
// longer be used to mint new tokens after rotation.
export const refresh = async (req: Request, res: Response) => {
  const { refreshToken } = req.cookies;
  const { ip, 'user-agent': userAgent } = req.headers;

  // Validate refresh token
  if (!refreshToken) {
    return sendApiError(res, { status: 401, message: 'Refresh token missing' });
  }

  // Checking the refreshes token validity from the token itself
  const userId: string | null = await verifyRefreshToken(refreshToken);
  if (!userId) {
    return sendApiError(res, { status: 401, message: 'Invalid refresh token' });
  }

  // Check if refresh token exists in DB and is active
  const hashRT = hashTokenCrypto(refreshToken);
  const storedToken = await findRefreshToken(hashRT);

  if (!storedToken) {
    return sendApiError(res, { status: 401, message: 'Invalid Refresh Token' });
  }

  // Revoking old refresh token and session
  await revokeSession(userId, storedToken.sessionId);
  await invalidateCache(
    makeUserSessionCacheKey(userId, storedToken.sessionId),
    userId
  );

  // Generate new tokens and save to DB and cookies
  const newSessionId = createRandomToken();
  const newCacheKey = makeUserSessionCacheKey(userId, newSessionId);
  const { accessToken, refreshToken: newRefreshToken } = await generateTokens(
    userId,
    newSessionId
  );
  await setCache(newCacheKey, userId, newRefreshToken);

  const hashedRefreshToken = hashTokenCrypto(newRefreshToken);
  await saveRefreshToken(
    userId,
    hashedRefreshToken,
    newSessionId,
    userAgent,
    ip as string
  );

  await saveToCookie(res, newRefreshToken, accessToken);
  sendApiSuccess(res, { message: 'Token refreshed' });
};

export const signup = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return sendApiError(res, {
        status: 400,
        message: 'Email, password and name are required',
      });
    }

    const user = await findUserByEmail(email);
    if (user) {
      const hasPassword = Boolean(user.passwordHash?.trim());

      // Never set a password on an existing account from an unauthenticated
      // signup request: doing so let anyone take over a Google-linked
      // account just by knowing its email. Ownership of a passwordless
      // account must be proven via the forgot-password email flow instead.
      return sendApiError(res, {
        status: 400,
        message: hasPassword
          ? 'User already exists'
          : 'An account with this email already exists. Use "Forgot password" to set a password for it.',
      });
    }

    const hashedPassword = await hashing(password);
    const verificationToken = createRandomToken();

    const newUser: ReturnUserDto = await createUser({
      ...req.body,
      passwordHash: hashedPassword,
      verificationToken,
      verificationTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      verificationTokenPurpose: 'EMAIL_VERIFICATION',
    });

    // TODO: Test
    sendVerificationEmail({
      to: newUser.email,
      userName: newUser.name,
      verificationLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/verify-email?token=${verificationToken}`,
      expiryMinutes: 1440, // 24 hours
    }).catch(err =>
      logger.error('Verification email failed (non-fatal)', { error: err })
    );

    sendApiSuccess(res, {
      status: 201,
      message: 'User registered successfully',
      data: { user: newUser },
    });
  } catch (error) {
    logger.error('Signup failed', { operation: 'signup', error });
    sendApiError(res, { status: 500, message: 'user creation failed' });
  }
};

export const signin = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const { ip, 'user-agent': userAgent } = req.headers;
  if (!email || !password) {
    return sendApiError(res, {
      status: 400,
      message: 'Email and password are required',
    });
  }

  const user = await findUserByEmail(email);

  // Normalize response to avoid user enumeration (don't reveal whether email exists)
  if (!user) {
    return sendApiError(res, {
      status: 400,
      message: 'Invalid email or password',
    });
  }

  const isPasswordValid = await verifyHash(
    user.passwordHash as string,
    password
  );
  if (!isPasswordValid) {
    return sendApiError(res, {
      status: 400,
      message: 'Invalid email or password',
    });
  }

  const sessionId = createRandomToken();

  const { accessToken, refreshToken } = await generateTokens(
    user.id,
    sessionId
  );
  const hashedRefreshToken = hashTokenCrypto(refreshToken);

  await saveRefreshToken(
    user.id,
    hashedRefreshToken,
    sessionId,
    userAgent,
    ip as string
  );

  await saveToCookie(res, refreshToken, accessToken);

  const secureUser: ReturnUserDto = {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatarUrl || undefined,
    emailVerified: user.emailVerified,
    isActive: user.isActive,
    userBodyImageUrl: user.userBodyImageUrl || undefined,
    age: user.age || undefined,
  };

  sendApiSuccess(res, {
    message: 'Signin successful',
    data: {
      user: secureUser,
      accessToken,
      refreshToken,
    },
  });
};

// @desc    Signout user and invalidate refresh token
// @route   GET /auth/signout
export const signout = async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    return sendApiError(res, {
      status: 401,
      message: 'User not authenticated',
    });
  }
  const { userId, sessionId } = req;

  // Invalidate session and cache
  if (sessionId) {
    await deleteCurrentRefreshToken(sessionId || '');
    await revokeSession(userId, sessionId);
    await invalidateCache(makeUserSessionCacheKey(userId, sessionId), userId);
  } else {
    // delete all refresh tokens for the user if no sessionId is found (edge case)
    await deleteAllRefreshTokens(userId);
  }

  // Clear cookies
  await clearTokens(res);

  req.logout(err => {
    if (err)
      return sendApiError(res, { status: 500, message: 'Signout failed' });
    req.session.destroy(err => {
      if (err) {
        return sendApiError(res, { status: 500, message: 'Signout failed' });
      }

      sendApiSuccess(res, { message: 'Signout success' });
    });
  });
};

// @desc    Initiate Google OAuth2 login
// @route   GET /auth/google
export const googleAuth = passport.authenticate('google', {
  scope: ['email', 'profile'],
});

// @desc    Handle Google OAuth2 callback
// @route   GET /api/auth/google/callback
export const googleAuthCallback = [
  passport.authenticate('google', {
    session: false, // important if you're using JWT instead of sessions
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/failure`,
  }),
  async (req: Request, res: Response) => {
    try {
      const user = req.user as ReturnUserDto;
      if (!user) {
        return sendApiError(res, {
          status: 401,
          message: 'Authentication failed',
        });
      }

      const newSessionId = createRandomToken();
      const code = await createOAuthExchange({
        user,
        sessionId: newSessionId,
      });

      // Tokens are issued only by the server-side exchange route. The browser
      // receives a short-lived, single-use code instead of credentials.
      const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(
        `${frontend}/api/auth/google/callback?code=${encodeURIComponent(code)}`
      );
    } catch (error) {
      logger.error('Google auth callback failed', { operation: 'oauth-callback', error });
      const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontend}/auth/failure`);
    }
  },
];

export const exchangeGoogleCode = async (req: Request, res: Response) => {
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  const exchange = await consumeOAuthExchange(code);

  if (!exchange) {
    return sendApiError(res, {
      status: 400,
      message: 'Invalid or expired authorization code',
    });
  }

  try {
    const { ip, 'user-agent': userAgent } = req.headers;
    const { accessToken, refreshToken } = await generateTokens(
      exchange.user.id,
      exchange.sessionId
    );
    const hashedRefreshToken = hashTokenCrypto(refreshToken);

    await saveRefreshToken(
      exchange.user.id,
      hashedRefreshToken,
      exchange.sessionId,
      userAgent,
      ip as string
    );
    await setCache(
      makeUserSessionCacheKey(exchange.user.id, exchange.sessionId),
      exchange.user.id,
      refreshToken
    );

    return sendApiSuccess(res, {
      data: {
        user: exchange.user,
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    logger.error('Google authorization code exchange failed', {
      operation: 'oauth-exchange',
      error,
    });
    return sendApiError(res, {
      status: 500,
      message: 'Authentication exchange failed',
    });
  }
};

// @desc    Google OAuth2 failure route
// @route   GET /auth/google/failure
// todo: keep one failure route
export const googleAuthFailure = async (req: Request, res: Response) => {
  const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
  res.redirect(`${frontend}/auth/failure`);
};
