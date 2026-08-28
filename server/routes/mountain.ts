import { Router, Request, Response } from "express";

import { getMountain, getMountains } from "../services/mountain.js";

export const mountainRouter = Router();

mountainRouter.get("/mountain/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid ID format" });
  }

  const mountain = await getMountain(parseInt(id));

  res.status(200).json(mountain);
  return res;
});

mountainRouter.get("/mountains", async (req: Request, res: Response) => {
  const { state, range } = req.query;

  if (typeof state !== "string" || typeof range !== "string") {
    return res.status(400).json({ error: "Invalid query parameter format" });
  }

  const mountains = await getMountains({
    state: state,
    range: range,
  });

  res.status(200).json(mountains);
  return res;
});
