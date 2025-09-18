import { Redis } from '@upstash/redis';

/**
 * Check if Redis is properly configured with required environment variables
 */
export const isRedisConfigured = (): boolean => {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
};

/**
 * Get Redis instance if configured, null otherwise
 */
export const getRedisInstance = (): Redis | null => {
  return isRedisConfigured() ? Redis.fromEnv() : null;
};
