import type { NextFunction, Request, Response } from "express";
import { AuthSession, User } from "../models/index.js";
import { ensureInitialized } from "../utils/db.js";
import { hashToken } from "../services/auth.js";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      authSession?: AuthSession;
    }
  }
}

async function authenticate(req: Request): Promise<void> {
  await ensureInitialized();
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return;

  const token = header.slice("Bearer ".length).trim();
  if (!token) return;

  const session = await AuthSession.findOne({
    where: { accessTokenHash: hashToken(token), revokedAt: null },
    include: [{ model: User }],
  });
  if (!session || session.accessExpiresAt.getTime() <= Date.now()) return;

  req.authSession = session;
  req.user = session.get("User") as User;
}

export async function optionalUser(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await authenticate(req);
    next();
  } catch (error) {
    next(error);
  }
}

export async function requireUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await authenticate(req);
    if (!req.user) {
      res.status(401).json({ ok: false, error: "Authentication required" });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}
