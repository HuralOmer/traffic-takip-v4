import { createClient, RedisClientType } from 'redis';
import { config } from '../config/env.js';
import { logger } from '../observability/logger.js';
export class RedisService {
  private client: RedisClientType | null = null;
  private isConnected = false;
  async connect(): Promise<void> {
    try {
      const clientConfig: any = {
        url: config.REDIS_URL,
        database: config.REDIS_DB,
      };
      if (config.REDISPASSWORD) {
        clientConfig.password = config.REDISPASSWORD;
      }
      this.client = createClient(clientConfig);
      this.client.on('error', (err) => {
        logger.error(err, 'Redis Client Error');
        this.isConnected = false;
      });
      this.client.on('connect', () => {
        logger.info('Redis client connected');
        this.isConnected = true;
      });
      this.client.on('ready', () => {
        logger.info('Redis client ready');
        this.isConnected = true;
      });
      this.client.on('end', () => {
        logger.info('Redis client disconnected');
        this.isConnected = false;
      });
      await this.client.connect();
      logger.info(`Connected to Redis at ${config.REDIS_URL}`);
    } catch (error) {
      logger.error(error as Error, 'Failed to connect to Redis');
      throw error;
    }
  }
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
      this.isConnected = false;
      logger.info('Disconnected from Redis');
    }
  }
  getClient(): RedisClientType {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis client is not connected');
    }
    return this.client;
  }
  isClientConnected(): boolean {
    return this.isConnected && this.client !== null;
  }
}
// Global Redis service instance
export const redisService = new RedisService();
