import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { AuthSession, PasswordResetToken, User } from "../models/index.js";
import { ensureInitialized } from "../utils/db.js";

const ACCESS_LIFETIME_MS = 15 * 60 * 1000;
const REFRESH_LIFETIME_MS = 60 * 60 * 1000;
const PASSWORD_RESET_LIFETIME_MS = 60 * 60 * 1000;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
  };
}

async function issueSession(user: User) {
  const accessToken = createToken();
  const refreshToken = createToken();
  await AuthSession.create({
    userId: user.id,
    accessTokenHash: hashToken(accessToken),
    refreshTokenHash: hashToken(refreshToken),
    accessExpiresAt: new Date(Date.now() + ACCESS_LIFETIME_MS),
    refreshExpiresAt: new Date(Date.now() + REFRESH_LIFETIME_MS),
  });
  return { accessToken, refreshToken };
}

async function issueAccessToken(session: AuthSession, user: User) {
  const accessToken = createToken();
  session.accessTokenHash = hashToken(accessToken);
  session.accessExpiresAt = new Date(Date.now() + ACCESS_LIFETIME_MS);
  session.refreshExpiresAt = new Date(Date.now() + REFRESH_LIFETIME_MS);
  await session.save();
  return { accessToken, refreshToken: undefined, user };
}

export async function registerUser(
  name: string,
  email: string,
  password: string,
) {
  await ensureInitialized();
  const normalizedEmail = normalizeEmail(email);
  const existing = await User.findOne({ where: { email: normalizedEmail } });
  if (existing) throw new Error("ACCOUNT_EXISTS");

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: await hashPassword(password),
  });
  return { user, tokens: await issueSession(user) };
}

export async function requestPasswordReset(
  email: string,
): Promise<string | null> {
  await ensureInitialized();
  const user = await User.findOne({ where: { email: normalizeEmail(email) } });
  if (!user) return null;

  const token = createToken();
  await PasswordResetToken.create({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + PASSWORD_RESET_LIFETIME_MS),
  });
  return token;
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<User> {
  await ensureInitialized();
  const resetToken = await PasswordResetToken.findOne({
    where: { tokenHash: hashToken(token), consumedAt: null },
    include: [{ model: User }],
  });
  if (!resetToken || resetToken.expiresAt.getTime() <= Date.now()) {
    throw new Error("INVALID_PASSWORD_RESET_TOKEN");
  }

  const user = resetToken.get("User") as User;
  user.passwordHash = await hashPassword(password);
  await user.save();
  resetToken.consumedAt = new Date();
  await resetToken.save();
  await AuthSession.update(
    { revokedAt: new Date() },
    { where: { userId: user.id, revokedAt: null } },
  );
  return user;
}

export async function loginUser(email: string, password: string) {
  await ensureInitialized();
  const user = await User.findOne({ where: { email: normalizeEmail(email) } });
  const valid = user?.passwordHash
    ? await bcrypt.compare(password, user.passwordHash)
    : false;
  if (!user || !valid) throw new Error("INVALID_CREDENTIALS");
  return { user, tokens: await issueSession(user) };
}

export async function refreshSession(refreshToken: string) {
  await ensureInitialized();
  const session = await AuthSession.findOne({
    where: { refreshTokenHash: hashToken(refreshToken), revokedAt: null },
    include: [{ model: User }],
  });
  if (!session || session.refreshExpiresAt.getTime() <= Date.now()) {
    throw new Error("INVALID_REFRESH_TOKEN");
  }

  const user = session.get("User") as User;
  const tokens = await issueAccessToken(session, user);
  return {
    user,
    tokens: {
      accessToken: tokens.accessToken,
      refreshToken,
    },
  };
}

export async function revokeSession(session: AuthSession): Promise<void> {
  session.revokedAt = new Date();
  await session.save();
}
