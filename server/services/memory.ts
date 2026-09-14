import { Sequelize } from "sequelize";
import path from "path";
import { fileURLToPath } from "url";
import {
  Session,
  Message,
  Summary,
  initializeModels,
} from "../models/index.js";
import { generateMessageSummary } from "./openrouter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "../../data/memory.db");

// Initialize Sequelize
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: dbPath,
  logging: false, // Set to console.log for debugging
});

// Initialize models
initializeModels(sequelize);

// In-memory session storage for short-term memory
const inMemorySessions = new Map<
  string,
  Array<{ role: "user" | "assistant"; message: string }>
>();

// Session memory type tracking
const sessionMemoryTypes = new Map<string, "short-term" | "long-term">();

// Track initialization state
let isInitialized = false;

// Initialize database
async function ensureInitialized(): Promise<void> {
  if (isInitialized) return;

  try {
    await sequelize.sync();
    isInitialized = true;
  } catch (error) {
    console.error("Failed to sync database:", error);
    throw error;
  }
}

export async function getOrCreateSession(
  sessionId: string,
  userId: number,
): Promise<"short-term" | "long-term"> {
  await ensureInitialized();
  const cacheKey = `${userId}:${sessionId}`;

  if (!sessionMemoryTypes.has(cacheKey)) {
    const existingSession = await Session.findByPk(sessionId);
    if (existingSession && existingSession.userId !== userId) {
      throw new Error("SESSION_NOT_FOUND");
    }

    const [session] = await Session.findOrCreate({
      where: { id: sessionId },
      defaults: { userId, memoryType: "short-term" },
    });
    sessionMemoryTypes.set(cacheKey, session.memoryType);

    // Initialize in-memory storage if short-term
    if (session.memoryType === "short-term") {
      inMemorySessions.set(cacheKey, []);
    }
  }

  return sessionMemoryTypes.get(cacheKey)!;
}

export async function getSessionMemory(
  sessionId: string,
  userId: number,
): Promise<string[]> {
  const memoryType = await getOrCreateSession(sessionId, userId);
  const cacheKey = `${userId}:${sessionId}`;

  if (memoryType === "short-term") {
    const messages = inMemorySessions.get(cacheKey) ?? [];
    return messages.map((m) => m.message);
  }

  // Long-term: fetch from database
  try {
    const messages = await Message.findAll({
      where: { sessionId },
      order: [["createdAt", "DESC"]],
      limit: 6,
    });

    return messages.reverse().map((msg) => (msg as any).message);
  } catch (error) {
    console.error("Error fetching session memory from database:", error);
    return [];
  }
}

export async function getSessionPromptContext(
  sessionId: string,
  userId: number,
): Promise<string> {
  const memoryType = await getOrCreateSession(sessionId, userId);
  const cacheKey = `${userId}:${sessionId}`;

  if (memoryType === "short-term") {
    const messages = inMemorySessions.get(cacheKey) ?? [];
    return messages
      .map((message) => `${message.role}: ${message.message}`)
      .join("\n");
  }

  try {
    const allMessages = await Message.findAll({
      where: { sessionId },
      order: [["createdAt", "ASC"]],
    });
    const recentMessages = allMessages.slice(-4);
    const messageIds = allMessages.map((message) => (message as any).id);
    const summaries = messageIds.length
      ? await Summary.findAll({
          where: { assistantMessageId: messageIds },
          order: [["createdAt", "DESC"]],
          limit: 4,
        })
      : [];

    const recent = recentMessages
      .map((message) => `${(message as any).role}: ${(message as any).message}`)
      .join("\n");
    const summaryText = summaries
      .map((summary) => (summary as any).summary)
      .filter(Boolean)
      .reverse()
      .join("\n");

    return [
      summaryText && `Earlier conversation summaries:\n${summaryText}`,
      recent,
    ]
      .filter(Boolean)
      .join("\n\n");
  } catch (error) {
    console.error("Error fetching prompt context:", error);
    return "";
  }
}

export async function getSessionMessages(
  sessionId: string,
  userId: number,
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const memoryType = await getOrCreateSession(sessionId, userId);
  const cacheKey = `${userId}:${sessionId}`;

  if (memoryType === "short-term") {
    // For short-term, return in-memory messages
    const messages = inMemorySessions.get(cacheKey) ?? [];
    return messages.map((m) => ({
      role: m.role,
      content: m.message,
    }));
  }

  // Long-term: fetch from database with role info
  try {
    const messages = await Message.findAll({
      where: { sessionId },
      order: [["createdAt", "ASC"]],
      limit: 50,
    });

    return messages.map((msg) => ({
      role: (msg as any).role,
      content: (msg as any).message,
    }));
  } catch (error) {
    console.error("Error fetching session messages from database:", error);
    return [];
  }
}

