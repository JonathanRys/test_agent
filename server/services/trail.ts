import { ensureInitialized } from "../utils/db.js";
import {
  State,
  Trail,
  List,
  TrailCompletion,
  SeasonDate,
  Season,
} from "../models/index.js";
import { completionInclude } from "./common.js";
import { SeasonWithDates, TrailWithRelations } from "./types.js";
import { getSeasonForDate } from "../utils/listHelpers.js";

export async function getTrail(id: number): Promise<Trail | null> {
  try {
    await ensureInitialized();
    const trail = await Trail.findOne({
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

    if (!trail) {
      return null;
    }

    return trail;
  } catch (error) {
    console.error(`Error fetching trail ${id} from database:`, error);
    return null;
  }
}

type TrailFilters = {
  state?: Trail["state"];
};

export async function getTrails(filters: TrailFilters): Promise<Trail[]> {
  try {
    await ensureInitialized();
    const { state } = filters;
    const whereQuery: Record<string, string> = {};

    if (state !== undefined) whereQuery.state = state;

    const trails = await Trail.findAll({
      where: whereQuery,
      include: [
        {
          model: State,
          as: "state",
          order: [["state", "ASC"]],
          attributes: ["id", "name", "abbreviation"],
        },
      ],
    });

    return trails;
  } catch (error) {
    console.error(
      `Error fetching trails from database:`,
      `Filters:\n${JSON.stringify(filters)}`,
      error,
    );
    return [];
  }
}

export async function getTrailsOnList(
  listId: number,
  userId?: number,
): Promise<TrailWithRelations[]> {
  try {
    await ensureInitialized();
    const trails = await Trail.findAll({
      include: [
        {
          model: List,
          where: { id: listId },
          through: { attributes: [] },
          required: true,
        },
        {
          model: State,
          as: "state",
          attributes: ["id", "name", "abbreviation"],
        },
        {
          model: TrailCompletion,
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
    const trailsWithSeasons = trails.map((trail) => {
      const plainTrail = trail.get({
        plain: true,
      }) as TrailWithRelations;

      if (plainTrail.TrailCompletions) {
        plainTrail.TrailCompletions = plainTrail.TrailCompletions.map(
          (completion) => ({
            ...completion,
            season:
              completion.season ??
              getSeasonForDate(seasonsMap, completion.completedAt),
          }),
        );
      }

      return plainTrail;
    });

    return trailsWithSeasons;
  } catch (error) {
    console.error(`Error fetching trails from database:`, error);
    return [];
  }
}
