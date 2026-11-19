import nodemailer from 'nodemailer';
import nodemailerTransporter from '#src/config/nodemailer.config.ts';
import logger from '#config/logger.ts';
import { VerificationEmailProps, WelcomeEmailProps } from '#src/types/email.js';
import {
  generateVerificationEmail,
  generateWelcomeEmail,
} from './mailTemplates.ts';

/**
 * The From address for outgoing mail.
 *
 * EMAIL_USER is the SMTP *username*, which is only coincidentally an
 * address with providers such as Gmail. Providers like Resend use a
 * username ("resend") that is not an address at all, and using it as the
 * From header produces an invalid sender that the provider rejects.
 *
 * EMAIL_FROM is therefore preferred, falling back to EMAIL_USER so
 * existing Gmail-style configurations keep working unchanged. It accepts
 * a bare address or a display form: "Feynman AI" <noreply@example.com>
 */
const getFromAddress = (): string | undefined =>
  process.env.EMAIL_FROM || process.env.EMAIL_USER;

export const shouldLogEmailPreview = (): boolean =>
  process.env.NODE_ENV !== 'production' &&
  process.env.EMAIL_PREVIEW_LOGGING === 'true';

export const sendVerificationEmail = async ({
  to,
  userName,
  otpCode = '',
  verificationLink,
  expiryMinutes,
}: VerificationEmailProps & { to: string }) => {
  try {
    const html = generateVerificationEmail({
      userName,
      otpCode,
      verificationLink,
      expiryMinutes,
    });
    const mailer = await nodemailerTransporter();
    const info = await mailer.sendMail({
      from: getFromAddress(),
      to,
      subject: 'Verification Code for Your Account',
      html,
    });
    if (shouldLogEmailPreview()) {
      logger.info('[Mailer] Email preview generated', { available: Boolean(nodemailer.getTestMessageUrl(info)) });
    }
  } catch (error) {
    logger.error('Error sending email', { error });
    throw new Error('Failed to send verification email');
  }
};

export const sendWelcomeEmail = async ({
  to,
  userName,
  dashboardLink,
}: WelcomeEmailProps & { to: string }) => {
  try {
    const html = generateWelcomeEmail({
      userName,
      dashboardLink,
    });
    const mailer = await nodemailerTransporter();
    const info = await mailer.sendMail({
      from: getFromAddress(),
      to,
      subject: 'Welcome to Your Account',
      html,
    });
    if (shouldLogEmailPreview()) {
      logger.info('[Mailer] Email preview generated', { available: Boolean(nodemailer.getTestMessageUrl(info)) });
    }
  } catch (error) {
    logger.error('Error sending email', { error });
    throw new Error('Failed to send welcome email');
  }
};

export const sendPasswordResetEmail = async ({
  to,
  userName,
  expiryMinutes,
  resetLink,
  supportEmail = process.env.SUPPORT_EMAIL || 'support@tryora.com',
}: VerificationEmailProps & { to: string; resetLink: string }) => {
  try {
    const html = generateVerificationEmail({
      userName,
      verificationLink: resetLink,
      expiryMinutes,
      supportEmail,
    });
    const mailer = await nodemailerTransporter();
    const info = await mailer.sendMail({
      from: getFromAddress(),
      to,
      subject: 'Password Reset Request',
      html,
    });
    if (shouldLogEmailPreview()) {
      logger.info('[Mailer] Email preview generated', { available: Boolean(nodemailer.getTestMessageUrl(info)) });
    }
  } catch (error) {
    logger.error('Error sending email', { error });
    throw new Error('Failed to send password reset email');
  }
};