export async function getUserSessions(userId: number): Promise<
  Array<{
    id: string;
    memoryType: "short-term" | "long-term";
    createdAt: Date;
    updatedAt: Date;
    preview: string | null;
  }>
> {
  await ensureInitialized();
  const sessions = await Session.findAll({
    where: { userId },
    order: [["updatedAt", "DESC"]],
  });

  return Promise.all(
    sessions.map(async (session) => {
      const messages = await getSessionMessages(session.id, userId);
      const firstUserMessage = messages.find(
        (message) => message.role === "user",
      );
      return {
        id: session.id,
        memoryType: session.memoryType,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        preview: firstUserMessage?.content ?? null,
      };
    }),
  );
}

async function summarizeMessage(
  sessionId: string,
  messageId: number,
  message: string,
) {
  try {
    const userMessage = await Message.findOne({
      where: { sessionId, role: "user" },
      order: [["createdAt", "DESC"]],
    });
    if (userMessage) {
      const messageSummary = await generateMessageSummary(
        userMessage.message,
        message,
      );
      const summary = {
        assistantMessageId: messageId,
        userMessageId: userMessage.id,
        summary: messageSummary,
      };
      await Summary.create(summary);
    }
  } catch (error) {
    console.error(`Unable to create summary ${error}`);
  }
}

export async function addMessageToSession(
  sessionId: string,
  message: string,
  role: "user" | "assistant" = "user",
  userId: number,
): Promise<void> {
  const memoryType = await getOrCreateSession(sessionId, userId);
  const cacheKey = `${userId}:${sessionId}`;

  if (memoryType === "short-term") {
    const history = inMemorySessions.get(cacheKey) ?? [];
    history.push({ role, message });
    // Keep only last 6 messages for short-term
    if (history.length > 6) {
      history.shift();
    }
    inMemorySessions.set(cacheKey, history);
  } else {
    // Long-term: save to database
    try {
      const messageId = (await Message.create({ sessionId, message, role }))[
        "id"
      ];
      if (role === "assistant") {
        summarizeMessage(sessionId, messageId, message);
      }
    } catch (error) {
      console.error("Error adding message to database:", error);
    }
  }

  await Session.update(
    { updatedAt: new Date() },
    { where: { id: sessionId, userId } },
  );
}

export async function toggleMemoryType(
  sessionId: string,
  userId: number,
): Promise<"short-term" | "long-term"> {
  await ensureInitialized();

  const currentType = await getOrCreateSession(sessionId, userId);
  const cacheKey = `${userId}:${sessionId}`;
  const newType = currentType === "short-term" ? "long-term" : "short-term";

  sessionMemoryTypes.set(cacheKey, newType);

  // Update in database
  try {
    await Session.update(
      { memoryType: newType },
      { where: { id: sessionId, userId } },
    );

    // If switching to long-term, migrate in-memory history to database
    if (newType === "long-term") {
      const history = inMemorySessions.get(cacheKey) ?? [];
      for (const msg of history) {
        await Message.create({
          sessionId,
          message: msg.message,
          role: msg.role,
        });
      }
      inMemorySessions.delete(cacheKey);
    }

    // If switching to short-term, populate in-memory from database
    if (newType === "short-term") {
      const messages = await Message.findAll({
        where: { sessionId },
        order: [["createdAt", "DESC"]],
        limit: 6,
      });

      const history = messages.reverse().map((msg) => ({
        role: (msg as any).role,
        message: (msg as any).message,
      }));
      inMemorySessions.set(cacheKey, history);
    }
  } catch (error) {
    console.error("Error toggling memory type:", error);
    throw error;
  }

  return newType;
}

export async function getSessionMemoryType(
  sessionId: string,
  userId: number,
): Promise<"short-term" | "long-term"> {
  return await getOrCreateSession(sessionId, userId);
}

export async function clearSessionMemory(
  sessionId: string,
  userId: number,
): Promise<void> {
  await ensureInitialized();
  const cacheKey = `${userId}:${sessionId}`;

  inMemorySessions.delete(cacheKey);

  try {
    await Message.destroy({ where: { sessionId } });
    await Session.destroy({ where: { id: sessionId, userId } });
  } catch (error) {
    console.error("Error clearing session memory:", error);
  }

  sessionMemoryTypes.delete(cacheKey);
}

export { sequelize };
