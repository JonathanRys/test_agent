import { Router, Request, Response } from "express";
import { UniqueConstraintError } from "sequelize";
import { z } from "zod";

import {
  createAdventure,
  editAdventure,
  deleteAdventure,
  getAdventure,
  getAdventures,
  DuplicateCompletionError,
} from "../services/adventure.js";
import { requireUser } from "../middleware/auth.js";

const createAdventureSchema = z
  .object({
    name: z.string().min(1).max(255),
    activityId: z.number().int().positive(),
    activityDate: z.string().min(1),
    season: z.string().min(1).optional(),
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
    season: z.string().min(1).optional(),
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

adventureRouter.get(
  "/adventures",
  requireUser,
  async (req: Request, res: Response) => {
    const adventures = await getAdventures(req.user!.id);
    res.status(200).json(adventures);
    return res;
  },
);

adventureRouter.get(
  "/adventure/:id",
  requireUser,
  async (req: Request, res: Response) => {
    const { id } = req.params;

    if (typeof id !== "string" || !/^\d+$/.test(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    const adventure = await getAdventure(parseInt(id, 10), req.user!.id);
    if (!adventure) {
      return res.status(404).json({ error: "Adventure not found" });
    }

    res.status(200).json(adventure);
    return res;
  },
);

adventureRouter.post(
  "/adventures",
  requireUser,
  async (req: Request, res: Response) => {
    try {
      const payload = createAdventureSchema.parse(req.body);
      const adventure = await createAdventure(payload, req.user!.id);

      res.status(201).json(adventure);
      return res;
    } catch (error) {
      if (
        error instanceof DuplicateCompletionError ||
        error instanceof UniqueConstraintError
      ) {
        return res.status(409).json({ error: error.message });
      }
      throw error;
    }
  },
);

adventureRouter.patch(
  "/adventure/:id",
  requireUser,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (typeof id !== "string") {
        return res
          .status(400)
          .json({ error: "Invalid query parameter format" });
      }

      const payload = editAdventureSchema.parse({
        id: parseInt(id),
        ...req.body,
      });

      const adventure = await editAdventure(payload, req.user!.id);

      res.status(201).json(adventure);
      return res;
    } catch (error) {
      if (
        error instanceof DuplicateCompletionError ||
        error instanceof UniqueConstraintError
      ) {
        return res.status(409).json({ error: error.message });
      }
      throw error;
    }
  },
);

adventureRouter.delete(
  "/adventure/:id",
  requireUser,
  async (req: Request, res: Response) => {
    const { id } = req.params;

    if (typeof id !== "string") {
      return res.status(400).json({ error: "Invalid query parameter format" });
    }

    const payload = deleteAdventureSchema.parse({
      id: parseInt(id),
      ...req.body,
    });
    const adventure = await deleteAdventure(payload, req.user!.id);

    res.status(201).json(adventure);
    return res;
  },
);
