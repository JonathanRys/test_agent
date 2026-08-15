import "dotenv/config";
import express from "express";
import cors from "cors";
import { z } from "zod";
import { agentRouter } from "./routes/agent.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "agent-api",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api", agentRouter);

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
