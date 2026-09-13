import { Router } from "express";
import { requireUser } from "../middleware/auth.js";
import { getListCompletionStatus } from "../services/completion.js";
import { getUserProfile } from "../services/profile.js";

export const profileRouter = Router();

profileRouter.get("/user/profile", requireUser, async (req, res, next) => {
  try {
    const profile = await getUserProfile(req.user!.id);
    if (!profile) {
      res.status(404).json({ ok: false, error: "User not found" });
      return;
    }
    res.json({ ok: true, profile });
  } catch (error) {
    next(error);
  }
});

profileRouter.get(
  "/user/list-completions",
  requireUser,
  async (req, res, next) => {
    try {
      const completions = await getListCompletionStatus(req.user!.id);
      res.json({ ok: true, completions });
    } catch (error) {
      next(error);
    }
  },
);
