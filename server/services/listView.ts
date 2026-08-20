import { Sequelize } from "sequelize";
import path from "path";
import { fileURLToPath } from "url";
import {
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
  state: Mountain["state"];
  range: Mountain["range"];
  ascending: boolean;
};

export async function getMountains(
  filters: MountainFilters,
): Promise<Mountain[]> {
  try {
    const { state, range, ascending } = filters;
    const mountains = await Mountain.findAll({
      where: {
        state,
        range,
      },
      order: [["height", ascending ? "ASC" : "DESC"]],
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
  state: Trail["state"];
  ascending: boolean;
};

export async function getTrails(filters: TrailFilters): Promise<Trail[]> {
  try {
    const { state, ascending } = filters;
    const trails = await Trail.findAll({
      where: {
        state,
      },
      order: [["state", ascending ? "ASC" : "DESC"]],
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
  type: List["type"];
  state: List["state"];
  ascending: boolean;
};

export async function getLists(filters: ListFilters): Promise<List[]> {
  try {
    const { state, type, ascending } = filters;
    const lists = await List.findAll({
      where: {
        state,
        type,
      },
      order: [["type", ascending ? "ASC" : "DESC"]],
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
      include: [
        {
          model: List,
          where: { id: listId },
          through: { attributes: [] },
          required: true,
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
      ],
    });

    return trails;
  } catch (error) {
    console.error(`Error fetching trails from database:`, error);
    return [];
  }
}
