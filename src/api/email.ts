import { Resend } from 'resend';
import { readFileSync } from 'fs';

let cachedKey: string | undefined;

async function getApiKey(): Promise<string> {
  if (cachedKey) return cachedKey;

  const envKey =
    (typeof process !== 'undefined' && process.env?.RESEND_API_KEY) ||
    (globalThis as any).__RESEND_API_KEY;
  if (envKey) {
    cachedKey = envKey;
    return cachedKey;
  }

  try {
    const raw = readFileSync('.dev.vars', 'utf-8');
    const line = raw.split('\n').find((l) => l.trim().startsWith('RESEND_API_KEY='));
    if (line) {
      cachedKey = line.slice(line.indexOf('=') + 1).trim();
      return cachedKey;
    }
  } catch {}

  throw new Error('RESEND_API_KEY is not set (checked env and .dev.vars)');
}

const FROM = 'CareWork <onboarding@resend.dev>';

export async function sendVerificationEmail(to: string, fullName: string, verifyUrl: string): Promise<void> {
  const apiKey = await getApiKey();
  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: 'Verify your CareWork email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
        <h1 style="color: #00A3E0; font-family: Georgia, serif;">Welcome to CareWork, ${fullName}!</h1>
        <p>Thanks for signing up. Please confirm your email address by clicking the button below:</p>
        <p style="text-align: center; margin: 32px 0;">
          <a href="${verifyUrl}" style="background: #00A3E0; color: #fff; padding: 14px 32px; border-radius: 999px; text-decoration: none; font-weight: bold; display: inline-block;">Verify my email</a>
        </p>
        <p style="color: #61707B; font-size: 0.9em;">Or paste this link into your browser:<br>${verifyUrl}</p>
        <p style="color: #61707B; font-size: 0.85em; margin-top: 32px;">If you didn't sign up for CareWork, ignore this email.</p>
      </div>
    `,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}

export async function sendPasswordResetEmail(to: string, fullName: string, resetUrl: string): Promise<void> {
  const apiKey = await getApiKey();
  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: 'Reset your CareWork password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
        <h1 style="color: #00A3E0; font-family: Georgia, serif;">Reset your password</h1>
        <p>Hi ${fullName},</p>
        <p>We received a request to reset your CareWork password. Click the button below to choose a new one:</p>
        <p style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}" style="background: #00A3E0; color: #fff; padding: 14px 32px; border-radius: 999px; text-decoration: none; font-weight: bold; display: inline-block;">Reset password</a>
        </p>
        <p style="color: #61707B; font-size: 0.9em;">Or paste this link into your browser:<br>${resetUrl}</p>
        <p style="color: #61707B; font-size: 0.85em; margin-top: 32px;">If you didn't request this, ignore this email — your password won't change.</p>
      </div>
    `,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}