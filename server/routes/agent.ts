import { Router, Request, Response, NextFunction } from "express";
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
      );

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
