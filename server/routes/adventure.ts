import { Router, Request, Response } from "express";
import { z } from "zod";

import {
  createAdventure,
  editAdventure,
  deleteAdventure,
} from "../services/adventure.js";

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

const editAdventureSchema = z
  .object({
    id: z.number().int().positive(),
    activityDate: z.string().min(1),
    activityId: z.number().int().positive().optional(),
    mountainId: z.number().int().positive().optional(),
    trailId: z.number().int().positive().optional(),
  })
  .refine((value) => value.mountainId || value.trailId, {
    message: "Provide at least one mountainId or trailId",
  });

const deleteAdventureSchema = z
  .object({
    id: z.number().int().positive(),
    mountainId: z.number().int().positive().optional(),
    trailId: z.number().int().positive().optional(),
  })
  .refine((value) => value.mountainId || value.trailId, {
    message: "Provide at least one mountainId or trailId",
  });

export const adventureRouter = Router();

adventureRouter.post("/adventures", async (req: Request, res: Response) => {
  const payload = createAdventureSchema.parse(req.body);
  const adventure = await createAdventure(payload);

  res.status(201).json(adventure);
  return res;
});

adventureRouter.patch("/adventure/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid query parameter format" });
  }

  const payload = editAdventureSchema.parse({ id: parseInt(id), ...req.body });

  const adventure = await editAdventure(payload);

  res.status(201).json(adventure);
  return res;
});

adventureRouter.delete(
  "/adventure/:id",
  async (req: Request, res: Response) => {
    const { id } = req.params;

    if (typeof id !== "string") {
      return res.status(400).json({ error: "Invalid query parameter format" });
    }

    const payload = deleteAdventureSchema.parse({
      id: parseInt(id),
      ...req.body,
    });
    const adventure = await deleteAdventure(payload);

    res.status(201).json(adventure);
    return res;
  },
);
