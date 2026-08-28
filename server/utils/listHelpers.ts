import { Season } from "../models/Season.js";
import { SeasonWithDates, DateRange } from "../services/types.js";

export const transformSeasons = (
  seasonModel: Season,
): [number, SeasonWithDates] => {
  const json = seasonModel.toJSON() as any;
  const seasonDatesArray = (json.SeasonDates || []) as Array<{
    startDate: string;
    endDate: string;
  }>;

  const formatDate = (dateInput: any): string => {
    if (!dateInput) return "";
    const parsedDate = new Date(dateInput);
    if (isNaN(parsedDate.getTime())) return "";
    return parsedDate.toISOString().split("T")[0];
  };

  const ranges: DateRange[] = seasonDatesArray
    .map((dateBlock) => ({
      startDate: formatDate(dateBlock.startDate),
      endDate: formatDate(dateBlock.endDate),
    }))
    .filter((range) => range.startDate !== "" && range.endDate !== ""); // Clear out bad values

  return [
    seasonModel.id,
    {
      id: json.id,
      name: json.name,
      ranges,
    } satisfies SeasonWithDates,
  ];
};

export const getSeasonForDate = (
  globalSeasonsMap: Map<number, SeasonWithDates>,
  completedAt: string | Date | undefined,
): string | undefined => {
  if (!completedAt) return undefined;

  // Format standard completion target date string into YYYY-MM-DD
  const compDateStr = new Date(completedAt).toISOString().split("T")[0];

  // Loop through all seasons (Spring, Summer, Autumn, Winter) inside our configuration map
  for (const season of globalSeasonsMap.values()) {
    // Check if the timestamp hits ANY historical year range entry for this specific season
    const matchesSeason = season.ranges.some(
      (range) => compDateStr >= range.startDate && compDateStr <= range.endDate,
    );

    if (matchesSeason) {
      return season.name;
    }
  }

  return undefined;
};
