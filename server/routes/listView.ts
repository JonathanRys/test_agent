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
  createAdventure,
} from "../services/listView.js";

const payloadSchema = z.object({
  prompt: z.string().min(1).max(4000),
  sessionId: z.string().optional(),
});

const createAdventureSchema = z
  .object({
    name: z.string().min(1).max(255),
    activityId: z.number().int().positive(),
    activityDate: z.string().min(1),
    mountainIds: z.array(z.number().int().positive()).optional(),
    trailIds: z.array(z.number().int().positive()).optional(),
  })
  .refine(
    (value) =>
      (value.mountainIds?.length ?? 0) > 0 || (value.trailIds?.length ?? 0) > 0,
    { message: "Provide at least one mountainId or trailId" },
  );

export const listViewRouter = Router();

listViewRouter.get("/mountain/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid ID format" });
  }

  const mountain = await getMountain(parseInt(id));

  res.status(200).json(mountain);
  return res;
});

listViewRouter.get("/mountains", async (req: Request, res: Response) => {
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

listViewRouter.get("/trail/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid ID format" });
  }

  const trail = await getTrail(parseInt(id));

  res.status(200).json(trail);
  return res;
});

listViewRouter.get("/trails", async (req: Request, res: Response) => {
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

listViewRouter.post("/adventures", async (req: Request, res: Response) => {
  const payload = createAdventureSchema.parse(req.body);
  const adventure = await createAdventure(payload);

  res.status(201).json(adventure);
  return res;
});
