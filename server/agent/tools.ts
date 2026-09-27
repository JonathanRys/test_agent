import { getAdventures } from "../services/adventure.js";
import { getMountain } from "../services/mountain.js";
import { getTrail } from "../services/trail.js";
import {
  fetchPeakWeather,
  formatPeakWeather,
  pickWeatherUnits,
} from "../services/weather.js";
import { getUserProfile } from "../services/profile.js";
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

export function shouldUseWebSearch(prompt: string): boolean {
  // Legacy heuristic: the runtime no longer offers a web_search function
  // tool (condition sources are plain reference links in the system prompt),
  // so this always returns false. Kept for backwards-compat with tests.
  void prompt;
  return false;
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
  // Negative lookahead: weather / trail-condition / road-status RECOMMENDATION
  // prompts must be answered from injected context + curated reference links,
  // so condition words must never arm the detail/history tools.
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
    case "web_search": {
      const query = String(args.query ?? "").slice(0, 300);
      if (!query) {
        return JSON.stringify({ ok: false, error: "Provide a search query" });
      }
      // No server-side web fetch is configured; return the curated source list
      // so the model can cite where to check instead of hallucinating calls.
      result = {
        note:
          "Live web lookup is not configured server-side. Use the curated condition sources in the system prompt and tell the user where to check.",
        query,
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
