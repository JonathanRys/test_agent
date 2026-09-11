import { Sequelize } from "sequelize";

import { ensureInitialized } from "../utils/db.js";
import {
  State,
  Mountain,
  List,
  Summit,
  SeasonDate,
  Season,
} from "../models/index.js";
import { completionInclude } from "./common.js";
import type { MountainWithRelations, SeasonWithDates } from "./types.js";
import { getSeasonForDate } from "../utils/listHelpers.js";

export async function getMountain(id: number): Promise<Mountain | null> {
  try {
    await ensureInitialized();
    const mountain = await Mountain.findOne({
      where: {
        id,
      },
      include: [
        {
          model: State,
          as: "state",
          attributes: ["id", "name", "abbreviation"],
        },
      ],
    });

    if (!mountain) {
      return null;
    }

    return mountain;
  } catch (error) {
    console.error(`Error fetching mountain ${id} from database:`, error);
    return null;
  }
}

type MountainFilters = {
  state?: Mountain["state"];
  range?: Mountain["range"];
};

export async function getMountains(
  filters: MountainFilters,
): Promise<Mountain[]> {
  try {
    await ensureInitialized();
    const { state, range } = filters;

    const whereQuery: Record<string, string> = {};

    if (state !== undefined) whereQuery.state = state;
    if (range !== undefined) whereQuery.range = range;

    const mountains = await Mountain.findAll({
      where: whereQuery,
      order: [["height", "ASC"]],
      include: [
        {
          model: State,
          as: "state",
          attributes: ["id", "name", "abbreviation"],
        },
      ],
    });

    return mountains;
  } catch (error) {
    console.error(
      `Error fetching mountains from database:`,
      `Filters:\n${JSON.stringify(filters)}`,
      error,
    );
    return [];
  }
}

export async function getMountainsOnList(
  listId: number,
  userId?: number,
): Promise<MountainWithRelations[]> {
  try {
    await ensureInitialized();
    const mountains = await Mountain.findAll({
      order: [["height", "DESC"]],
      where: Sequelize.literal(`
        "Mountain"."id" IN (
          SELECT "MountainId" FROM "MountainLists"
          WHERE "listId" = :listIdValue
        )
      `),
      replacements: { listIdValue: Number(listId) },
      include: [
        {
          model: List,
          attributes: ["id", "name", "abbreviation"],
          through: {
            attributes: [],
          },
        },
        {
          model: State,
          as: "state",
          attributes: ["id", "name", "abbreviation"],
        },
        {
          model: Summit,
          attributes: ["id", "completedAt", "adventureId", "season"],
          where: userId ? { userId } : { userId: -1 },
          required: false,
          include: [completionInclude],
        },
      ],
    });

    // Query Season and SeasonDate for all seasons and their date ranges
    const seasonDates = await Season.findAll({
      include: [
        {
          model: SeasonDate,
          attributes: ["startDate", "endDate"],
        },
      ],
    });

    // Create seasons map
    const seasonsMap = new Map<number, SeasonWithDates>(
      seasonDates.map((instance) => {
        const json = instance.toJSON() as any;
        return [
          json.id,
          {
            ...json,
            // Safely fall back to an empty array if SeasonDates is missing or undefined
            seasonDates: json.SeasonDates || [],
          },
        ];
      }),
    );

    // Add season information to each summit based on the completion date
    const mountainsWithSeasons = mountains.map((mountain) => {
      const plainMountain = mountain.get({
        plain: true,
      }) as MountainWithRelations;

      if (plainMountain.Summits) {
        plainMountain.Summits = plainMountain.Summits.map((summit) => ({
          ...summit,
          season:
            summit.season ?? getSeasonForDate(seasonsMap, summit.completedAt),
        }));
      }

      return plainMountain;
    });

    return mountainsWithSeasons;
  } catch (error) {
    console.error(`Error fetching mountains from database:`, error);
    return [];
  }
}
