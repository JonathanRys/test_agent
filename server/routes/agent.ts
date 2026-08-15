import { Router } from "express";
import { z } from "zod";
import { generateAgentReply } from "../services/openrouter.js";

const payloadSchema = z.object({
  prompt: z.string().min(1).max(4000),
  sessionId: z.string().optional(),
});

const inMemorySessions = new Map<string, string[]>();

export const agentRouter = Router();

agentRouter.post("/chat", async (req, res, next) => {
  try {
    const body = payloadSchema.parse(req.body);
    const sessionId = body.sessionId ?? "default";

    const history = inMemorySessions.get(sessionId) ?? [];
    const memory = [...history, body.prompt].slice(-6);
    const reply = await generateAgentReply(memory.join("\n"));

    inMemorySessions.set(sessionId, memory);

    res.json({
      ok: true,
      message: reply,
      sessionId,
      memory: memory.length,
    });
  } catch (error) {
    next(error);
  }
});

agentRouter.get("/sessions/:sessionId", (req, res) => {
  const history = inMemorySessions.get(req.params.sessionId) ?? [];
  res.json({ ok: true, sessionId: req.params.sessionId, history });
});
