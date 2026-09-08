import { Router } from "express";
import { z } from "zod";
import { requireUser } from "../middleware/auth.js";
import { UserPreference } from "../models/index.js";

export const preferencesSchema = z.object({
  fitnessLevel: z
    .enum(["beginner", "intermediate", "expert"])
    .nullable()
    .optional(),
  homeLocation: z.string().max(255).nullable().optional(),
  units: z.enum(["imperial", "metric"]).optional(),
  interests: z.array(z.string().max(80)).max(20).optional(),
  publicProfile: z.boolean().optional(),
  publicRatings: z.boolean().optional(),
  birthdate: z.string().date().nullable().optional(),
});

export const preferencesRouter = Router();

preferencesRouter.get(
  "/me/preferences",
  requireUser,
  async (req, res, next) => {
    try {
      const [preferences] = await UserPreference.findOrCreate({
        where: { userId: req.user!.id },
        defaults: { userId: req.user!.id },
      });
      res.json({ ok: true, preferences });
    } catch (error) {
      next(error);
    }
  },
);

preferencesRouter.patch(
  "/me/preferences",
  requireUser,
  async (req, res, next) => {
    try {
      const values = preferencesSchema.parse(req.body);
      const [preferences] = await UserPreference.findOrCreate({
        where: { userId: req.user!.id },
        defaults: { userId: req.user!.id, ...values },
      });
      await preferences.update(values);
      res.json({ ok: true, preferences });
    } catch (error) {
      next(error);
    }
  },
);
