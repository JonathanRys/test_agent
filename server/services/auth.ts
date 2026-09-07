import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { AuthSession, User } from "../models/index.js";
import { ensureInitialized } from "../utils/db.js";

const ACCESS_LIFETIME_MS = 15 * 60 * 1000;
const REFRESH_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createToken(): string {
  return randomBytes(32).toString("base64url");
}

export function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
    birthdate: user.birthdate,
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
    password: "",
    passwordHash: await bcrypt.hash(password, 12),
  });
  return { user, tokens: await issueSession(user) };
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

  session.revokedAt = new Date();
  await session.save();
  const user = session.get("User") as User;
  return { user, tokens: await issueSession(user) };
}

export async function revokeSession(session: AuthSession): Promise<void> {
  session.revokedAt = new Date();
  await session.save();
}
