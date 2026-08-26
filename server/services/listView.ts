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
  Activity,
  Adventure,
  Summit,
  TrailCompletion,
  initializeModels,
} from "../models/index.js";
import activities from "../data/activities.json" with { type: "json" };

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
    const activityCount = await Activity.count();
    if (activityCount === 0) {
      const activityRows = (
        activities as Array<{ name: string; parentActivity?: number }>
      ).filter((row) => row.name !== "Empty");
      await Activity.bulkCreate(activityRows);
    }
    isInitialized = true;
  } catch (error) {
    console.error("Failed to sync database:", error);
    throw error;
  }
}

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

const completionInclude = {
  model: Adventure,
  attributes: ["id", "name", "activityDate"],
};

export async function getList(id: number): Promise<List | null> {
  try {
    await ensureInitialized();
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

export type ListWithProgress = List & {
  totalCount: number;
  completedCount: number;
};

type ListFilters = {
  type?: List["type"];
};

export async function getLists(
  filters: ListFilters,
): Promise<ListWithProgress[]> {
  try {
    await ensureInitialized();
    const { type } = filters;

    const whereQuery: Record<string, string> = {};

    if (type !== undefined) whereQuery.type = type;

    const lists = await List.findAll({
      where: whereQuery,
      order: [["type", "ASC"]],
    });

    const [mountainLinks, trailLinks, summits, trailCompletions] =
      await Promise.all([
        MountainList.findAll({ attributes: ["listId", "mountainId"] }),
        TrailList.findAll({ attributes: ["listId", "trailId"] }),
        Summit.findAll({ attributes: ["mountainId"] }),
        TrailCompletion.findAll({ attributes: ["trailId"] }),
      ]);

    const completedMountainIds = new Set(
      summits.map((summit) => summit.mountainId),
    );
    const completedTrailIds = new Set(
      trailCompletions.map((completion) => completion.trailId),
    );

    const mountainsByList = new Map<number, number[]>();
    for (const link of mountainLinks) {
      const ids = mountainsByList.get(link.listId) ?? [];
      ids.push(link.mountainId);
      mountainsByList.set(link.listId, ids);
    }

    const trailsByList = new Map<number, number[]>();
    for (const link of trailLinks) {
      const ids = trailsByList.get(link.listId) ?? [];
      ids.push(link.trailId);
      trailsByList.set(link.listId, ids);
    }

    return lists.map((list) => {
      const json = list.toJSON() as List;
      if (list.type === "trace") {
        const trailIds = trailsByList.get(list.id) ?? [];
        const completedCount = trailIds.filter((id) =>
          completedTrailIds.has(id),
        ).length;
        return Object.assign(json, {
          totalCount: trailIds.length,
          completedCount,
        }) as ListWithProgress;
      }

      const mountainIds = mountainsByList.get(list.id) ?? [];
      const completedCount = mountainIds.filter((id) =>
        completedMountainIds.has(id),
      ).length;
      return Object.assign(json, {
        totalCount: mountainIds.length,
        completedCount,
      }) as ListWithProgress;
    });
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
    await ensureInitialized();
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

export type CreateAdventureInput = {
  name: string;
  activityId: number;
  activityDate: Date | string;
  mountainIds?: number[];
  trailIds?: number[];
};

export async function createAdventure(
  input: CreateAdventureInput,
): Promise<Adventure> {
  await ensureInitialized();

  const activityDate = new Date(input.activityDate);
  const mountainIds = input.mountainIds ?? [];
  const trailIds = input.trailIds ?? [];

  return sequelize.transaction(async (transaction) => {
    const adventure = await Adventure.create(
      {
        name: input.name,
        activityId: input.activityId,
        activityDate,
      },
      { transaction },
    );

    if (mountainIds.length > 0) {
      await Summit.bulkCreate(
        mountainIds.map((mountainId) => ({
          adventureId: adventure.id,
          mountainId,
          completedAt: activityDate,
        })),
        { transaction },
      );
    }

    if (trailIds.length > 0) {
      await TrailCompletion.bulkCreate(
        trailIds.map((trailId) => ({
          adventureId: adventure.id,
          trailId,
          completedAt: activityDate,
        })),
        { transaction },
      );
    }

    return adventure;
  });
}
