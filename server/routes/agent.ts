import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { generateAgentReply } from "../services/openrouter.js";
import { env } from "../config/env.js";
import { requireUser } from "../middleware/auth.js";
import {
  getSessionMemory,
  getSessionMessages,
  addMessageToSession,
  toggleMemoryType,
  getSessionMemoryType,
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
      const body = payloadSchema.parse(req.body);
      const sessionId = body.sessionId ?? "default";

      const history = await getSessionMemory(sessionId, req.user!.id);
      const memory = [...history, body.prompt].slice(-6);
      const reply = await generateAgentReply(memory.join("\n"), req.user?.id);

      await addMessageToSession(sessionId, body.prompt, "user", req.user!.id);
      await addMessageToSession(
        sessionId,
        reply.content,
        "assistant",
        req.user!.id,
      );

      const memoryType = await getSessionMemoryType(sessionId, req.user!.id);

      res.json({
        ok: true,
        message: reply,
        sessionId,
        memoryType,
        memory: memory.length,
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
