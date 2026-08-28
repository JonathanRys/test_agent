import type { State } from "../types/State";
import type { Mountain } from "../types/Mountain";
import type { Trail } from "../types/Trail";
import type { LineString, Position } from "geojson";
import { Completion } from "../types/Completion";

// Type guards
function isValidPosition(position: unknown): position is Position {
  if (!Array.isArray(position)) {
    return false;
  }

  // Must have at least 2 elements (X and Y), and max 3 (Z/Elevation)
  if (position.length < 2 || position.length > 3) {
    return false;
  }

  return position.every((coord) => typeof coord === "number" && !isNaN(coord));
}

export function isLineString(obj: unknown): obj is LineString {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  // Cast safely to check properties dynamically
  const candidate = obj as Record<string, unknown>;

  if (candidate.type !== "LineString") {
    return false;
  }

  if (!Array.isArray(candidate.coordinates)) {
    return false;
  }

  // Per RFC 7946: A LineString must have 2 or more positions
  if (candidate.coordinates.length < 2) {
    return false;
  }

  return candidate.coordinates.every(isValidPosition);
}

export function isCompletion(obj: any): obj is Completion {
  return (
    obj && typeof obj.id === "number" && typeof obj.completedAt === "string"
  );
}

export function isState(obj: any): obj is State {
  return (
    obj &&
    typeof obj.id === "number" &&
    typeof obj.name === "string" &&
    typeof obj.abbreviation === "string"
  );
}

export function isMountain(obj: any): obj is Mountain {
  return (
    obj &&
    typeof obj.id === "number" &&
    typeof obj.name === "string" &&
    typeof obj.height === "number" &&
    typeof obj.prominence === "number" &&
    (obj.distance === undefined || typeof obj.distance === "number") &&
    (obj.state === undefined || isState(obj.state)) &&
    (obj.range === undefined || typeof obj.range === "string") &&
    (obj.bushwhack === undefined || typeof obj.bushwhack === "boolean") &&
    (obj.notes === undefined || typeof obj.notes === "string") &&
    (obj.lat === undefined || typeof obj.lat === "number") &&
    (obj.lon === undefined || typeof obj.lon === "number") &&
    (obj.Summits === undefined || obj.Summits.every(isCompletion))
  );
}

export function isTrail(obj: any): obj is Trail {
  return (
    obj &&
    typeof obj.id === "number" &&
    typeof obj.name === "string" &&
    (obj.description === undefined || typeof obj.description === "string") &&
    (obj.required === undefined || typeof obj.required === "boolean") &&
    (obj.state === undefined || isState(obj.state)) &&
    (obj.distance === undefined || typeof obj.distance === "number") &&
    (obj.elevationGain === undefined ||
      typeof obj.elevationGain === "number") &&
    (obj.elevationLoss === undefined ||
      typeof obj.elevationLoss === "number") &&
    (obj.startLat === undefined || typeof obj.startLat === "number") &&
    (obj.startLon === undefined || typeof obj.startLon === "number") &&
    (obj.endLat === undefined || typeof obj.endLat === "number") &&
    (obj.endLon === undefined || typeof obj.endLon === "number") &&
    (obj.gpx === undefined || isLineString(obj.gpx)) &&
    (obj.embeddedGpx === undefined || typeof obj.embeddedGpx === "string") &&
    (obj.TrailCompletions === undefined ||
      obj.TrailCompletions.every(isCompletion))
  );
}
