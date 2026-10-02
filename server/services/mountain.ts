import { Op, Sequelize } from "sequelize";

import { ensureInitialized } from "../utils/db.js";
import {
  State,
  Mountain,
  List,
  Summit,
  SeasonDate,
  Season,
} from "../models/index.js";
import { completionInclude } from "./common.js";
import type { MountainWithRelations, SeasonWithDates } from "./types.js";
import { getSeasonForDate } from "../utils/listHelpers.js";

export async function getMountain(id: number): Promise<Mountain | null> {
  try {
    await ensureInitialized();
    const mountain = await Mountain.findOne({
      where: {
        id,
      },
      include: [
        {
          model: State,
          as: "state",
          attributes: ["id", "name", "abbreviation"],
        },
        {
          model: List,
          attributes: ["id", "name", "abbreviation"],
          through: { attributes: [] },
        },
      ],
    });

    if (!mountain) {
      return null;
    }

    return mountain;
  } catch (error) {
    console.error(`Error fetching mountain ${id} from database:`, error);
    return null;
  }
}

export async function searchMountainsByName(
  query: string,
): Promise<Mountain[]> {
  await ensureInitialized();
  const term = query.trim().replace(/[%_]/g, "");
  if (term.length < 2) return [];

  return Mountain.findAll({
    where: { name: { [Op.like]: `%${term}%` } },
    order: [["name", "ASC"]],
    limit: 12,
    include: [
      {
        model: State,
        as: "state",
        attributes: ["id", "name", "abbreviation"],
      },
      {
        model: List,
        attributes: ["id", "name", "abbreviation"],
        through: { attributes: [] },
      },
    ],
  });
}

export type NearbyMountain = {
  id: number;
  name: string;
  lat: number;
  lon: number;
  distanceMiles: number;
  [key: string]: unknown;
};

export function rankNearbyMountains<
  T extends NearbyMountain & { drivingMiles?: number | null },
>(
  mountains: T[],
  useDrivingDistance: boolean,
  limit = 8,
): T[] {
  return [...mountains]
    .sort((left, right) => {
      const leftDistance = useDrivingDistance
        ? left.drivingMiles!
        : left.distanceMiles;
      const rightDistance = useDrivingDistance
        ? right.drivingMiles!
        : right.distanceMiles;
      return leftDistance - rightDistance;
    })
    .slice(0, limit);
}

export function distanceBetweenMiles(
  start: { lat: number; lon: number },
  end: { lat: number; lon: number },
): number {
  const radians = Math.PI / 180;
  const latitudeDelta = (end.lat - start.lat) * radians;
  const longitudeDelta = (end.lon - start.lon) * radians;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(start.lat * radians) *
      Math.cos(end.lat * radians) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export async function getNearbyMountains(
  lat: number,
  lon: number,
  radiusMiles = 100,
  limit = 40,
): Promise<NearbyMountain[]> {
  await ensureInitialized();
  const latitudeSpan = radiusMiles / 69;
  const longitudeSpan =
    radiusMiles / (69 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  const mountains = await Mountain.findAll({
    where: {
      lat: { [Op.between]: [lat - latitudeSpan, lat + latitudeSpan] },
      lon: { [Op.between]: [lon - longitudeSpan, lon + longitudeSpan] },
    },
    include: [
      {
        model: State,
        as: "state",
        attributes: ["id", "name", "abbreviation"],
      },
      {
        model: List,
        attributes: ["id", "name", "abbreviation"],
        through: { attributes: [] },
      },
    ],
  });

  return mountains
    .map((mountain) => {
      const plain = mountain.toJSON() as Record<string, unknown>;
      const mountainLat = Number(plain.lat);
      const mountainLon = Number(plain.lon);
      return {
        ...plain,
        distanceMiles: distanceBetweenMiles(
          { lat, lon },
          { lat: mountainLat, lon: mountainLon },
        ),
      } as NearbyMountain;
    })
    .filter((mountain) => mountain.distanceMiles <= radiusMiles)
    .sort((left, right) => left.distanceMiles - right.distanceMiles)
    .slice(0, limit);
}

type MountainFilters = {
  state?: Mountain["state"];
  range?: Mountain["range"];
};

export async function getMountains(
  filters: MountainFilters,
): Promise<Mountain[]> {
  try {
    await ensureInitialized();
    const { state, range } = filters;

    const whereQuery: Record<string, string> = {};

    if (range !== undefined) whereQuery.range = range;

    const mountains = await Mountain.findAll({
      where: whereQuery,
      order: [["height", "ASC"]],
      include: [
        {
          model: State,
          as: "state",
          attributes: ["id", "name", "abbreviation"],
          ...(state !== undefined
            ? { where: { abbreviation: state }, required: true }
            : {}),
        },
      ],
    });

    return mountains;
  } catch (error) {
    console.error(
      `Error fetching mountains from database:`,
      `Filters:\n${JSON.stringify(filters)}`,
      error,
    );
    return [];
  }
}

export async function getMountainsOnList(
  listId: number,
  userId?: number,
): Promise<MountainWithRelations[]> {
  try {
    await ensureInitialized();
    const mountains = await Mountain.findAll({
      order: [["height", "DESC"]],
      where: Sequelize.literal(`
        "Mountain"."id" IN (
          SELECT "MountainId" FROM "MountainLists"
          WHERE "listId" = :listIdValue
        )
      `),
      replacements: { listIdValue: Number(listId) },
      include: [
        {
          model: List,
          attributes: ["id", "name", "abbreviation"],
          through: {
            attributes: [],
          },
        },
        {
          model: State,
          as: "state",
          attributes: ["id", "name", "abbreviation"],
        },
        {
          model: Summit,
          attributes: ["id", "completedAt", "adventureId", "season"],
          where: userId ? { userId } : { userId: -1 },
          required: false,
          include: [completionInclude],
        },
      ],
    });

    // Query Season and SeasonDate for all seasons and their date ranges
    const seasonDates = await Season.findAll({
      include: [
        {
          model: SeasonDate,
          attributes: ["startDate", "endDate"],
        },
      ],
    });

    // Create seasons map
    const seasonsMap = new Map<number, SeasonWithDates>(
      seasonDates.map((instance) => {
        const json = instance.toJSON() as any;
        return [
          json.id,
          {
            ...json,
            // Safely fall back to an empty array if SeasonDates is missing or undefined
            seasonDates: json.SeasonDates || [],
          },
        ];
      }),
    );

    // Add season information to each summit based on the completion date
    const mountainsWithSeasons = mountains.map((mountain) => {
      const plainMountain = mountain.get({
        plain: true,
      }) as MountainWithRelations;

      if (plainMountain.Summits) {
        plainMountain.Summits = plainMountain.Summits.map((summit) => ({
          ...summit,
          season:
            summit.season ?? getSeasonForDate(seasonsMap, summit.completedAt),
        }));
      }

      return plainMountain;
    });

    return mountainsWithSeasons;
  } catch (error) {
    console.error(`Error fetching mountains from database:`, error);
    return [];
  }
}
