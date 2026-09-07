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
} from "../services/auth.js";

const email = `auth-test-${Date.now()}@example.test`;

describe("email authentication", () => {
  it("normalizes emails and issues hashed bearer sessions", async () => {
    expect(normalizeEmail("  Hiker@Example.TEST ")).toBe("hiker@example.test");

    const registration = await registerUser(
      "Test Hiker",
      email,
      "correct horse battery",
    );
    expect(registration.user.email).toBe(email);
    expect(registration.user.password).toBe("");
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

  it("logs in and rotates refresh tokens", async () => {
    const login = await loginUser(email, "correct horse battery");
    const rotated = await refreshSession(login.tokens.refreshToken);

    expect(rotated.user.id).toBe(login.user.id);
    expect(rotated.tokens.refreshToken).not.toBe(login.tokens.refreshToken);
    await expect(refreshSession(login.tokens.refreshToken)).rejects.toThrow(
      "INVALID_REFRESH_TOKEN",
    );

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
});

afterAll(async () => {
  const user = await User.findOne({ where: { email } });
  if (user) {
    await AuthSession.destroy({ where: { userId: user.id } });
    await user.destroy();
  }
});
