import type { ComponentType } from "react";

export type List = {
  id: number;
  name: string;
  abbreviation: string;
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
