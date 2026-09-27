export const ACCESS_LIFETIME_MS = 15 * 60 * 1000;
export const REFRESH_LIFETIME_MS = 60 * 60 * 1000;
export const PASSWORD_RESET_LIFETIME_MS = 60 * 60 * 1000;

/** Cache-aside TTL: slightly longer than the sliding refresh session. */
export const USER_CONTEXT_CACHE_TTL_MS =
  REFRESH_LIFETIME_MS + ACCESS_LIFETIME_MS;
export const USER_CONTEXT_CACHE_TTL_SECONDS = Math.ceil(
  USER_CONTEXT_CACHE_TTL_MS / 1000,
);

/**
 * Peak weather is a separate cache with a shorter TTL than the profile/lists
 * context: forecasts only need ~15-minute freshness (also Open-Meteo's
 * fair-use minimum), and weather must be refreshable without rebuilding the
 * expensive list progress cache.
 */
export const PEAK_WEATHER_CACHE_TTL_SECONDS = 15 * 60;

/**
 * After a failed weather fetch, wait this long before trying again so a down
 * weather API cannot add latency to every agent turn.
 */
export const PEAK_WEATHER_FAILURE_TTL_SECONDS = 60;
