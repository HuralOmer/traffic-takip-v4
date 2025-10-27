/**
 * Rate Limiter
 * Protects server from excessive requests and DDoS attacks
 */
interface RateLimitConfig {
  windowMs: number;        // Zaman penceresi (ms)
  maxRequests: number;     // Maksimum istek sayısı
  keyGenerator?: (req: any) => string; // Key oluşturucu
}
interface RateLimitEntry {
  count: number;
  resetTime: number;
}
export class RateLimiter {
  private config: RateLimitConfig;
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  constructor(config: RateLimitConfig) {
    this.config = {
      windowMs: config.windowMs || 60000, // Default: 1 dakika
      maxRequests: config.maxRequests || 100,
      keyGenerator: config.keyGenerator || ((req) => req.ip),
    };
    // Otomatik cleanup (her 5 dakikada bir)
    this.startCleanup();
  }
  /**
   * İstek limit kontrolü
   */
  async check(request: any): Promise<{
    allowed: boolean;
    limit: number;
    remaining: number;
    resetTime: number;
  }> {
    const key = this.config.keyGenerator!(request);
    const now = Date.now();
    // Mevcut entry'yi al veya yeni oluştur
    let entry = this.store.get(key);
    // Entry yoksa veya süresi dolmuşsa yeni oluştur
    if (!entry || now >= entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + this.config.windowMs,
      };
      this.store.set(key, entry);
    }
    // İstek sayısını artır
    entry.count++;
    // Limit kontrolü
    const allowed = entry.count <= this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - entry.count);
    return {
      allowed,
      limit: this.config.maxRequests,
      remaining,
      resetTime: entry.resetTime,
    };
  }
  /**
   * Manuel reset
   */
  reset(key: string): void {
    this.store.delete(key);
  }
  /**
   * Tüm kayıtları temizle
   */
  resetAll(): void {
    this.store.clear();
  }
  /**
   * Otomatik cleanup başlat
   */
  private startCleanup(): void {
    // Her 5 dakikada bir eski kayıtları temizle
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.store.entries()) {
        if (now >= entry.resetTime) {
          this.store.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }
  /**
   * Cleanup durdur
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
  /**
   * İstatistikler
   */
  getStats(): {
    activeKeys: number;
    totalRequests: number;
  } {
    let totalRequests = 0;
    for (const entry of this.store.values()) {
      totalRequests += entry.count;
    }
    return {
      activeKeys: this.store.size,
      totalRequests,
    };
  }
}
/**
 * Multi-tier Rate Limiter
 * Farklı seviyeler için farklı limitler
 */
export class MultiTierRateLimiter {
  private limiters: Map<string, RateLimiter> = new Map();
  /**
   * Limiter ekle
   */
  addLimiter(name: string, config: RateLimitConfig): void {
    this.limiters.set(name, new RateLimiter(config));
  }
  /**
   * Tüm limitleri kontrol et
   */
  async checkAll(request: any): Promise<{
    allowed: boolean;
    blockedBy?: string;
    limits: Record<string, any>;
  }> {
    const limits: Record<string, any> = {};
    for (const [name, limiter] of this.limiters.entries()) {
      const result = await limiter.check(request);
      limits[name] = result;
      if (!result.allowed) {
        return {
          allowed: false,
          blockedBy: name,
          limits,
        };
      }
    }
    return {
      allowed: true,
      limits,
    };
  }
  /**
   * Belirli bir limiter'ı al
   */
  getLimiter(name: string): RateLimiter | undefined {
    return this.limiters.get(name);
  }
  /**
   * Tüm limiter'ları temizle
   */
  destroy(): void {
    for (const limiter of this.limiters.values()) {
      limiter.destroy();
    }
    this.limiters.clear();
  }
}
/**
 * Fastify için rate limit middleware
 */
export function createRateLimitMiddleware(limiter: RateLimiter) {
  return async (request: any, reply: any) => {
    const result = await limiter.check(request);
    // Rate limit headers ekle
    reply.header('X-RateLimit-Limit', result.limit.toString());
    reply.header('X-RateLimit-Remaining', result.remaining.toString());
    reply.header('X-RateLimit-Reset', new Date(result.resetTime).toISOString());
    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
      reply.header('Retry-After', retryAfter.toString());
      return reply.code(429).send({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        limit: result.limit,
        resetTime: result.resetTime,
      });
    }
  };
}
/**
 * Redis tabanlı Rate Limiter (distributed systems için)
 */
export class RedisRateLimiter {
  private redis: any;
  private config: RateLimitConfig;
  constructor(redisClient: any, config: RateLimitConfig) {
    this.redis = redisClient;
    this.config = config;
  }
  async check(request: any): Promise<{
    allowed: boolean;
    limit: number;
    remaining: number;
    resetTime: number;
  }> {
    const key = `ratelimit:${this.config.keyGenerator!(request)}`;
    const now = Date.now();
    const windowMs = this.config.windowMs;
    const maxRequests = this.config.maxRequests;
    // Redis'te sayacı artır
    const count = await this.redis.incr(key);
    // İlk istek ise TTL set et
    if (count === 1) {
      await this.redis.pexpire(key, windowMs);
    }
    // TTL al
    const ttl = await this.redis.pttl(key);
    const resetTime = now + ttl;
    const allowed = count <= maxRequests;
    const remaining = Math.max(0, maxRequests - count);
    return {
      allowed,
      limit: maxRequests,
      remaining,
      resetTime,
    };
  }
  async reset(key: string): Promise<void> {
    await this.redis.del(`ratelimit:${key}`);
  }
}
