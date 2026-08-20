import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  getMountain,
  getMountains,
  getTrail,
  getTrails,
  getList,
  getLists,
  getMountainsOnList,
  getTrailsOnList,
} from "../services/listView.js";
import { env } from "../config/env.js";

const payloadSchema = z.object({
  prompt: z.string().min(1).max(4000),
  sessionId: z.string().optional(),
});

export const listViewRouter = Router();

listViewRouter.get("/mountain/:id", (req: Request, res: Response) => {
  const { id } = req.params;

  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid ID format" });
  }

  const mountain = getMountain(parseInt(id));

  res.status(200).json(mountain);
  return res;
});

listViewRouter.get("/mountains", (req: Request, res: Response) => {
  const { state, range, ascending } = req.query;

  if (
    typeof state !== "string" ||
    typeof range !== "string" ||
    typeof ascending !== "boolean"
  ) {
    return res.status(400).json({ error: "Invalid query parameter format" });
  }

  const mountains = getMountains({
    state: state,
    range: range,
    ascending: ascending,
  });

  res.status(200).json(mountains);
  return res;
});

listViewRouter.get("/trail/:id", (req: Request, res: Response) => {
  const { id } = req.params;

  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid ID format" });
  }

  const trail = getTrail(parseInt(id));

  res.status(200).json(trail);
  return res;
});

listViewRouter.get("/trails", (req: Request, res: Response) => {
  const { state, ascending } = req.query;

  if (typeof state !== "string" || typeof ascending !== "boolean") {
    return res.status(400).json({ error: "Invalid query parameter format" });
  }

  const trails = getTrails({
    state: state,
    ascending: ascending,
  });

  res.status(200).json(trails);
  return res;
});

listViewRouter.get("/list/:id", (req: Request, res: Response) => {
  const { id } = req.params;

  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid ID format" });
  }

  const list = getList(parseInt(id));

  res.status(200).json(list);
  return res;
});

listViewRouter.get("/lists", (req: Request, res: Response) => {
  const { state, type, ascending } = req.query;

  if (
    typeof state !== "string" ||
    typeof type !== "string" ||
    !["peakbagging", "trace"].includes(type) ||
    typeof ascending !== "boolean"
  ) {
    return res.status(400).json({ error: "Invalid query parameter format" });
  }
  const lists = getLists({
    state: state,
    type: type as "peakbagging" | "trace",
    ascending: ascending,
  });

  res.status(200).json(lists);
  return res;
});

listViewRouter.get("/mountainList/:listId", (req: Request, res: Response) => {
  const { listId } = req.params;

  if (typeof listId !== "string") {
    return res.status(400).json({ error: "Invalid query parameter format" });
  }

  const mountains = getMountainsOnList(parseInt(listId));

  res.status(200).json(mountains);
  return res;
});

listViewRouter.get("/trailList/:listId", (req: Request, res: Response) => {
  const { listId } = req.params;

  if (typeof listId !== "string") {
    return res.status(400).json({ error: "Invalid query parameter format" });
  }

  const trails = getTrailsOnList(parseInt(listId));

  res.status(200).json(trails);
  return res;
});
