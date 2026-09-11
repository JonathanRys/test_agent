import type { ChangeEvent } from "react";
import type { List, MountainFilterState } from "../types/List";
import type { Mountain } from "../types/Mountain";

export type MountainFiltersProps = {
  mountains: Mountain[];
  activeListId: number;
  isAuthenticated: boolean;
  value: MountainFilterState;
  onChange: (value: MountainFilterState) => void;
  onReset: () => void;
};

export const initialMountainFilters: MountainFilterState = {
  state: "all",
  completion: "all",
  season: "all",
  month: "all",
  trail: "all",
  list: "all",
};

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function filterMountains(
  mountains: Mountain[],
  filters: MountainFilterState,
  isAuthenticated = true,
): Mountain[] {
  const completionFilters = isAuthenticated
    ? filters
    : { ...filters, completion: "all", season: "all", month: "all" };

  return mountains.filter((item) => {
    const summits = item.Summits ?? [];
    const hiked = summits.length > 0;
    const completionMonths = summits.map((summit) =>
      new Date(summit.completedAt).getMonth().toString(),
    );

    return (
      (filters.state === "all" || item.state?.abbreviation === filters.state) &&
      (completionFilters.completion === "all" ||
        (completionFilters.completion === "hiked" && hiked) ||
        (completionFilters.completion === "unhiked" && !hiked)) &&
      (completionFilters.season === "all" ||
        summits.some((summit) => summit.season === completionFilters.season)) &&
      (completionFilters.month === "all" ||
        completionMonths.includes(completionFilters.month)) &&
      (filters.trail === "all" ||
        (filters.trail === "bushwhack" && item.bushwhack) ||
        (filters.trail === "marked" && !item.bushwhack)) &&
      (filters.list === "all" ||
        item.Lists?.some((list) => String(list.id) === filters.list))
    );
  });
}

function updateFilter(
  onChange: MountainFiltersProps["onChange"],
  value: MountainFilterState,
  key: keyof MountainFilterState,
  event: ChangeEvent<HTMLSelectElement>,
) {
  onChange({ ...value, [key]: event.target.value });
}

function getListOptions(mountains: Mountain[], activeListId: number): List[] {
  return Array.from(
    new Map(
      mountains
        .flatMap((item) => item.Lists ?? [])
        .filter((list) => list.id !== activeListId)
        .map((list) => [list.id, list]),
    ).values(),
  ).sort((left, right) => left.abbreviation.localeCompare(right.abbreviation));
}

export default function MountainFilters({
  mountains,
  activeListId,
  isAuthenticated,
  value,
  onChange,
  onReset,
}: MountainFiltersProps) {
  const states = Array.from(
    new Map(
      mountains
        .filter((item) => item.state)
        .map((item) => [item.state.abbreviation, item.state]),
    ).values(),
  ).sort((left, right) => left.abbreviation.localeCompare(right.abbreviation));
  const seasons = Array.from(
    new Set(
      mountains.flatMap((item) =>
        (item.Summits ?? []).map((summit) => summit.season).filter(Boolean),
      ),
    ),
  ).sort();
  const hikedMonths = Array.from(
    new Set(
      mountains.flatMap((item) =>
        (item.Summits ?? [])
          .filter(
            (summit) =>
              value.season === "all" || summit.season === value.season,
          )
          .map((summit) => new Date(summit.completedAt).getMonth()),
      ),
    ),
  ).sort((left, right) => left - right);
  const lists = getListOptions(mountains, activeListId);

  return (
    <div className="list-filters" aria-label="Mountain filters">
      <label>
        State
        <select
          value={value.state}
          onChange={(event) => updateFilter(onChange, value, "state", event)}
        >
          <option value="all">All states</option>
          {states.map((state) => (
            <option key={state.abbreviation} value={state.abbreviation}>
              {state.abbreviation}
            </option>
          ))}
        </select>
      </label>
      {isAuthenticated && (
        <>
          <label>
            Completion
            <select
              value={value.completion}
              onChange={(event) =>
                updateFilter(onChange, value, "completion", event)
              }
            >
              <option value="all">All</option>
              <option value="hiked">Hiked</option>
              <option value="unhiked">Unhiked</option>
            </select>
          </label>
          <label>
            Season hiked
            <select
              value={value.season}
              onChange={(event) =>
                updateFilter(onChange, value, "season", event)
              }
            >
              <option value="all">Any season</option>
              {seasons.map((season) => (
                <option key={season} value={season}>
                  {season}
                </option>
              ))}
            </select>
          </label>
          <label>
            Month hiked
            <select
              value={value.month}
              onChange={(event) =>
                updateFilter(onChange, value, "month", event)
              }
            >
              <option value="all">Any month</option>
              {hikedMonths.map((monthIndex) => (
                <option key={monthIndex} value={String(monthIndex)}>
                  {monthNames[monthIndex]}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <label>
        Trail type
        <select
          value={value.trail}
          onChange={(event) => updateFilter(onChange, value, "trail", event)}
        >
          <option value="all">All trails</option>
          <option value="marked">Marked trail</option>
          <option value="bushwhack">Bushwhack</option>
        </select>
      </label>
      <label>
        Other list
        <select
          value={value.list}
          onChange={(event) => updateFilter(onChange, value, "list", event)}
        >
          <option value="all">Any list</option>
          {lists.map((list) => (
            <option key={list.id} title={list.name} value={String(list.id)}>
              {list.abbreviation}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="filter-reset" onClick={onReset}>
        Reset
      </button>
    </div>
  );
}
