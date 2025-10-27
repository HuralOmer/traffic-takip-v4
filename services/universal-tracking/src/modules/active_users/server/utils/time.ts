/**
 * Time Utilities
 * Server-side time management and EMA time window calculations
 */
/**
 * Zaman Penceresi Yönetimi
 */
export class TimeWindowManager {
  /**
   * Şu anki zaman damgası (consistent)
   */
  static now(): number {
    return Date.now();
  }
  /**
   * X dakika öncesinin timestamp'i
   */
  static minutesAgo(minutes: number): number {
    return Date.now() - minutes * 60 * 1000;
  }
  /**
   * X saniye öncesinin timestamp'i
   */
  static secondsAgo(seconds: number): number {
    return Date.now() - seconds * 1000;
  }
  /**
   * X saat öncesinin timestamp'i
   */
  static hoursAgo(hours: number): number {
    return Date.now() - hours * 60 * 60 * 1000;
  }
  /**
   * İki timestamp arası fark (milisaniye)
   */
  static diffInMs(start: number, end: number): number {
    return end - start;
  }
  /**
   * İki timestamp arası fark (saniye)
   */
  static diffInSeconds(start: number, end: number): number {
    return Math.floor((end - start) / 1000);
  }
  /**
   * İki timestamp arası fark (dakika)
   */
  static diffInMinutes(start: number, end: number): number {
    return Math.floor((end - start) / (60 * 1000));
  }
  /**
   * Timestamp expired mı kontrol et
   */
  static isExpired(timestamp: number, ttlSeconds: number): boolean {
    return Date.now() - timestamp > ttlSeconds * 1000;
  }
  /**
   * Timestamp hala geçerli mi?
   */
  static isValid(timestamp: number, ttlSeconds: number): boolean {
    return !TimeWindowManager.isExpired(timestamp, ttlSeconds);
  }
  /**
   * EMA için zaman penceresi oluştur
   */
  static getEMAWindow(windowMinutes: number = 5): {
    start: number;
    end: number;
    buckets: number[];
    bucketSize: number;
  } {
    const end = Date.now();
    const start = end - windowMinutes * 60 * 1000;
    // Pencereyi 30 saniyelik bucketlara böl
    const bucketSize = 30 * 1000; // 30 saniye
    const bucketCount = Math.ceil((end - start) / bucketSize);
    const buckets = Array.from({ length: bucketCount }, (_, i) => {
      return start + i * bucketSize;
    });
    return { start, end, buckets, bucketSize };
  }
  /**
   * Bir timestamp hangi bucket'a ait?
   */
  static getBucketIndex(timestamp: number, bucketSize: number): number {
    return Math.floor(timestamp / bucketSize);
  }
  /**
   * Timestamp'i bucket başlangıcına yuvarla
   */
  static roundToBucket(timestamp: number, bucketSize: number): number {
    return Math.floor(timestamp / bucketSize) * bucketSize;
  }
  /**
   * Human readable format (ISO)
   */
  static formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toISOString();
  }
  /**
   * Human readable format (local)
   */
  static formatLocal(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
  /**
   * Relative time format (örn: "5 dakika önce")
   */
  static formatRelative(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days} gün önce`;
    if (hours > 0) return `${hours} saat önce`;
    if (minutes > 0) return `${minutes} dakika önce`;
    if (seconds > 0) return `${seconds} saniye önce`;
    return 'şimdi';
  }
  /**
   * Heartbeat geç mi kaldı?
   */
  static isHeartbeatLate(
    lastBeat: number,
    expectedInterval: number,
    gracePeriod: number = 5000
  ): boolean {
    const timeSinceLastBeat = Date.now() - lastBeat;
    return timeSinceLastBeat > expectedInterval + gracePeriod;
  }
  /**
   * Presence TTL kontrolü
   */
  static shouldRefreshPresence(lastSeen: number, ttl: number, threshold: number = 0.5): boolean {
    const elapsed = Date.now() - lastSeen;
    const refreshTime = ttl * threshold * 1000; // TTL'nin %50'si
    return elapsed >= refreshTime;
  }
  /**
   * Zaman dilimi hesapla (bugün, dün, bu hafta, vb.)
   */
  static getTimeRange(range: 'today' | 'yesterday' | 'week' | 'month'): {
    start: number;
    end: number;
  } {
    const now = new Date();
    const end = now.getTime();
    let start: number;
    switch (range) {
      case 'today':
        start = new Date(now.setHours(0, 0, 0, 0)).getTime();
        break;
      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        start = new Date(yesterday.setHours(0, 0, 0, 0)).getTime();
        break;
      case 'week':
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        start = weekAgo.getTime();
        break;
      case 'month':
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        start = monthAgo.getTime();
        break;
      default:
        start = end;
    }
    return { start, end };
  }
  /**
   * Timestamp validasyonu
   */
  static isValidTimestamp(timestamp: number): boolean {
    // Timestamp mantıklı bir aralıkta mı? (2020 - 2100 arası)
    const min = new Date('2020-01-01').getTime();
    const max = new Date('2100-01-01').getTime();
    return timestamp >= min && timestamp <= max;
  }
  /**
   * Gelecek bir zamana kadar kalan süre (ms)
   */
  static timeUntil(futureTimestamp: number): number {
    return Math.max(0, futureTimestamp - Date.now());
  }
  /**
   * Gelecek bir zamana kadar kalan süre (saniye)
   */
  static secondsUntil(futureTimestamp: number): number {
    return Math.max(0, Math.ceil((futureTimestamp - Date.now()) / 1000));
  }
}
/**
 * Performance timer (kodun ne kadar sürdüğünü ölçmek için)
 */
export class PerformanceTimer {
  private startTime: number;
  private checkpoints: Map<string, number> = new Map();
  constructor() {
    this.startTime = Date.now();
  }
  /**
   * Checkpoint ekle
   */
  checkpoint(name: string): void {
    this.checkpoints.set(name, Date.now());
  }
  /**
   * Başlangıçtan beri geçen süre (ms)
   */
  elapsed(): number {
    return Date.now() - this.startTime;
  }
  /**
   * İki checkpoint arası süre
   */
  between(checkpoint1: string, checkpoint2: string): number {
    const t1 = this.checkpoints.get(checkpoint1);
    const t2 = this.checkpoints.get(checkpoint2);
    if (!t1 || !t2) {
      throw new Error('Checkpoint not found');
    }
    return t2 - t1;
  }
  /**
   * Tüm checkpointleri log'la
   */
  log(label: string = 'Timer'): void {
    const checkpointArray = Array.from(this.checkpoints.entries());
    for (let i = 0; i < checkpointArray.length; i++) {
      const [name, time] = checkpointArray[i]!;
      const prevTime = i === 0 ? this.startTime : checkpointArray[i - 1]![1];
      const diff = time - prevTime;
    }
  }
  /**
   * Reset timer
   */
  reset(): void {
    this.startTime = Date.now();
    this.checkpoints.clear();
  }
}
