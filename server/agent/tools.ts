import { getAdventures } from "../services/adventure.js";
import { getListCompletionStatus } from "../services/completion.js";
import { getLists } from "../services/list.js";
import { getMountain } from "../services/mountain.js";
import { getUserProfile } from "../services/profile.js";
import { getTrail } from "../services/trail.js";

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
  return {
    ok: true,
    message: `Tool echo: ${value}`,
  };
}
