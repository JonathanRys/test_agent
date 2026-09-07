import { Router } from "express";
import { z } from "zod";
import { requireUser } from "../middleware/auth.js";
import {
  loginUser,
  normalizeEmail,
  publicUser,
  refreshSession,
  registerUser,
  revokeSession,
} from "../services/auth.js";

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const authRouter = Router();

authRouter.post("/auth/register", async (req, res, next) => {
  try {
    const body = credentials
      .extend({ name: z.string().trim().min(1).max(100) })
      .parse(req.body);
    const result = await registerUser(
      body.name,
      normalizeEmail(body.email),
      body.password,
    );
    res
      .status(201)
      .json({ ok: true, user: publicUser(result.user), ...result.tokens });
  } catch (error) {
    if (error instanceof Error && error.message === "ACCOUNT_EXISTS") {
      res
        .status(409)
        .json({ ok: false, error: "An account already exists for that email" });
      return;
    }
    next(error);
  }
});

authRouter.post("/auth/login", async (req, res, next) => {
  try {
    const body = credentials.parse(req.body);
    const result = await loginUser(body.email, body.password);
    res.json({ ok: true, user: publicUser(result.user), ...result.tokens });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CREDENTIALS") {
      res.status(401).json({ ok: false, error: "Invalid email or password" });
      return;
    }
    next(error);
  }
});

authRouter.post("/auth/refresh", async (req, res, next) => {
  try {
    const refreshToken = z.string().min(1).parse(req.body?.refreshToken);
    const result = await refreshSession(refreshToken);
    res.json({ ok: true, user: publicUser(result.user), ...result.tokens });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_REFRESH_TOKEN") {
      res.status(401).json({ ok: false, error: "Invalid refresh token" });
      return;
    }
    next(error);
  }
});

authRouter.post("/auth/logout", requireUser, async (req, res, next) => {
  try {
    await revokeSession(req.authSession!);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/auth/me", requireUser, (req, res) => {
  res.json({ ok: true, user: publicUser(req.user!) });
});
