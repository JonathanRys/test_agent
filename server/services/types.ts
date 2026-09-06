import type { List, Mountain, Trail } from "../models/index.js";

export type DateRange = {
  startDate: string;
  endDate: string;
};

export type SeasonWithDates = {
  id: number;
  name: string;
  seasonDates: DateRange[];
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

// Define a type for the Summit model with an optional season property
interface SummitWithSeason {
  id: number;
  completedAt: string | Date;
  adventureId: number;
  season?: string;
  [key: string]: any;
}

export interface MountainWithRelations extends Mountain {
  Summits?: SummitWithSeason[];
}

export interface TrailWithRelations extends Trail {
  Summits?: SummitWithSeason[];
}
