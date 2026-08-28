import type { State } from "./State";
import type { List } from "./List";
import type { Completion } from "./Completion";

export type Mountain = {
  id: number;
  name: string;
  height: number;
  prominence: number;
  distance?: number;
  state: State;
  range?: string;
  bushwhack?: boolean;
  notes?: string;
  lat?: number;
  lon?: number;
  Lists?: List[];
  Summits?: Array<Completion>;
};
