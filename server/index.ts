import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";
import { z } from "zod";
import { agentRouter } from "./routes/agent.js";
import { listViewRouter } from "./routes/list.js";
import { adventureRouter } from "./routes/adventure.js";
import { mountainRouter } from "./routes/mountain.js";
import { trailRouter } from "./routes/trail.js";
import { authRouter } from "./routes/auth.js";
import { preferencesRouter } from "./routes/preferences.js";
import { profileRouter } from "./routes/profile.js";
import { seasonRouter } from "./routes/season.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);

function getErrorHeader(headers: unknown, name: string): string | undefined {
  if (!headers || typeof headers !== "object") return undefined;

  const headerMap = headers as {
    get?: (headerName: string) => string | null;
    [key: string]: unknown;
  };
  if (typeof headerMap.get === "function") {
    return headerMap.get(name) ?? undefined;
  }

  const matchingKey = Object.keys(headerMap).find(
    (key) => key.toLowerCase() === name.toLowerCase(),
  );
  const value = matchingKey ? headerMap[matchingKey] : undefined;
  return typeof value === "string" ? value : undefined;
}

app.use(cors());
app.use(express.json());
app.use("/api", authRouter);
app.use("/api", preferencesRouter);
app.use("/api", profileRouter);
app.use("/api", seasonRouter);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "agent-api",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api", agentRouter);
app.use("/api", listViewRouter);
app.use("/api", adventureRouter);
app.use("/api", mountainRouter);
app.use("/api", trailRouter);

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (err instanceof z.ZodError) {
      return res
        .status(400)
        .json({ ok: false, error: "Validation error", details: err.flatten() });
    }

    if (err instanceof OpenAI.APIError && err.status === 429) {
      const retryAfter = getErrorHeader(err.headers, "retry-after");
      const resetAt = getErrorHeader(err.headers, "x-ratelimit-reset");
      const retryMessage = retryAfter
        ? ` Please try again in ${retryAfter} seconds.`
        : resetAt
          ? ` The limit is expected to reset around ${new Date(Number(resetAt) * 1000).toLocaleTimeString()}.`
          : " Please try again shortly.";

      if (retryAfter) res.set("Retry-After", retryAfter);
      if (resetAt) res.set("X-RateLimit-Reset", resetAt);

      return res.status(429).json({
        ok: false,
        error: `The AI provider is rate-limited.${retryMessage}`,
      });
    }

    console.error("Unhandled server error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  },
);

app.listen(port, () => {
  console.log(`Agent API listening on http://localhost:${port}`);
});

export { app };
