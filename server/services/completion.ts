import { getLists } from "./list.js";
import { getMountainsOnList } from "./mountain.js";
import { getTrailsOnList } from "./trail.js";
import { Mountain, State, Summit } from "../models/index.js";
import { ensureInitialized } from "../utils/db.js";
import { getStubMountainDifficulty } from "../utils/amcRating.js";

export const PRIORITY_UNFINISHED_LIST_LIMIT = 10;

export type ListCompletionStatus = {
  id: number;
  name: string;
  abbreviation: string;
  type: "peakbagging" | "trace";
  totalCount: number;
  completedCount: number;
  remainingCount: number;
  complete: boolean;
};

export type CompletedPeak = {
  id: number;
  name: string;
  state: string | null;
  height: number;
  distance: number | null;
  bushwhack: boolean;
  completedAt: Date;
};

export type CompletedTrail = {
  id: number;
  name: string;
  state: string | null;
  distance: number | null;
  elevationGain: number | null;
  completedAt: Date;
};

export async function getUserCompletedPeaks(
  userId: number,
): Promise<CompletedPeak[]> {
  await ensureInitialized();
  const completions = await Summit.findAll({
    where: { userId },
    include: [
      {
        model: Mountain,
        attributes: ["id", "name", "height", "distance", "bushwhack"],
        include: [{ model: State, as: "state", attributes: ["abbreviation"] }],
      },
    ],
    order: [["completedAt", "DESC"]],
  });

  return completions.flatMap((completion) => {
    const peak = (completion as any).Mountain;
    if (!peak) return [];
    const state = peak.state?.abbreviation ?? null;
    return [
      {
        id: peak.id,
        name: peak.name,
        state,
        height: peak.height,
        distance: peak.distance,
        bushwhack: Boolean(peak.bushwhack),
        completedAt: (completion as any).completedAt,
      },
    ];
  });
}

export type RemainingPeak = {
  kind: "peak";
  id: number;
  name: string;
  state: string | null;
  height: number;
  distance: number | null;
  bushwhack: boolean;
  difficulty: ReturnType<typeof getStubMountainDifficulty>;
  range: string | null;
  routeDetails: string | null;
  // Coordinates power the injected weather snapshot (null when the seed data
  // lacks them — the agent then falls back to the forecast reference links).
  lat: number | null;
  lon: number | null;
  // Best-effort current conditions attached at read time by withPeakWeather();
  // never persisted in the profile/lists cache.
  weather?: string;
};

export type RemainingTrail = {
  kind: "trail";
  id: number;
  name: string;
  state: string | null;
  distance: number | null;
  elevationGain: number | null;
  elevationLoss: number | null;
  routeDetails: string | null;
};

export type RemainingHike = RemainingPeak | RemainingTrail;

export type PriorityUnfinishedList = ListCompletionStatus & {
  remainingHikes: RemainingHike[];
};

export function rankUnfinishedListsByCompletions(
  lists: ListCompletionStatus[],
): ListCompletionStatus[] {
  return lists
    .filter((list) => !list.complete)
    .sort((left, right) => {
      if (right.completedCount !== left.completedCount) {
        return right.completedCount - left.completedCount;
      }
      return left.remainingCount - right.remainingCount;
    });
}

export async function getListCompletionStatus(
  userId: number,
): Promise<ListCompletionStatus[]> {
  const lists = await getLists({}, userId);

  return lists.map((list) => {
    const completedCount = list.completedCount ?? 0;
    const totalCount = list.totalCount;
    const remainingCount = Math.max(totalCount - completedCount, 0);

    return {
      id: list.id,
      name: list.name,
      abbreviation: list.abbreviation,
      type: list.type,
      totalCount,
      completedCount,
      remainingCount,
      complete: remainingCount === 0,
    };
  });
}

function associatedStateAbbreviation(entity: {
  state?: { abbreviation?: string } | string | null;
}): string | null {
  if (!entity.state || typeof entity.state === "string") {
    return entity.state ?? null;
  }
  return entity.state.abbreviation ?? null;
}

async function remainingHikesForList(
  list: ListCompletionStatus,
  userId: number,
): Promise<RemainingHike[]> {
  if (list.type === "trace") {
    const trails = await getTrailsOnList(list.id, userId);
    return trails
      .filter((trail) => !trail.TrailCompletions?.length)
      .map((trail) => {
        const plain =
          typeof (trail as { get?: unknown }).get === "function"
            ? ((trail as { get: (opts: { plain: boolean }) => Record<string, unknown> }).get({ plain: true }) as Record<string, unknown>)
            : (trail as unknown as Record<string, unknown>);
        return {
          kind: "trail" as const,
          id: trail.id,
          name: trail.name,
          state: associatedStateAbbreviation(trail),
          distance: trail.distance ?? null,
          elevationGain: trail.elevationGain ?? null,
          elevationLoss: (plain.elevationLoss as number | null | undefined) ?? null,
          routeDetails:
            (plain.description as string | null | undefined) ?? null,
        };
      });
  }

  const mountains = await getMountainsOnList(list.id, userId);
  return mountains
    .filter((mountain) => !mountain.Summits?.length)
    .map((mountain) => {
      const plain =
        typeof (mountain as { get?: unknown }).get === "function"
          ? ((mountain as { get: (opts: { plain: boolean }) => Record<string, unknown> }).get({ plain: true }) as Record<string, unknown>)
          : (mountain as unknown as Record<string, unknown>);
      return {
        kind: "peak" as const,
        id: mountain.id,
        name: mountain.name,
        state: associatedStateAbbreviation(mountain),
        height: mountain.height,
        distance: mountain.distance ?? null,
        bushwhack: Boolean(mountain.bushwhack),
        difficulty: getStubMountainDifficulty(mountain.id),
        range: (plain.range as string | null | undefined) ?? null,
        routeDetails: (plain.notes as string | null | undefined) ?? null,
        lat: typeof plain.lat === "number" ? plain.lat : null,
        lon: typeof plain.lon === "number" ? plain.lon : null,
      };
    });
}

export async function getPriorityUnfinishedLists(
  userId: number,
): Promise<PriorityUnfinishedList[]> {
  const lists = rankUnfinishedListsByCompletions(
    await getListCompletionStatus(userId),
  ).slice(0, PRIORITY_UNFINISHED_LIST_LIMIT);

  return Promise.all(
    lists.map(async (list) => ({
      ...list,
      remainingHikes: await remainingHikesForList(list, userId),
    })),
  );
}
