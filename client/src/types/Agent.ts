export type Message = {
  role: "user" | "assistant";
  content: string;
};

export type MemoryType = "short-term" | "long-term";
