import { getAdventures } from "../services/adventure.js";
import {
  getListCompletionStatus,
  getUserCompletedPeaks,
} from "../services/completion.js";
import { getLists } from "../services/list.js";
import { getMountain, getMountains } from "../services/mountain.js";
import { getUserProfile } from "../services/profile.js";
import { getTrail } from "../services/trail.js";
import { getStubMountainDifficulty } from "../utils/amcRating.js";

export type ToolResult = {
  ok: boolean;
  message: string;
};

export const applicationTools = [
  {
    type: "function",
    function: {
      name: "get_user_profile",
      description: "Get the authenticated user's profile and preferences.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_user_list_completions",
      description:
        "Get the authenticated user's progress on every hiking list.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_lists",
      description: "Find available hiking lists, optionally by list type.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["peakbagging", "trace"] },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_mountains",
      description:
        "Find uncompleted mountain peaks, optionally filtered by state or range. Results include estimated difficulty.",
      parameters: {
        type: "object",
        properties: { state: { type: "string" }, range: { type: "string" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_mountain",
      description: "Get a mountain by ID.",
      parameters: {
        type: "object",
        properties: { id: { type: "integer", minimum: 1 } },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_trail",
      description: "Get a trail by ID.",
      parameters: {
        type: "object",
        properties: { id: { type: "integer", minimum: 1 } },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_user_adventures",
      description: "Get the authenticated user's adventures and completions.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
] as const;

export function shouldUseWebSearch(prompt: string): boolean {
  return /weather|forecast|conditions?|road closure|road condition|open today|current|recent|latest|snow|mud|ice/i.test(
    prompt,
  );
}

export async function executeApplicationTool(
  name: string,
  args: Record<string, unknown>,
  userId: number,
): Promise<string> {
  let result: unknown;

  switch (name) {
    case "get_user_profile":
      result = await getUserProfile(userId);
      break;
    case "get_user_list_completions":
      result = await getListCompletionStatus(userId);
      break;
    case "search_lists":
      result = await getLists(
        { type: args.type as "peakbagging" | "trace" | undefined },
        userId,
      );
      break;
    case "search_mountains": {
      const [mountains, completedPeaks] = await Promise.all([
        getMountains({
          state: args.state as string | undefined,
          range: args.range as string | undefined,
        }),
        getUserCompletedPeaks(userId),
      ]);
      const completedIds = new Set(completedPeaks.map((peak) => peak.id));
      result = mountains
        .filter((mountain) => !completedIds.has(mountain.id))
        .slice(0, 25)
        .map((mountain) => ({
          id: mountain.id,
          name: mountain.name,
          state: mountain.state,
          range: mountain.range,
          height: mountain.height,
          distance: mountain.distance,
          bushwhack: mountain.bushwhack,
          difficulty: getStubMountainDifficulty(mountain.id),
        }));
      break;
    }
    case "get_mountain":
      result = await getMountain(Number(args.id));
      break;
    case "get_trail":
      result = await getTrail(Number(args.id));
      break;
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
