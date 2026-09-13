export type Message = {
  role: "user" | "assistant";
  content: string;
};

export type MemoryType = "short-term" | "long-term";

export type AgentSession = {
  id: string;
  memoryType: MemoryType;
  createdAt: string;
  updatedAt: string;
  preview: string | null;
};
