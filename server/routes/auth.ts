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
  requestPasswordReset,
  resetPassword,
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

authRouter.post("/auth/forgot-password", async (req, res, next) => {
  try {
    const email = z.string().email().parse(req.body?.email);
    const token = await requestPasswordReset(email);
    if (token && process.env.NODE_ENV !== "production") {
      console.info(
        `Password reset link: ${process.env.CLIENT_URL ?? "http://localhost:5173"}/reset-password?token=${token}`,
      );
    }
    res.json({
      ok: true,
      message: "If that email exists, a reset link has been sent.",
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/auth/reset-password", async (req, res, next) => {
  try {
    const body = credentials
      .omit({ email: true })
      .extend({ token: z.string().min(1) })
      .parse(req.body);
    const user = await resetPassword(body.token, body.password);
    res.json({ ok: true, user: publicUser(user) });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "INVALID_PASSWORD_RESET_TOKEN"
    ) {
      res
        .status(400)
        .json({ ok: false, error: "Invalid or expired reset link" });
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
