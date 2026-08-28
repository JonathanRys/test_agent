import { ensureInitialized } from "../utils/db.js";
import { State, Trail, List, TrailCompletion } from "../models/index.js";
import { completionInclude } from "./common.js";

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

export async function getTrailsOnList(listId: number): Promise<Trail[]> {
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
          attributes: ["id", "completedAt", "adventureId"],
          include: [completionInclude],
        },
      ],
    });

    return trails;
  } catch (error) {
    console.error(`Error fetching trails from database:`, error);
    return [];
  }
}
