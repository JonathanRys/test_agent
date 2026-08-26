import { Sequelize } from "sequelize";
import path from "path";
import { fileURLToPath } from "url";
import {
  State,
  Mountain,
  Trail,
  List,
  MountainList,
  TrailList,
  initializeModels,
} from "../models/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "../../data/memory.db");

// Initialize Sequelize
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: dbPath,
  logging: false, // Set to console.log for debugging
});

// Initialize models
initializeModels(sequelize);

// Track initialization state
let isInitialized = false;

// Initialize database
async function ensureInitialized(): Promise<void> {
  if (isInitialized) return;

  try {
    await sequelize.sync();
    isInitialized = true;
  } catch (error) {
    console.error("Failed to sync database:", error);
    throw error;
  }
}

export async function getMountain(id: number): Promise<Mountain | null> {
  try {
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

export async function getTrail(id: number): Promise<Trail | null> {
  try {
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

export async function getList(id: number): Promise<List | null> {
  try {
    const list = await List.findOne({
      where: {
        id,
      },
    });

    if (!list) {
      return null;
    }

    return list;
  } catch (error) {
    console.error(`Error fetching list ${id} from database:`, error);
    return null;
  }
}

type ListFilters = {
  type?: List["type"];
};

export async function getLists(filters: ListFilters): Promise<List[]> {
  try {
    const { type } = filters;

    const whereQuery: Record<string, string> = {};

    if (type !== undefined) whereQuery.type = type;

    const lists = await List.findAll({
      where: whereQuery,
      order: [["type", "ASC"]],
    });

    return lists;
  } catch (error) {
    console.error(
      `Error fetching lists from database:`,
      `Filters:\n${JSON.stringify(filters)}`,
      error,
    );
    return [];
  }
}

export async function getMountainsOnList(listId: number): Promise<Mountain[]> {
  try {
    const mountains = await Mountain.findAll({
      order: [["height", "DESC"]],
      include: [
        {
          model: List,
          attributes: ["id", "name", "abbreviation"],
          where: { id: listId },
          through: {
            attributes: [],
          },
        },
        {
          model: State,
          as: "state",
          attributes: ["id", "name", "abbreviation"],
        },
      ],
    });

    return mountains;
  } catch (error) {
    console.error(`Error fetching mountains from database:`, error);
    return [];
  }
}

export async function getTrailsOnList(listId: number): Promise<Trail[]> {
  try {
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
      ],
    });

    return trails;
  } catch (error) {
    console.error(`Error fetching trails from database:`, error);
    return [];
  }
}
