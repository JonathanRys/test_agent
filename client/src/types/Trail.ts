import type { LineString } from "geojson";
import type { State } from "./State";
import type { Completion } from "./Completion";
import { List } from "./List";

export type Trail = {
  id: number;
  name: string;
  description?: string;
  required?: boolean;
  state?: State;
  distance?: number;
  elevationGain?: number;
  elevationLoss?: number;
  startLat?: number;
  startLon?: number;
  endLat?: number;
  endLon?: number;
  gpx?: LineString;
  embeddedGpx?: string;
  season: string;
  Lists?: List[];
  TrailCompletions?: Array<Completion>;
};
