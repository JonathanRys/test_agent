import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { getList, getLists } from "../services/list.js";

import { getMountainsOnList } from "../services/mountain.js";
import { getTrailsOnList } from "../services/trail.js";

const payloadSchema = z.object({
  prompt: z.string().min(1).max(4000),
  sessionId: z.string().optional(),
});

export const listViewRouter = Router();

listViewRouter.get("/list/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid ID format" });
  }

  const list = await getList(parseInt(id));

  res.status(200).json(list);
  return res;
});

listViewRouter.get("/lists", async (req: Request, res: Response) => {
  const { type } = req.query;

  if (
    (type && typeof type !== "string") ||
    (type && !["peakbagging", "trace"].includes(type))
  ) {
    return res.status(400).json({ error: "Invalid query parameter format" });
  }
  const lists = await getLists({
    type: type as "peakbagging" | "trace",
  });

  res.status(200).json(lists);
  return res;
});

listViewRouter.get(
  "/mountainList/:listId",
  async (req: Request, res: Response) => {
    const { listId } = req.params;

    if (typeof listId !== "string") {
      return res.status(400).json({ error: "Invalid query parameter format" });
    }

    const mountains = await getMountainsOnList(parseInt(listId));

    res.status(200).json(mountains);
    return res;
  },
);

listViewRouter.get(
  "/trailList/:listId",
  async (req: Request, res: Response) => {
    const { listId } = req.params;

    if (typeof listId !== "string") {
      return res.status(400).json({ error: "Invalid query parameter format" });
    }

    const trails = await getTrailsOnList(parseInt(listId));

    res.status(200).json(trails);
    return res;
  },
);
