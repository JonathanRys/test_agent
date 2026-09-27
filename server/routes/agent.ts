import { Router, Request, Response, NextFunction } from "express";
import OpenAI from "openai";
import { z } from "zod";
import { generateAgentReplyStream } from "../services/openrouter.js";
import { env } from "../config/env.js";
import { requireUser } from "../middleware/auth.js";
import {
  getSessionPromptContext,
  getSessionMessages,
  addMessageToSession,
  toggleMemoryType,
  getSessionMemoryType,
  getUserSessions,
} from "../services/memory.js";
import { touchUserAgentContext } from "../services/userContext.js";

const payloadSchema = z.object({
  prompt: z.string().min(1).max(4000),
  sessionId: z.string().optional(),
});

export const agentRouter = Router();
agentRouter.use(requireUser);

agentRouter.post(
  "/chat",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requestStartedAt = Date.now();
      const body = payloadSchema.parse(req.body);
      const sessionId = body.sessionId ?? "default";

      const contextStartedAt = Date.now();
      const history = await getSessionPromptContext(sessionId, req.user!.id);
      console.info("agent.context.request", {
        durationMs: Date.now() - contextStartedAt,
        characters: history.length,
      });
      const prompt = [history, `user: ${body.prompt}`]
        .filter(Boolean)
        .join("\n");

      res.status(200);
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();
      const sendEvent = (event: string, data: unknown) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };
      const replyContent = await generateAgentReplyStream(
        prompt,
        req.user?.id,
        (token) => sendEvent("token", { token }),
        // Gate tool offers on the raw user turn only: the history-prefixed
        // prompt accumulates recommendation language ("specific", peak names)
        // that would otherwise re-arm detail tools on every turn.
        body.prompt,
      );
      // Cache-aside touch: active agent use keeps the context TTL aligned
      // with the sliding session (Redis EXPIRE, slightly longer than session).
      await touchUserAgentContext(req.user!.id);

      console.log("headers set");

      await addMessageToSession(sessionId, body.prompt, "user", req.user!.id);
      await addMessageToSession(
        sessionId,
        replyContent,
        "assistant",
        req.user!.id,
      );

      const memoryType = await getSessionMemoryType(sessionId, req.user!.id);

      sendEvent("done", {
        ok: true,
        message: { role: "assistant", content: replyContent },
        sessionId,
        memoryType,
        memory: history ? history.split("\n").length : 0,
        model: env.OPENROUTER_MODEL,
      });
      console.info("agent.request", {
        durationMs: Date.now() - requestStartedAt,
        sessionId,
      });
      res.end();
    } catch (error) {
      if (res.headersSent) {
        console.error("Stream disrupted by error:", error);

        // Format the error into your event-stream layout so the frontend sees it.
        // 429s from the shared free-model pool are retryable: send a friendly
        // "busy, try again" message (plus a retryable flag) instead of a
        // generic "Internal stream error" that looks permanent.
        const isNotFoundError =
          error instanceof Error && error.message === "SESSION_NOT_FOUND";
        const isRateLimited =
          error instanceof OpenAI.RateLimitError ||
          (typeof error === "object" &&
            error !== null &&
            "status" in error &&
            Number((error as { status?: unknown }).status) === 429);

        res.write(
          `event: error\ndata: ${JSON.stringify({
            ok: false,
            error: isNotFoundError
              ? "Session not found"
              : isRateLimited
                ? "The hike advisor is busy right now (shared model pool is rate-limited). Please wait a moment and try again."
                : "Internal stream error",
            retryable: isRateLimited || undefined,
          })}\n\n`,
        );

        res.end();
        return;
      }

      // If headers weren't sent yet (e.g., payloadSchema.parse or getSessionPromptContext failed)
      if (error instanceof Error && error.message === "SESSION_NOT_FOUND") {
        res.status(404).json({ ok: false, error: "Session not found" });
        return;
      }
      next(error);
    }
  },
);

agentRouter.get(
  "/sessions",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ ok: true, sessions: await getUserSessions(req.user!.id) });
    } catch (error) {
      next(error);
    }
  },
);

agentRouter.get(
  "/sessions/:sessionId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = Array.isArray(req.params.sessionId)
        ? req.params.sessionId[0]
        : req.params.sessionId;
      const messages = await getSessionMessages(sessionId, req.user!.id);
      const memoryType = await getSessionMemoryType(sessionId, req.user!.id);
      res.json({
        ok: true,
        sessionId,
        messages,
        memoryType,
        model: env.OPENROUTER_MODEL,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "SESSION_NOT_FOUND") {
        res.status(404).json({ ok: false, error: "Session not found" });
        return;
      }
      next(error);
    }
  },
);

agentRouter.post(
  "/sessions/:sessionId/toggle-memory",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = Array.isArray(req.params.sessionId)
        ? req.params.sessionId[0]
        : req.params.sessionId;
      const newMemoryType = await toggleMemoryType(sessionId, req.user!.id);
      res.json({
        ok: true,
        sessionId,
        memoryType: newMemoryType,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "SESSION_NOT_FOUND") {
        res.status(404).json({ ok: false, error: "Session not found" });
        return;
      }
      next(error);
    }
  },
);
