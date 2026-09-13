import { getLists } from "./list.js";

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
