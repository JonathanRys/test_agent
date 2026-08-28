import { List } from "../models/index.js";
export type DateRange = {
  startDate: string;
  endDate: string;
};

// Update your type to carry an array of historical ranges
export type SeasonWithDates = {
  id: number;
  name: string;
  ranges: DateRange[];
};

export type ListWithProgress = List & {
  totalCount: number;
  completedCount: number;
};

export type ListFilters = {
  type?: List["type"];
};

export type DeleteAdventureInput = {
  id: number;
  mountainId?: number;
  trailId?: number;
};

export type EditAdventureInput = {
  id: number;
  activityDate: Date | string;
  activityId?: number;
  mountainId?: number;
  trailId?: number;
};

export type CreateAdventureInput = {
  name: string;
  activityId: number;
  activityDate: Date | string;
  mountainIds?: number[];
  trailIds?: number[];
};
