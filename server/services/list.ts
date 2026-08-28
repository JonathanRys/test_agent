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

    const globalSeasonsMap = new Map<number, SeasonWithDates>(
      seasonDates.map((seasonModel) => {
        // TODO: extract to utils
        const json = seasonModel.toJSON() as any;
        const seasonDatesArray = (json.SeasonDates || []) as Array<{
          startDate: string;
          endDate: string;
        }>;

        const formatDate = (dateInput: any): string => {
          if (!dateInput) return "";
          const parsedDate = new Date(dateInput);
          if (isNaN(parsedDate.getTime())) return "";
          return parsedDate.toISOString().split("T")[0];
        };

        // 1. Map over all 50+ entries to build an array of clean date range strings
        const ranges: DateRange[] = seasonDatesArray
          .map((dateBlock) => ({
            startDate: formatDate(dateBlock.startDate),
            endDate: formatDate(dateBlock.endDate),
          }))
          .filter((range) => range.startDate !== "" && range.endDate !== ""); // Clear out bad values

        return [
          seasonModel.id,
          {
            id: json.id,
            name: json.name,
            ranges, // 2. Store the full collection of intervals safely inside this season key
          } satisfies SeasonWithDates,
        ];
      }),
    );

    const getSeasonForDate = (
      completedAtStr: string | Date | undefined,
    ): string | undefined => {
      if (!completedAtStr) return undefined;

      // Format standard completion target date string into YYYY-MM-DD
      const compDateStr = new Date(completedAtStr).toISOString().split("T")[0];

      // Loop through all seasons (Spring, Summer, Autumn, Winter) inside our configuration map
      for (const season of globalSeasonsMap.values()) {
        // Check if the timestamp hits ANY historical year range entry for this specific season
        const matchesSeason = season.ranges.some(
          (range) =>
            compDateStr >= range.startDate && compDateStr <= range.endDate,
        );

        if (matchesSeason) {
          return season.name; // Return "Summer", "Winter", etc. immediately upon match
        }
      }

      return undefined;
    };

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
        const completedTrails = trailCompletions.filter((trailCompletion) =>
          trailIds.includes(trailCompletion.trailId),
        );

        const completedTrailsWithSeason = trailCompletions
          .filter((tc) => trailIds.includes(tc.trailId))
          .map((tc) => ({
            ...tc.toJSON(), // Grab original data model properties cleanly
            season: getSeasonForDate(tc.completedAt), // Append calculated season name string field
          }));

        const completedTrailsDate =
          completedTrailsWithSeason
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

      const completedSummitsWithSeason = summits
        .filter((summit) => mountainIds.includes(summit.mountainId))
        .map((summit) => ({
          ...summit.toJSON(), // Grab original data model properties cleanly
          season: getSeasonForDate(summit.completedAt), // Append calculated season name string field
        }));

      const completedMountainsDate =
        completedSummitsWithSeason
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
