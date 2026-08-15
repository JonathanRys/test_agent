export type ToolResult = {
  ok: boolean;
  message: string;
};

export function healthcheckTool(): ToolResult {
  return {
    ok: true,
    message: 'Agent healthcheck passed. Service is running and reachable.',
  };
}

export function echoTool(value: string): ToolResult {
  return {
    ok: true,
    message: `Tool echo: ${value}`,
  };
}
