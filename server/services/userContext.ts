import { USER_CONTEXT_CACHE_TTL_SECONDS } from "../config/session.js";
import {
  getPriorityUnfinishedLists,
  type PriorityUnfinishedList,
} from "./completion.js";
import {
  cacheDel,
  cacheExpire,
  cacheGet,
  cacheSet,
} from "./cache.js";
import { getUserProfile, type UserProfile } from "./profile.js";
import { withPeakWeather, dropPeakWeatherCache } from "./weather.js";

export type CachedUserAgentContext = {
  profile?: UserProfile;
  unfinishedLists: PriorityUnfinishedList[];
};

function userContextKey(userId: number): string {
  return `user:${userId}:agent-context`;
}

export async function buildUserAgentContext(
  userId: number,
): Promise<CachedUserAgentContext> {
  const profile = await getUserProfile(userId);
  const unfinishedLists = await getPriorityUnfinishedLists(
    userId,
    profile?.preferences.fitnessLevel,
  );

  return {
    profile: profile ?? undefined,
    unfinishedLists,
  };
}

export async function getUserAgentContext(
  userId: number,
): Promise<CachedUserAgentContext> {
  const cached = await cacheGet<CachedUserAgentContext>(userContextKey(userId));
  const base = cached ?? (await buildAndCacheUserAgentContext(userId));
  // Weather lives in its own shorter-TTL cache and is merged on read so the
  // expensive profile/lists cache is never rebuilt just to refresh forecasts.
  return withPeakWeather(userId, base);
}

async function buildAndCacheUserAgentContext(
  userId: number,
): Promise<CachedUserAgentContext> {
  const fresh = await buildUserAgentContext(userId);
  await cacheSet(userContextKey(userId), fresh, USER_CONTEXT_CACHE_TTL_SECONDS);
  return fresh;
}

export async function refreshUserAgentContext(
  userId: number,
): Promise<CachedUserAgentContext> {
  const fresh = await buildUserAgentContext(userId);
  await cacheSet(userContextKey(userId), fresh, USER_CONTEXT_CACHE_TTL_SECONDS);
  return withPeakWeather(userId, fresh);
}

export async function refreshUserAgentContextSafe(userId: number): Promise<void> {
  try {
    await refreshUserAgentContext(userId);
  } catch (error) {
    console.error("Failed to refresh user agent context cache:", error);
  }
}

export async function touchUserAgentContext(userId: number): Promise<void> {
  try {
    const extended = await cacheExpire(
      userContextKey(userId),
      USER_CONTEXT_CACHE_TTL_SECONDS,
    );
    if (!extended) await refreshUserAgentContext(userId);
  } catch (error) {
    console.error("Failed to extend user agent context cache:", error);
  }
}

export async function dropUserAgentContext(userId: number): Promise<void> {
  try {
    await cacheDel(userContextKey(userId));
    // Weather snapshot has its own key/TTL; drop it with the rest so a
    // reset/logout does not leave stale per-user forecasts behind.
    await dropPeakWeatherCache(userId);
  } catch (error) {
    console.error("Failed to drop user agent context cache:", error);
  }
}
