import "dotenv/config";
import express from "express";
import cors from "cors";
import { z } from "zod";
import { agentRouter } from "./routes/agent.js";
import { listViewRouter } from "./routes/list.js";
import { adventureRouter } from "./routes/adventure.js";
import { mountainRouter } from "./routes/mountain.js";
import { trailRouter } from "./routes/trail.js";
import { authRouter } from "./routes/auth.js";
import { preferencesRouter } from "./routes/preferences.js";
import { seasonRouter } from "./routes/season.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());
app.use("/api", authRouter);
app.use("/api", preferencesRouter);
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

    console.error("Unhandled server error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  },
);

app.listen(port, () => {
  console.log(`Agent API listening on http://localhost:${port}`);
});

export { app };
