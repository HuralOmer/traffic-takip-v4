import { z } from 'zod';
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  // Security
  SITE_SALT: z.string().min(32, 'Site salt must be at least 32 characters'),
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  HMAC_SECRET: z.string().min(32, 'HMAC secret must be at least 32 characters'),
  // Database - PostgreSQL
  PGHOST: z.string().default('localhost'),
  PGPORT: z.coerce.number().default(5432),
  PG_DATABASE: z.string().default('universal_tracking'),
  PGUSER: z.string().default('postgres'),
  PGPASSWORD: z.string(),
  PG_SSL: z.coerce.boolean().default(false),
  PG_POOL_MIN: z.coerce.number().default(2),
  PG_POOL_MAX: z.coerce.number().default(10),
  // Cache - Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDISHOST: z.string().default('localhost'),
  REDISPORT: z.coerce.number().default(6379),
  REDISPASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),
  REDIS_KEY_PREFIX: z.string().default('ut:'),
  // Analytics - ClickHouse
  CLICKHOUSE_HOST: z.string().default('localhost'),
  CLICKHOUSE_PORT: z.coerce.number().default(8123),
  CLICKHOUSE_DATABASE: z.string().default('analytics'),
  CLICKHOUSE_USERNAME: z.string().default('default'),
  CLICKHOUSE_PASSWORD: z.string().optional(),
  CLICKHOUSE_SSL: z.coerce.boolean().default(false),
});
export const config = envSchema.parse(process.env);
