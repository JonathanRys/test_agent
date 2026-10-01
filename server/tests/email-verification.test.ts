import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { env } from "../config/env.js";
import { AuthSession, EmailVerificationToken, User } from "../models/index.js";
import { hashToken, registerUser } from "../services/auth.js";
import { sendVerificationEmail, verifyEmailToken } from "../services/emailVerification.js";

const email = `verification-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
let userId: number | undefined;

describe("email verification tokens", () => {
  it("verifies an account and consumes its token", async () => {
    const { user } = await registerUser("Verification Hiker", email, "correct horse battery");
    userId = user.id;
    const token = randomBytes(32).toString("base64url");
    const record = await EmailVerificationToken.create({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 60_000),
    });

    const verifiedUser = await verifyEmailToken(token);

    expect(verifiedUser.emailVerifiedAt).toBeInstanceOf(Date);
    await record.reload();
    expect(record.consumedAt).toBeInstanceOf(Date);
    await expect(verifyEmailToken(token)).rejects.toThrow(
      "INVALID_EMAIL_VERIFICATION_TOKEN",
    );
  });

  it("rejects expired verification tokens", async () => {
    const user = await User.findOne({ where: { email } });
    const token = randomBytes(32).toString("base64url");
    await EmailVerificationToken.create({
      userId: user!.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() - 1),
    });

    await expect(verifyEmailToken(token)).rejects.toThrow(
      "INVALID_EMAIL_VERIFICATION_TOKEN",
    );
  });

  it("logs a usable verification URL in development without SMTP", async () => {
    const devEmail = `verification-dev-${Date.now()}@example.test`;
    const { user } = await registerUser("Local Hiker", devEmail, "correct horse battery");
    const previousEnv = {
      NODE_ENV: env.NODE_ENV,
      SMTP_HOST: env.SMTP_HOST,
      SMTP_USER: env.SMTP_USER,
      SMTP_PASS: env.SMTP_PASS,
      EMAIL_FROM: env.EMAIL_FROM,
    };
    const logSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    Object.assign(env, {
      NODE_ENV: "development",
      SMTP_HOST: undefined,
      SMTP_USER: undefined,
      SMTP_PASS: undefined,
      EMAIL_FROM: undefined,
    });

    try {
      await expect(sendVerificationEmail(user)).resolves.toBe("console");
      const logMessage = String(logSpy.mock.calls[0]?.[0]);
      expect(logMessage).toContain(devEmail);
      const loggedUrl = logMessage.match(/https?:\/\/\S+/)?.[0];
      expect(loggedUrl).toBeTruthy();
      const token = new URL(loggedUrl!).searchParams.get("token");
      expect(token).toBeTruthy();
      const verified = await verifyEmailToken(token!);
      expect(verified.emailVerifiedAt).toBeInstanceOf(Date);
    } finally {
      Object.assign(env, previousEnv);
      logSpy.mockRestore();
      await EmailVerificationToken.destroy({ where: { userId: user.id } });
      await AuthSession.destroy({ where: { userId: user.id } });
      await user.destroy();
    }
  });

  it("does not use console delivery outside local development", async () => {
    const { user } = await registerUser(
      "Production Hiker",
      `verification-production-${Date.now()}@example.test`,
      "correct horse battery",
    );
    const previousEnv = {
      NODE_ENV: env.NODE_ENV,
      SMTP_HOST: env.SMTP_HOST,
      SMTP_USER: env.SMTP_USER,
      SMTP_PASS: env.SMTP_PASS,
      EMAIL_FROM: env.EMAIL_FROM,
    };
    Object.assign(env, {
      NODE_ENV: "production",
      SMTP_HOST: undefined,
      SMTP_USER: undefined,
      SMTP_PASS: undefined,
      EMAIL_FROM: undefined,
    });

    try {
      await expect(sendVerificationEmail(user)).rejects.toThrow(
        "EMAIL_DELIVERY_NOT_CONFIGURED",
      );
    } finally {
      Object.assign(env, previousEnv);
      await EmailVerificationToken.destroy({ where: { userId: user.id } });
      await AuthSession.destroy({ where: { userId: user.id } });
      await user.destroy();
    }
  });
});

afterAll(async () => {
  if (userId === undefined) return;
  await EmailVerificationToken.destroy({ where: { userId } });
  await AuthSession.destroy({ where: { userId } });
  const user = await User.findByPk(userId);
  if (user) await user.destroy();
});