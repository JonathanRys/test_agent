import { randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { EmailVerificationToken, User } from "../models/index.js";
import { hashToken } from "./auth.js";
import { ensureInitialized } from "../utils/db.js";

const EMAIL_VERIFICATION_LIFETIME_MS = 24 * 60 * 60 * 1000;

function createTransport() {
  if (!env.SMTP_HOST || !env.EMAIL_FROM || Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASS)) {
    throw new Error("EMAIL_DELIVERY_NOT_CONFIGURED");
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER && env.SMTP_PASS
      ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
      : undefined,
  });
}

export async function sendVerificationEmail(user: User): Promise<void> {
  await ensureInitialized();
  if (user.emailVerifiedAt) throw new Error("EMAIL_ALREADY_VERIFIED");
  const transport = createTransport();
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await EmailVerificationToken.update(
    { consumedAt: now },
    { where: { userId: user.id, consumedAt: null } },
  );
  const verificationToken = await EmailVerificationToken.create({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(now.getTime() + EMAIL_VERIFICATION_LIFETIME_MS),
  });
  const verificationUrl = new URL("/verify-email", env.CLIENT_URL);
  verificationUrl.searchParams.set("token", token);

  try {
    await transport.sendMail({
      from: env.EMAIL_FROM,
      to: user.email,
      subject: "Verify your email address",
      text: `Hello ${user.name},\n\nConfirm your email address by visiting this link within 24 hours:\n${verificationUrl.toString()}\n\nIf you did not expect this message, you can ignore it.`,
    });
  } catch (error) {
    verificationToken.consumedAt = new Date();
    await verificationToken.save();
    throw error;
  }
}

export async function verifyEmailToken(token: string): Promise<User> {
  await ensureInitialized();
  const verificationToken = await EmailVerificationToken.findOne({
    where: { tokenHash: hashToken(token), consumedAt: null },
    include: [{ model: User }],
  });
  if (!verificationToken || verificationToken.expiresAt.getTime() <= Date.now()) {
    throw new Error("INVALID_EMAIL_VERIFICATION_TOKEN");
  }

  const user = verificationToken.get("User") as User;
  user.emailVerifiedAt ??= new Date();
  await user.save();
  const now = new Date();
  await EmailVerificationToken.update(
    { consumedAt: now },
    { where: { userId: user.id, consumedAt: null } },
  );
  return user;
}