import { Redis } from "ioredis";
import { env } from "../config/env.js";

type MemoryEntry = {
  value: string;
  expiresAt: number;
};

const memory = new Map<string, MemoryEntry>();
let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  if (!env.REDIS_URL) {
    redis = null;
    return redis;
  }

  redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: () => null,
    lazyConnect: true,
  });
  redis.on("error", (error: Error) => {
    console.error("Redis error:", error);
  });
  return redis;
}

async function withRedis<T>(
  operation: (client: Redis) => Promise<T>,
): Promise<T | null> {
  const client = getRedis();
  if (!client) return null;

  try {
    if (client.status === "wait") {
      await client.connect();
    }
    return await operation(client);
  } catch (error) {
    console.error("Redis command failed, using in-memory cache:", error);
    return null;
  }
}

function pruneMemory(now = Date.now()): void {
  for (const [key, entry] of memory) {
    if (entry.expiresAt <= now) memory.delete(key);
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const fromRedis = await withRedis(async (client) => client.get(key));
  if (fromRedis !== null) {
    if (fromRedis === "") return null;
    return JSON.parse(fromRedis) as T;
  }

  pruneMemory();
  const entry = memory.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return JSON.parse(entry.value) as T;
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  const serialized = JSON.stringify(value);
  const wrote = await withRedis(async (client) => {
    await client.set(key, serialized, "EX", ttlSeconds);
    return true;
  });
  if (wrote) return;

  memory.set(key, {
    value: serialized,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export async function cacheDel(key: string): Promise<void> {
  memory.delete(key);
  await withRedis(async (client) => {
    await client.del(key);
    return true;
  });
}

export async function cacheExpire(
  key: string,
  ttlSeconds: number,
): Promise<boolean> {
  const redisResult = await withRedis(async (client) => {
    const result = await client.expire(key, ttlSeconds);
    return result === 1;
  });
  if (redisResult !== null) return redisResult;

  const entry = memory.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    memory.delete(key);
    return false;
  }
  entry.expiresAt = Date.now() + ttlSeconds * 1000;
  return true;
}

export function resetMemoryCacheForTests(): void {
  memory.clear();
}
