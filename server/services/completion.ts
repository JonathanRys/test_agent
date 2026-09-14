import { getLists } from "./list.js";
import { Mountain, State, Summit } from "../models/index.js";
import { ensureInitialized } from "../utils/db.js";

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

export function sortListCompletionStatus(
  lists: ListCompletionStatus[],
): ListCompletionStatus[] {
  return [...lists].sort((left, right) => {
    if (left.complete !== right.complete) return left.complete ? 1 : -1;
    return right.remainingCount - left.remainingCount;
  });
}

export async function getListCompletionStatus(
  userId: number,
): Promise<ListCompletionStatus[]> {
  const lists = await getLists({}, userId);

  return sortListCompletionStatus(
    lists.map((list) => {
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
    }),
  );
}
