// Development startup script with environment variables
process.env.NODE_ENV = 'development';
process.env.PORT = '3000';
process.env.HOST = '0.0.0.0';
process.env.SITE_SALT = 'my-super-secret-salt-for-development-that-is-very-long-and-secure-12345';
process.env.JWT_SECRET = 'my-super-secret-jwt-key-for-development-that-is-very-long-and-secure-67890';
process.env.HMAC_SECRET = 'my-super-secret-hmac-key-for-development-that-is-very-long-and-secure-abcdef';
process.env.PGHOST = 'localhost';
process.env.PGPORT = '5432';
process.env.PG_DATABASE = 'universal_tracking';
process.env.PGUSER = 'postgres';
process.env.PGPASSWORD = 'password';
process.env.PG_SSL = 'false';
process.env.PG_POOL_MIN = '2';
process.env.PG_POOL_MAX = '10';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.REDISHOST = 'localhost';
process.env.REDISPORT = '6379';
process.env.REDISPASSWORD = '';
process.env.REDIS_DB = '0';
process.env.REDIS_KEY_PREFIX = 'ut:';
process.env.CLICKHOUSE_HOST = 'localhost';
process.env.CLICKHOUSE_PORT = '8123';
process.env.CLICKHOUSE_DATABASE = 'analytics';
process.env.CLICKHOUSE_USERNAME = 'default';
process.env.CLICKHOUSE_PASSWORD = '';
process.env.CLICKHOUSE_SSL = 'false';

// Import and start the server
import('./services/universal-tracking/src/index.js').catch(console.error);
