import { sequelize, ensureInitialized } from "../utils/db.js";
import {
  Season,
  SeasonDate,
  List,
  MountainList,
  TrailList,
  Summit,
  TrailCompletion,
} from "../models/index.js";
import {
  ListFilters,
  ListWithProgress,
  SeasonWithDates,
  DateRange,
} from "./types.js";
import { getSeasonForDate, transformSeasons } from "../utils/listHelpers.js";

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

    const [mountainLinks, trailLinks, summits, trailCompletions, seasonDates] =
      await Promise.all([
        MountainList.findAll({ attributes: ["listId", "mountainId"] }),
        TrailList.findAll({ attributes: ["listId", "trailId"] }),
        Summit.findAll({ attributes: ["mountainId", "completedAt"] }),
        TrailCompletion.findAll({ attributes: ["trailId", "completedAt"] }),
        Season.findAll({
          include: [
            {
              model: SeasonDate,
              attributes: ["startDate", "endDate"],
            },
          ],
        }),
      ]);

    const seasonsMap = new Map<number, SeasonWithDates>(
      seasonDates.map(transformSeasons),
    );

    return lists.map((list) => {
      const json = list.toJSON() as List;

      if (list.type === "trace") {
        // Trail
        const completedTrailIds = new Set(
          trailCompletions.map((completion) => completion.trailId),
        );

        const trailsByList = new Map<number, number[]>();
        for (const link of trailLinks) {
          const ids = trailsByList.get(link.listId) ?? [];
          ids.push(link.trailId);
          trailsByList.set(link.listId, ids);
        }

        const trailIds = trailsByList.get(list.id) ?? [];

        const filteredTrailCompletions = trailCompletions.filter((tc) =>
          trailIds.includes(tc.trailId),
        );

        const completedTrailsWithSeason = filteredTrailCompletions.reduce(
          (acc, cur) => {
            const rawTrailCompletion = cur.toJSON();
            acc[rawTrailCompletion.trailId] = {
              season: getSeasonForDate(seasonsMap, cur.completedAt),
              completedAt: rawTrailCompletion.completedAt,
            };
            return acc;
          },
          {} as Record<number, { season?: string; completedAt: string }>,
        );

        const completedTrailsDate =
          filteredTrailCompletions
            .map((trail) => new Date(trail.completedAt).getTime())
            .sort((a, b) => a - b)[0] || undefined;

        const completedCount = trailIds.filter((id) =>
          completedTrailIds.has(id),
        ).length;
        return Object.assign(json, {
          totalCount: trailIds.length,
          completedCount,
          completedDate: completedTrailsDate,
          completions: completedTrailsWithSeason,
        }) as ListWithProgress;
      }

      /// Mountain
      const completedMountainIds = new Set(
        summits.map((summit) => summit.mountainId),
      );

      const mountainsByList = new Map<number, number[]>();
      for (const link of mountainLinks) {
        const ids = mountainsByList.get(link.listId) ?? [];
        ids.push(link.mountainId);
        mountainsByList.set(link.listId, ids);
      }

      const mountainIds = mountainsByList.get(list.id) ?? [];

      const filteredSummits = summits.filter((summit) =>
        mountainIds.includes(summit.mountainId),
      );

      const completedSummitsWithSeason = filteredSummits.reduce(
        (acc, cur) => {
          const rawSummit = cur.toJSON();
          acc[rawSummit.mountainId] = {
            season: getSeasonForDate(seasonsMap, cur.completedAt),
            completedAt: rawSummit.completedAt,
          };
          return acc;
        },
        {} as Record<number, { season?: string; completedAt: string }>,
      );

      const completedMountainsDate =
        filteredSummits
          .map((summit) => summit.completedAt)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ||
        undefined;

      const completedCount = mountainIds.filter((id) =>
        completedMountainIds.has(id),
      ).length;
      return Object.assign(json, {
        totalCount: mountainIds.length,
        completedCount,
        completedDate: completedMountainsDate,
        completions: completedSummitsWithSeason,
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
