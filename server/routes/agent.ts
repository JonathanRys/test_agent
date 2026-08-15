import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { generateAgentReply } from "../services/openrouter.js";
import { env } from "../config/env.js";
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

agentRouter.post(
  "/chat",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = payloadSchema.parse(req.body);
      const sessionId = body.sessionId ?? "default";

      const history = await getSessionMemory(sessionId);
      const memory = [...history, body.prompt].slice(-6);
      const reply = await generateAgentReply(memory.join("\n"));

      await addMessageToSession(sessionId, body.prompt, "user");
      await addMessageToSession(sessionId, reply.content, "assistant");

      const memoryType = await getSessionMemoryType(sessionId);

      res.json({
        ok: true,
        message: reply,
        sessionId,
        memoryType,
        memory: memory.length,
        model: env.OPENROUTER_MODEL,
      });
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
      const messages = await getSessionMessages(sessionId);
      const memoryType = await getSessionMemoryType(sessionId);
      res.json({
        ok: true,
        sessionId,
        messages,
        memoryType,
        model: env.OPENROUTER_MODEL,
      });
    } catch (error) {
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
      const newMemoryType = await toggleMemoryType(sessionId);
      res.json({
        ok: true,
        sessionId,
        memoryType: newMemoryType,
      });
    } catch (error) {
      next(error);
    }
  },
);
