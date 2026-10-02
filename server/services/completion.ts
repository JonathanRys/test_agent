import { getLists } from "./list.js";
import { getMountainsOnList } from "./mountain.js";
import { getTrailsOnList } from "./trail.js";
import { Mountain, State, Summit } from "../models/index.js";
import { ensureInitialized } from "../utils/db.js";
import {
  getStubMountainDifficulty,
  getStubTrailDifficulty,
} from "../utils/amcRating.js";

export const PRIORITY_UNFINISHED_LIST_LIMIT = 10;
export const MAX_CACHED_REMAINING_HIKES = 40;

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
  difficulty: string | null;
  startLat: number | null;
  startLon: number | null;
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
      const leftProgress =
        left.totalCount > 0 ? left.completedCount / left.totalCount : 0;
      const rightProgress =
        right.totalCount > 0 ? right.completedCount / right.totalCount : 0;
      if (rightProgress !== leftProgress) {
        return rightProgress - leftProgress;
      }
      if (right.completedCount !== left.completedCount) {
        return right.completedCount - left.completedCount;
      }
      return left.remainingCount - right.remainingCount;
    });
}

const DIFFICULTY_ORDER = [
  "accessible",
  "relaxed",
  "easy",
  "moderate",
  "vigorous",
  "strenuous",
];

function difficultyScore(hike: RemainingHike): number {
  const difficulty = hike.difficulty;
  if (typeof difficulty === "string") {
    return DIFFICULTY_ORDER.indexOf(difficulty.toLowerCase());
  }
  if (difficulty && typeof difficulty === "object") {
    const high = (difficulty as { high?: unknown }).high;
    if (typeof high === "string") {
      return DIFFICULTY_ORDER.indexOf(high.toLowerCase());
    }
  }
  return -1;
}

function skillTarget(fitnessLevel?: string | null): number {
  if (fitnessLevel === "beginner") return 2;
  if (fitnessLevel === "expert") return 4;
  return 3;
}

export function prioritizeHikesForFitness(
  hikes: RemainingHike[],
  fitnessLevel?: string | null,
): RemainingHike[] {
  const target = skillTarget(fitnessLevel);
  return [...hikes].sort((left, right) => {
    const leftScore = difficultyScore(left);
    const rightScore = difficultyScore(right);
    const leftDistance =
      leftScore < 0 ? Number.POSITIVE_INFINITY : Math.abs(leftScore - target);
    const rightDistance =
      rightScore < 0 ? Number.POSITIVE_INFINITY : Math.abs(rightScore - target);
    return leftDistance - rightDistance || leftScore - rightScore;
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
          difficulty: getStubTrailDifficulty(trail.id)?.rating ?? null,
          startLat: typeof plain.startLat === "number" ? plain.startLat : null,
          startLon: typeof plain.startLon === "number" ? plain.startLon : null,
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
  fitnessLevel?: string | null,
): Promise<PriorityUnfinishedList[]> {
  const lists = rankUnfinishedListsByCompletions(
    await getListCompletionStatus(userId),
  ).slice(0, PRIORITY_UNFINISHED_LIST_LIMIT);

  const prioritized = await Promise.all(
    lists.map(async (list) => ({
      ...list,
      remainingHikes: await remainingHikesForList(list, userId),
    })),
  );

  const hasStartedList = prioritized.some((list) => list.completedCount > 0);
  if (hasStartedList) {
    let remainingSlots = MAX_CACHED_REMAINING_HIKES;
    return prioritized.map((list) => {
      const remainingHikes = list.remainingHikes.slice(0, remainingSlots);
      remainingSlots -= remainingHikes.length;
      return { ...list, remainingHikes };
    });
  }

  const rankedHikes = prioritizeHikesForFitness(
    prioritized.flatMap((list) => list.remainingHikes),
    fitnessLevel,
  ).slice(0, MAX_CACHED_REMAINING_HIKES);
  const included = new Set(rankedHikes.map((hike) => `${hike.kind}:${hike.id}`));
  return prioritized.map((list) => ({
    ...list,
    remainingHikes: list.remainingHikes.filter((hike) =>
      included.has(`${hike.kind}:${hike.id}`),
    ),
  }));
}
