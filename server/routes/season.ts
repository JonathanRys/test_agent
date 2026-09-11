import { Router, Request, Response } from "express";
import { Season, SeasonDate } from "../models/index.js";
import { transformSeasons } from "../utils/listHelpers.js";

export const seasonRouter = Router();

seasonRouter.get("/seasons", async (_req: Request, res: Response) => {
  const seasons = await Season.findAll({
    include: [{ model: SeasonDate, attributes: ["startDate", "endDate"] }],
  });

  res.status(200).json(seasons.map(transformSeasons).map(([, season]) => season));
  return res;
});