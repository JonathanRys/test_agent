import type { Mountain } from "../types/Mountain";
import type { Trail } from "../types/Trail";
import { Completion } from "../types/Completion";

interface AdventureCompletion extends Completion {
  adventureId: number;
}

/// Use DIP with the Completion interface
type Adventure = Mountain | Trail;

// Result
type RuleResult = {
  totalCount: number;
  completedCount?: number;
};

// Rule types
type CompletionRule = (adventures: Adventure[]) => boolean;
type FilterRule = (adventures: Adventure[]) => Adventure[];
type UniqueDateRule = (
  adventures: Adventure[],
  listCount: number,
) => RuleResult;
type SeasonRule = (adventures: Adventure[], listCount: number) => RuleResult;
type GridRule = (adventures: Adventure[], listCount: number) => RuleResult;

// Composite rule
type ListRules = {
  [listId: number]: {
    grid?: GridRule;
    season?: SeasonRule;
    uniqueDate?: UniqueDateRule;
    count?: CompletionRule;
    filter?: FilterRule;
  };
};

// Utils
const getCompletions = (adventure: Adventure): Array<Completion> => {
  if (!adventure) return [];

  if ("Summits" in adventure) {
    return adventure.Summits || [];
  } else if ("TrailCompletions" in adventure) {
    return adventure.TrailCompletions || [];
  }

  return [];
};

// Composable functions
const withCountConstraint = (
  count: number,
): ((adventures: Adventure[]) => boolean) => {
  return (adventures: Adventure[]) => {
    // check completed date count
    const completionCount = adventures.reduce((acc, cur) => {
      const completions = getCompletions(cur);
      if (completions.length) return acc + 1;
      return acc;
    }, 0);
    return completionCount >= count;
  };
};

// Constraints
const uniqueDateConstraint = (
  adventures: Adventure[],
  listCount: number,
): RuleResult => {
  const usedDates = new Set<string>();
  const satisfiedAdventures = new Set<number>();

  const completions: Array<AdventureCompletion> = [];

  adventures.forEach((adventure) => {
    getCompletions(adventure).forEach((completion) => {
      completions.push({ adventureId: adventure.id, ...completion });
    });
  });

  // order completions by date so we use the oldest date for the first adventure found
  const orderedCompletions = [...completions].sort(
    (a, b) =>
      new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(),
  );

  orderedCompletions.forEach((completion) => {
    // Normalizing to ISO string or short date string ensures accurate date matching
    const dateKey = new Date(completion.completedAt)
      .toISOString()
      .split("T")[0];

    // If the date hasn't been claimed yet, claim it for this adventure
    if (!usedDates.has(dateKey)) {
      usedDates.add(dateKey);
      satisfiedAdventures.add(completion.adventureId);
    }
  });

  return {
    completedCount: satisfiedAdventures.size,
    totalCount: listCount,
  };
};

const seasonConstraint = (adventures: Adventure[], listCount: number) => {
  const NUM_SEASONS = 4;
  return {
    completedCount: 1,
    totalCount: NUM_SEASONS * listCount,
  };
};

const gridConstraint = (
  adventures: Adventure[],
  listCount: number,
): RuleResult => {
  const MO_PER_YEAR = 12;
  return {
    completedCount: 1,
    totalCount: MO_PER_YEAR * listCount,
  };
};

// List rules map
export const listRules: ListRules = {
  9: { uniqueDate: uniqueDateConstraint }, // Trailwrights
  19: { count: withCountConstraint(5) }, // Fire Towers
  20: { season: seasonConstraint }, // 4-seasons TODO: add seasons table and include season in the adventure data
  21: { grid: gridConstraint }, // Grid
};
