/**
 * Historical Device Fingerprinting System
 * Tracks device patterns and learns from historical data
 */
export interface DeviceFingerprint {
  id: string;
  deviceType: string;
  confidence: number;
  signals: Record<string, any>;
  timestamp: number;
  accuracy?: number;
}
export interface HistoricalPattern {
  fingerprint: string;
  deviceType: string;
  frequency: number;
  accuracy: number;
  lastSeen: number;
  signals: Record<string, any>;
}
// In-memory storage (in production, use Redis or database)
const fingerprintDatabase = new Map<string, HistoricalPattern>();
const deviceHistory = new Map<string, DeviceFingerprint[]>();
// Fingerprint generation
let fingerprintCounter = 0;
/**
 * Generate a unique device fingerprint
 */
export function generateFingerprint(
  userAgent: string,
  screen: any,
  touch: any,
  vendor: any,
  hardware: any
): string {
  // Create a hash-like fingerprint from key characteristics
  const fingerprintData = {
    ua: userAgent.substring(0, 50), // First 50 chars of UA
    screen: `${screen.width}x${screen.height}`,
    touch: touch.maxTouchPoints,
    vendor: vendor.vendor.substring(0, 20),
    hardware: hardware.cores || 0,
    timestamp: Math.floor(Date.now() / 3600000), // Hour-based timestamp
  };
  // Simple hash function (in production, use crypto.subtle.digest)
  const fingerprintString = JSON.stringify(fingerprintData);
  let hash = 0;
  for (let i = 0; i < fingerprintString.length; i++) {
    const char = fingerprintString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `fp_${Math.abs(hash).toString(36)}_${fingerprintCounter++}`;
}
/**
 * Store device fingerprint with historical data
 */
export function storeFingerprint(
  fingerprint: string,
  deviceType: string,
  confidence: number,
  signals: Record<string, any>,
  accuracy?: number
): void {
  const fingerprintData: DeviceFingerprint = {
    id: fingerprint,
    deviceType,
    confidence,
    signals,
    timestamp: Date.now()
  };
  
  if (accuracy !== undefined) {
    fingerprintData.accuracy = accuracy;
  }
  // Store in device history
  if (!deviceHistory.has(fingerprint)) {
    deviceHistory.set(fingerprint, []);
  }
  const history = deviceHistory.get(fingerprint)!;
  history.push(fingerprintData);
  // Keep only last 50 entries per device
  if (history.length > 50) {
    history.splice(0, history.length - 50);
  }
  // Update or create pattern
  const existingPattern = fingerprintDatabase.get(fingerprint);
  if (existingPattern) {
    existingPattern.frequency++;
    existingPattern.accuracy = calculateAverageAccuracy(history);
    existingPattern.lastSeen = Date.now();
    existingPattern.deviceType = deviceType; // Update if changed
  } else {
    fingerprintDatabase.set(fingerprint, {
      fingerprint,
      deviceType,
      frequency: 1,
      accuracy: accuracy || confidence,
      lastSeen: Date.now(),
      signals: { ...signals }
    });
  }
}
/**
 * Calculate average accuracy for a device history
 */
function calculateAverageAccuracy(history: DeviceFingerprint[]): number {
  if (history.length === 0) return 0;
  const totalAccuracy = history.reduce((sum, entry) => {
    return sum + (entry.accuracy || entry.confidence);
  }, 0);
  return totalAccuracy / history.length;
}
/**
 * Find similar historical patterns
 */
export function findSimilarPatterns(
  currentSignals: Record<string, any>,
  maxResults: number = 5
): HistoricalPattern[] {
  const patterns: Array<HistoricalPattern & { similarity: number }> = [];
  fingerprintDatabase.forEach((pattern) => {
    const similarity = calculateSimilarity(currentSignals, pattern.signals);
    if (similarity > 0.3) { // Minimum similarity threshold
      patterns.push({
        ...pattern,
        similarity
      });
    }
  });
  // Sort by similarity and accuracy
  patterns.sort((a, b) => {
    const scoreA = a.similarity * a.accuracy;
    const scoreB = b.similarity * b.accuracy;
    return scoreB - scoreA;
  });
  return patterns.slice(0, maxResults);
}
/**
 * Calculate similarity between two signal sets
 */
function calculateSimilarity(signals1: Record<string, any>, signals2: Record<string, any>): number {
  const keys = new Set([...Object.keys(signals1), ...Object.keys(signals2)]);
  let matches = 0;
  let total = 0;
  keys.forEach(key => {
    const val1 = signals1[key];
    const val2 = signals2[key];
    if (val1 !== undefined && val2 !== undefined) {
      total++;
      if (val1 === val2) {
        matches++;
      } else if (typeof val1 === 'number' && typeof val2 === 'number') {
        // For numeric values, calculate proximity
        const diff = Math.abs(val1 - val2);
        const maxVal = Math.max(val1, val2);
        if (maxVal > 0) {
          const proximity = 1 - (diff / maxVal);
          if (proximity > 0.8) matches += proximity;
        }
      }
    }
  });
  return total > 0 ? matches / total : 0;
}
/**
 * Get historical confidence boost
 */
export function getHistoricalConfidence(
  fingerprint: string,
  deviceType: string,
  baseConfidence: number
): number {
  const pattern = fingerprintDatabase.get(fingerprint);
  if (!pattern) {
    return baseConfidence;
  }
  // Boost confidence based on historical accuracy and frequency
  const frequencyBoost = Math.min(pattern.frequency / 10, 0.3); // Max 30% boost
  const accuracyBoost = (pattern.accuracy - 0.5) * 0.4; // Max 20% boost
  const totalBoost = frequencyBoost + accuracyBoost;
  const boostedConfidence = Math.min(baseConfidence + totalBoost, 1.0);
  return boostedConfidence;
}
/**
 * Learn from feedback (correct/incorrect detection)
 */
export function learnFromFeedback(
  fingerprint: string,
  predictedDeviceType: string,
  actualDeviceType: string,
  wasCorrect: boolean
): void {
  const pattern = fingerprintDatabase.get(fingerprint);
  if (!pattern) return;
  // Update accuracy based on feedback
  const currentAccuracy = pattern.accuracy;
  const feedbackWeight = 0.1; // How much to adjust based on single feedback
  if (wasCorrect) {
    pattern.accuracy = Math.min(currentAccuracy + feedbackWeight, 1.0);
  } else {
    pattern.accuracy = Math.max(currentAccuracy - feedbackWeight, 0.0);
    // If consistently wrong, update device type
    const history = deviceHistory.get(fingerprint) || [];
    const recentHistory = history.slice(-10); // Last 10 entries
    const correctCount = recentHistory.filter(entry => 
      entry.deviceType === actualDeviceType
    ).length;
    if (correctCount >= 7) { // 70% of recent entries suggest different type
      pattern.deviceType = actualDeviceType;
    }
  }
  pattern.lastSeen = Date.now();
}
/**
 * Clean up old fingerprints (older than 30 days)
 */
export function cleanupOldFingerprints(): void {
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  fingerprintDatabase.forEach((pattern, fingerprint) => {
    if (pattern.lastSeen < thirtyDaysAgo) {
      fingerprintDatabase.delete(fingerprint);
      deviceHistory.delete(fingerprint);
    }
  });
}
/**
 * Get fingerprint statistics
 */
export function getFingerprintStats(): {
  totalFingerprints: number;
  averageAccuracy: number;
  topDevices: Array<{ deviceType: string; count: number }>;
  recentActivity: number;
} {
  const patterns = Array.from(fingerprintDatabase.values());
  const totalFingerprints = patterns.length;
  const averageAccuracy = patterns.length > 0 
    ? patterns.reduce((sum, p) => sum + p.accuracy, 0) / patterns.length 
    : 0;
  // Count devices by type
  const deviceCounts: Record<string, number> = {};
  patterns.forEach(pattern => {
    deviceCounts[pattern.deviceType] = (deviceCounts[pattern.deviceType] || 0) + 1;
  });
  const topDevices = Object.entries(deviceCounts)
    .map(([deviceType, count]) => ({ deviceType, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  // Recent activity (last 24 hours)
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  const recentActivity = patterns.filter(p => p.lastSeen > oneDayAgo).length;
  return {
    totalFingerprints,
    averageAccuracy,
    topDevices,
    recentActivity
  };
}
/**
 * Export fingerprint data (for backup/analysis)
 */
export function exportFingerprintData(): {
  patterns: HistoricalPattern[];
  stats: ReturnType<typeof getFingerprintStats>;
} {
  const patterns = Array.from(fingerprintDatabase.values());
  const stats = getFingerprintStats();
  return { patterns, stats };
}
/**
 * Import fingerprint data (for restore/migration)
 */
export function importFingerprintData(data: {
  patterns: HistoricalPattern[];
}): void {
  data.patterns.forEach(pattern => {
    fingerprintDatabase.set(pattern.fingerprint, pattern);
  });
}
// Auto-cleanup every hour
setInterval(cleanupOldFingerprints, 60 * 60 * 1000);
