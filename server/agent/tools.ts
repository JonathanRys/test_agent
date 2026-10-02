import { getAdventures } from "../services/adventure.js";
import {
  getMountain,
  getNearbyMountains,
  rankNearbyMountains,
  searchMountainsByName,
} from "../services/mountain.js";
import { geocodeLocation } from "../services/geocoding.js";
import { getTrail } from "../services/trail.js";
import {
  fetchPeakWeather,
  formatPeakWeather,
  getPeakWeatherSnapshot,
  pickWeatherUnits,
} from "../services/weather.js";
import { getUserProfile } from "../services/profile.js";
import { getDrivingDistances } from "../services/routing.js";
import { getStubMountainDifficulty } from "../utils/amcRating.js";

export type ToolResult = {
  ok: boolean;
  message: string;
};

export const applicationTools = [
  {
    type: "function",
    function: {
      name: "get_hike_details",
      description:
        "LAST RESORT ONLY. Get full details for ONE peak or trail already listed in the injected remainingHikes context. Call ONLY when the user explicitly asks for specifics (route, distance, directions) about ONE named hike AND the injected routeDetails are insufficient. NEVER call to enrich a recommendation list. NEVER call more than once per turn. NEVER call in parallel.",
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["peak", "trail"] },
          id: { type: "integer", minimum: 1 },
        },
        required: ["kind", "id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_user_adventures",
      description:
        "LAST RESORT ONLY. Get past adventures. Call ONLY when the user explicitly asks about their history. NEVER for recommendations.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
] as const;

export const mountainSearchTool = {
  type: "function",
  function: {
    name: "search_mountains",
    description:
      "Verify candidate peak names against the mountain database for a location-based recommendation. Returns canonical IDs, facts, and actual list memberships. Use once before recommending peaks outside the injected unfinished lists; never infer list membership from geography.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          minLength: 2,
          maxLength: 80,
          description: "Peak name or distinctive name fragment, e.g. Monadnock.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
} as const;

export const nearbyMountainSearchTool = {
  type: "function",
  function: {
    name: "find_nearby_mountains",
    description:
      "Find nearby database-backed mountain peaks relative to the authenticated user's saved home location. Returns peaks ranked by routed road distance to stored peak coordinates when available (not verified trailheads), otherwise straight-line distance; includes current cached weather, canonical IDs, and actual list memberships.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
} as const;

export function shouldUseWebSearch(prompt: string): boolean {
  return /weather|forecast|road closure|road condition|trail condition|trail report|trail status|park alert|mud season|ice condition|snow report/i.test(
    prompt.trim(),
  );
}

export function shouldOfferMountainSearch(prompt: string): boolean {
  const asksForRecommendations =
    /recommend|suggest|options|where should i hike|find me a hike|keep it in|stay in|shorter drive|manageable terrain/i.test(
      prompt,
    );
  const namesArea =
    /\b(?:southern|northern|central|western|eastern|northeastern|northwestern|southeastern|southwestern)\b/i.test(
      prompt,
    ) ||
    /\b(?:New Hampshire|Vermont|Maine|Massachusetts|New York|Connecticut|Rhode Island|New Jersey|Pennsylvania|New England|NH|VT|ME|MA|NY|CT|RI|NJ|PA)\b/i.test(
      prompt,
    ) ||
    /outside (?:my|the) (?:list|lists)|off[- ]list/i.test(prompt);
  return asksForRecommendations && namesArea;
}

export function shouldOfferNearbyMountainSearch(prompt: string): boolean {
  return (
    /\b(?:nearby|near by|near me|close by|close to|closest|around here|local hikes?)\b/i.test(
      prompt,
    ) && /hik(?:e|ing)|mountain|peak|where to go/i.test(prompt)
  );
}

/**
 * Hard guardrail against tool-call fan-out (the 429 source).
 * Recommendation-style prompts must be answered from the injected
 * remainingHikes context, so no function tools are offered at all.
 * Detail/history tools are only offered when the user explicitly asks
 * for specifics about one hike or their own history.
 * NOTE: callers must pass the RAW user turn, never history-prefixed text.
 */
export function shouldOfferDetailTools(prompt: string): boolean {
  // Condition and recommendation prompts use cached context or hosted search,
  // not detail/history lookups.
  if (
    /weather|forecast|condition|trail condition|road closure|road condition|open today|current|recent|latest|snow|mud|ice|recommend|suggest|what(?:'s| is) next|weekend|accessible|near me|home/i.test(
      prompt,
    )
  ) {
    return false;
  }
  return /tell me more about [\w\s'-]{1,60}$|more details? (about|on) [\w\s'-]{1,60}$|what is the route (for|up|of) |directions to |how (long|hard|high) is [\w\s'-]{1,60}\?*$|show my (past |hiking )?history|my past adventures|my adventure log|what have i (hiked|completed|done)/i.test(
    prompt.trim(),
  );
}

export async function executeApplicationTool(
  name: string,
  args: Record<string, unknown>,
  userId: number,
): Promise<string> {
  let result: unknown;

  switch (name) {
    case "get_hike_details": {
      const kind = args.kind as string | undefined;
      const id = Number(args.id);
      if (!Number.isInteger(id) || id < 1) {
        return JSON.stringify({ ok: false, error: "Provide a valid hike id" });
      }
      if (kind === "peak") {
        const mountain = await getMountain(id);
        const plain =
          mountain && typeof mountain.toJSON === "function"
            ? (mountain.toJSON() as Record<string, unknown>)
            : null;
        result = plain
          ? {
              ...plain,
              difficulty: getStubMountainDifficulty(Number(plain.id ?? id)),
            }
          : null;
        // Detail lookups are explicit "tell me about this peak" requests, so
        // attach current conditions here instead of arming a weather tool
        // (keeps the single-tool-call budget and avoids a second round-trip).
        if (
          result &&
          typeof plain!.lat === "number" &&
          typeof plain!.lon === "number"
        ) {
          try {
            const profile = await getUserProfile(userId);
            const units = pickWeatherUnits(profile);
            const fetched = await fetchPeakWeather(
              [{ id, lat: plain!.lat as number, lon: plain!.lon as number }],
              units,
            );
            const info = fetched[String(id)];
            if (info) {
              (result as Record<string, unknown>).weather = formatPeakWeather(
                info,
                units,
              );
            }
          } catch (error) {
            console.warn("weather.tool.attach_failed", {
              id,
              error: String(error),
            });
          }
        }
      } else if (kind === "trail") {
        const trail = await getTrail(id);
        result =
          trail && typeof trail.toJSON === "function"
            ? (trail.toJSON() as Record<string, unknown>)
            : null;
      } else {
        return JSON.stringify({
          ok: false,
          error: 'Provide kind as "peak" or "trail"',
        });
      }
      break;
    }
    case "search_mountains": {
      const query = String(args.query ?? "").trim().slice(0, 80);
      if (query.length < 2) {
        return JSON.stringify({
          ok: false,
          error: "Provide at least two characters of a peak name",
        });
      }
      result = (await searchMountainsByName(query)).map((mountain) =>
        mountain.toJSON(),
      );
      break;
    }
    case "find_nearby_mountains": {
      const profile = await getUserProfile(userId);
      const homeLocation = profile?.preferences.homeLocation;
      if (!homeLocation) {
        result = {
          message:
            "The user has no saved home location. Ask which town or area they want to hike near.",
          mountains: [],
        };
        break;
      }

      const location = await geocodeLocation(homeLocation);
      if (!location) {
        result = {
          homeLocation,
          message:
            "The saved home location could not be geocoded. Ask the user for a nearby town or area.",
          mountains: [],
        };
        break;
      }

      const candidates = await getNearbyMountains(
        location.lat,
        location.lon,
        100,
        40,
      );
      const routes = await getDrivingDistances(location, candidates);
      const hasCompleteRoutes = candidates.every(
        (mountain) => routes[String(mountain.id)],
      );
      const rankedCandidates = candidates.map((mountain) => {
          const route = routes[String(mountain.id)];
          return {
            ...mountain,
            drivingMiles: hasCompleteRoutes ? route?.miles ?? null : null,
            distanceMethod: hasCompleteRoutes
              ? "routed road distance to stored peak coordinate; trailhead unknown"
              : "straight-line fallback",
          };
        });
      const mountains = rankNearbyMountains(
        rankedCandidates,
        hasCompleteRoutes,
      );
      const units = pickWeatherUnits(profile);
      const weather = await getPeakWeatherSnapshot(
        userId,
        mountains.map(({ id, lat, lon }) => ({ id, lat, lon })),
        units,
      );
      result = {
        homeLocation: location.label,
        distanceMetric: hasCompleteRoutes
          ? "routed road distance in miles to stored peak coordinates; trailheads are not modeled"
          : "approximate straight-line miles; routing service unavailable",
        mountains: mountains.map((mountain) => ({
          ...mountain,
          weather: weather.byPeak[String(mountain.id)]
            ? formatPeakWeather(weather.byPeak[String(mountain.id)]!, units)
            : null,
        })),
      };
      break;
    }
    case "get_user_adventures":
      result = await getAdventures(userId);
      break;
    default:
      return JSON.stringify({ ok: false, error: `Unknown tool: ${name}` });
  }

  return JSON.stringify({ ok: true, result });
}

export function healthcheckTool(): ToolResult {
  return {
    ok: true,
    message: "Agent healthcheck passed. Service is running and reachable.",
  };
}

export function echoTool(value: string): ToolResult {
  return { ok: true, message: `Tool echo: ${value}` };
}

/**
 * The free-tier model sometimes ignores the function-calling protocol and
 * prints literal pseudo-tool markup (e.g. `<tool_call>web_search<arg_key>...`)
 * into its visible answer. No real tool executes in that case
 * (`toolRound: false`), but the markup leaks to the user. Strip whole
 * <tool_call>...</tool_call> blocks where the closers exist, then any stray
 * leftover tags (the model frequently omits closers, so the second pass is
 * what actually fires).
 *
 * This is a last-resort sanitizer: the primary fix is the system.txt wording
 * that forbids printing tool markup. Defense in depth matters because the
 * free model ignores instructions intermittently.
 */
export function pseudoToolMarkupPresent(content: string): boolean {
  return /<\s*\/?\s*(?:tool(?:[\s_]*call)?|arg[\s_]*(?:key|value))\b/i.test(
    content,
  );
}

export function stripPseudoToolMarkup(content: string): string {
  // Whole <tool_call>...</tool_call> blocks where the closers exist, then any
  // stray leftover tags (the model frequently omits closers, so the second
  // pass is what actually fires).
  let text = content;
  text = text.replace(
    /<\s*tool[\s_]*call\b[^>]*>[\s\S]*?(?:<\s*\/\s*tool[\s_]*call\s*>|$)/gi,
    "",
  );
  text = text.replace(
    /<\s*arg[\s_]*key[^>]*>[^<>\n]{0,60}<\s*\/\s*arg[\s_]*(?:key|value)\s*>[^\n<>]{0,300}/gi,
    "",
  );
  text = text.replace(
    /<\s*arg[\s_]*(?:key|value)\b[^>]*>[^\n<>]{0,300}/gi,
    "",
  );
  text = text.replace(
    /<\s*\/?\s*(?:tool(?:[\s_]*call)?|arg[\s_]*(?:key|value))\b[^>]*>/gi,
    "",
  );
  text = text.replace(
    /^[ \t]*tool[\s_]*call[ \t]+[^\n<>]{0,300}$/gim,
    "",
  );
  text = text.replace(
    /\b(?:web[\s_]*search|arg[\s_]*(?:key|value)|tool[\s_]*call)[a-z]*(?:query|source|accuracy|value|key|search|call)?[a-z]*/gi,
    "",
  );
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
