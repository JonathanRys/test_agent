import { Router, Request, Response } from "express";

import { getTrail, getTrails } from "../services/trail.js";

export const trailRouter = Router();

trailRouter.get("/trail/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid ID format" });
  }

  const trail = await getTrail(parseInt(id));

  res.status(200).json(trail);
  return res;
});

trailRouter.get("/trails", async (req: Request, res: Response) => {
  const { state } = req.query;

  if (typeof state !== "string") {
    return res.status(400).json({ error: "Invalid query parameter format" });
  }

  const trails = await getTrails({
    state: state,
  });

  res.status(200).json(trails);
  return res;
});
