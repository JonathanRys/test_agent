import bcrypt from "bcryptjs";
import { afterAll, describe, expect, it } from "vitest";
import { AuthSession, User } from "../models/index.js";
import {
  hashToken,
  loginUser,
  normalizeEmail,
  publicUser,
  refreshSession,
  registerUser,
  revokeSession,
  hashPassword,
} from "../services/auth.js";

const email = `auth-test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;

describe("email authentication", () => {
  it("normalizes emails and issues hashed bearer sessions", async () => {
    expect(normalizeEmail("  Hiker@Example.TEST ")).toBe("hiker@example.test");

    const registration = await registerUser(
      "Test Hiker",
      email,
      "correct horse battery",
    );
    expect(registration.user.email).toBe(email);
    expect(registration.user.passwordHash).toBeTruthy();
    expect(registration.tokens.accessToken).not.toBe(
      hashToken(registration.tokens.accessToken),
    );

    const session = await AuthSession.findOne({
      where: { userId: registration.user.id },
    });
    expect(session?.accessTokenHash).toBe(
      hashToken(registration.tokens.accessToken),
    );
  });

  it("refreshes a session without breaking another browser window", async () => {
    const login = await loginUser(email, "correct horse battery");
    const rotated = await refreshSession(login.tokens.refreshToken);

    expect(rotated.user.id).toBe(login.user.id);
    expect(rotated.tokens.refreshToken).toBe(login.tokens.refreshToken);
    const secondWindow = await refreshSession(login.tokens.refreshToken);
    expect(secondWindow.user.id).toBe(login.user.id);

    const session = await AuthSession.findOne({
      where: { refreshTokenHash: hashToken(rotated.tokens.refreshToken) },
    });
    await revokeSession(session!);
    await expect(refreshSession(rotated.tokens.refreshToken)).rejects.toThrow(
      "INVALID_REFRESH_TOKEN",
    );
  });

  it("rejects duplicate normalized emails and invalid passwords", async () => {
    await expect(
      registerUser("Another Hiker", email.toUpperCase(), "different password"),
    ).rejects.toThrow("ACCOUNT_EXISTS");
    await expect(loginUser(email, "wrong password")).rejects.toThrow(
      "INVALID_CREDENTIALS",
    );
  });

  it("does not expose password fields in public user data", async () => {
    const user = await User.findOne({ where: { email } });
    const serialized = publicUser(user!);
    expect(serialized).not.toHaveProperty("password");
    expect(serialized).not.toHaveProperty("passwordHash");
  });

  it("uses a random salt for each password hash", async () => {
    const password = "correct horse battery";
    const firstHash = await hashPassword(password);
    const secondHash = await hashPassword(password);

    expect(firstHash).not.toBe(secondHash);
    expect(firstHash).toMatch(/^\$2[ab]\$12\$/);
    expect(await bcrypt.compare(password, firstHash)).toBe(true);
    expect(await bcrypt.compare(password, secondHash)).toBe(true);
  });

  it("uses a one-hour sliding refresh expiration", async () => {
    const login = await loginUser(email, "correct horse battery");
    const sessionBefore = await AuthSession.findOne({
      where: { refreshTokenHash: hashToken(login.tokens.refreshToken) },
    });
    const before = sessionBefore!.refreshExpiresAt.getTime();

    await new Promise((resolve) => setTimeout(resolve, 5));
    await refreshSession(login.tokens.refreshToken);

    const sessionAfter = await AuthSession.findOne({
      where: { refreshTokenHash: hashToken(login.tokens.refreshToken) },
    });
    expect(sessionAfter!.refreshExpiresAt.getTime()).toBeGreaterThan(before);
    expect(
      sessionAfter!.refreshExpiresAt.getTime() - Date.now(),
    ).toBeLessThanOrEqual(60 * 60 * 1000);
  });
});

afterAll(async () => {
  const user = await User.findOne({ where: { email } });
  if (user) {
    await AuthSession.destroy({ where: { userId: user.id } });
    await user.destroy();
  }
});
