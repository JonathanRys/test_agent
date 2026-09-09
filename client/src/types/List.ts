import type { ComponentType } from "react";

export type List = {
  id: number;
  name: string;
  abbreviation: string;
};

export type MountainFilterState = {
  state: string;
  completion: "all" | "hiked" | "unhiked";
  season: string;
  month: string;
  trail: "all" | "marked" | "bushwhack";
  list: string;
};

type ListItem = {
  TrailCompletions?: unknown[];
  Summits?: unknown[];
  RockClimbingCompletions?: unknown[];
  TrailMaintenanceCompletions?: unknown[];
  id: number;
};

export type ListDefinition = {
  endpoint: (id: number) => string;
  item: ComponentType<any>;
  itemKey: string;
  isCompleted: (item: ListItem) => boolean;
};
