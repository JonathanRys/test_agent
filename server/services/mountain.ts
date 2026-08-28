import { Sequelize } from "sequelize";

import { ensureInitialized } from "../utils/db.js";
import { State, Mountain, List, Summit } from "../models/index.js";
import { completionInclude } from "./common.js";

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

export async function getMountainsOnList(listId: number): Promise<Mountain[]> {
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
          attributes: ["id", "completedAt", "adventureId"],
          include: [completionInclude],
        },
      ],
    });

    return mountains;
  } catch (error) {
    console.error(`Error fetching mountains from database:`, error);
    return [];
  }
}
