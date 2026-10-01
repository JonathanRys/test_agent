import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { AuthSession, EmailVerificationToken, User } from "../models/index.js";
import { hashToken, registerUser } from "../services/auth.js";
import { verifyEmailToken } from "../services/emailVerification.js";

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
});

afterAll(async () => {
  if (userId === undefined) return;
  await EmailVerificationToken.destroy({ where: { userId } });
  await AuthSession.destroy({ where: { userId } });
  const user = await User.findByPk(userId);
  if (user) await user.destroy();
});