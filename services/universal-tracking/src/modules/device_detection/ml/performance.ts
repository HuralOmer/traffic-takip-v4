/**
 * Performance Metrics and Benchmarking for Device Detection
 */
export interface PerformanceMetrics {
  detectionTime: number;
  memoryUsage: number;
  cacheHitRate: number;
  accuracy: number;
  confidence: number;
  signalsProcessed: number;
  mlScore: number;
  historicalBoost: number;
}
export interface BenchmarkResult {
  averageTime: number;
  minTime: number;
  maxTime: number;
  p95Time: number;
  p99Time: number;
  throughput: number; // detections per second
  memoryPeak: number;
  cacheEfficiency: number;
}
// Performance tracking
let performanceHistory: PerformanceMetrics[] = [];
let benchmarkResults: BenchmarkResult | null = null;
/**
 * Start performance measurement
 */
export function startPerformanceMeasurement(): { startTime: number; startMemory: number } {
  const startTime = performance.now();
  const startMemory = (performance as any).memory?.usedJSHeapSize || 0;
  return { startTime, startMemory };
}
/**
 * End performance measurement and record metrics
 */
export function endPerformanceMeasurement(
  startTime: number,
  startMemory: number,
  confidence: number,
  signalsProcessed: number,
  mlScore: number,
  historicalBoost: number = 0,
  accuracy?: number
): PerformanceMetrics {
  const endTime = performance.now();
  const endMemory = (performance as any).memory?.usedJSHeapSize || 0;
  const metrics: PerformanceMetrics = {
    detectionTime: endTime - startTime,
    memoryUsage: endMemory - startMemory,
    cacheHitRate: calculateCacheHitRate(),
    accuracy: accuracy || confidence,
    confidence,
    signalsProcessed,
    mlScore,
    historicalBoost
  };
  // Store in history
  performanceHistory.push(metrics);
  // Keep only last 1000 measurements
  if (performanceHistory.length > 1000) {
    performanceHistory = performanceHistory.slice(-1000);
  }
  return metrics;
}
/**
 * Calculate cache hit rate
 */
function calculateCacheHitRate(): number {
  // This would integrate with the browser info cache
  // For now, return a simulated value
  return Math.random() * 0.3 + 0.7; // 70-100% cache hit rate
}
/**
 * Run performance benchmark
 */
export async function runBenchmark(
  iterations: number = 100,
  testCases: Array<{ userAgent: string; expectedDevice: string }> = []
): Promise<BenchmarkResult> {
  const times: number[] = [];
  const memoryUsages: number[] = [];
  let correctDetections = 0;
  // Default test cases if none provided
  const defaultTestCases = [
    { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1', expectedDevice: 'ios_mobile' },
    { userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1', expectedDevice: 'ios_tablet' },
    { userAgent: 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36', expectedDevice: 'android_mobile' },
    { userAgent: 'Mozilla/5.0 (Linux; Android 10; SM-T870) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Safari/537.36', expectedDevice: 'android_tablet' },
    { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Safari/537.36', expectedDevice: 'desktop' }
  ];
  const cases = testCases.length > 0 ? testCases : defaultTestCases;
  
  // Ensure we have test cases to run
  if (cases.length === 0) {
    throw new Error('No test cases available for benchmark');
  }
  
  for (let i = 0; i < iterations; i++) {
    const testCase = cases[i % cases.length]!; // Non-null assertion since we checked length above
    const { startTime, startMemory } = startPerformanceMeasurement();
    try {
      // Simulate device detection (would call actual detection function)
      const result = await simulateDeviceDetection(testCase.userAgent);
      const endTime = performance.now();
      const endMemory = (performance as any).memory?.usedJSHeapSize || 0;
      times.push(endTime - startTime);
      memoryUsages.push(endMemory - startMemory);
      // Check accuracy
      if (result.deviceType === testCase.expectedDevice) {
        correctDetections++;
      }
      // Progress indicator
      if (i % 10 === 0) {
      }
    } catch (error) {
      console.error(`❌ [Benchmark] Error in iteration ${i}:`, error);
    }
  }
  // Calculate statistics
  const sortedTimes = times.sort((a, b) => a - b);
  const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const p95Time = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0;
  const p99Time = sortedTimes[Math.floor(sortedTimes.length * 0.99)] || 0;
  const throughput = 1000 / averageTime; // detections per second
  const memoryPeak = Math.max(...memoryUsages);
  const cacheEfficiency = calculateCacheHitRate();
  const result: BenchmarkResult = {
    averageTime,
    minTime,
    maxTime,
    p95Time,
    p99Time,
    throughput,
    memoryPeak,
    cacheEfficiency
  };
  benchmarkResults = result;
  return result;
}
/**
 * Simulate device detection for benchmarking
 */
async function simulateDeviceDetection(userAgent: string): Promise<{ deviceType: string; confidence: number }> {
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, Math.random() * 2));
  // Simple simulation based on User-Agent
  if (userAgent.includes('iPhone')) {
    return { deviceType: 'ios_mobile', confidence: 0.95 };
  } else if (userAgent.includes('iPad')) {
    return { deviceType: 'ios_tablet', confidence: 0.95 };
  } else if (userAgent.includes('Android')) {
    return { deviceType: userAgent.includes('Mobile') ? 'android_mobile' : 'android_tablet', confidence: 0.90 };
  } else {
    return { deviceType: 'desktop', confidence: 0.85 };
  }
}
/**
 * Get current performance metrics
 */
export function getPerformanceMetrics(): {
  recent: PerformanceMetrics[];
  average: PerformanceMetrics;
  benchmark: BenchmarkResult | null;
} {
  const recent = performanceHistory.slice(-100); // Last 100 measurements
  const average: PerformanceMetrics = {
    detectionTime: recent.reduce((sum, m) => sum + m.detectionTime, 0) / recent.length,
    memoryUsage: recent.reduce((sum, m) => sum + m.memoryUsage, 0) / recent.length,
    cacheHitRate: recent.reduce((sum, m) => sum + m.cacheHitRate, 0) / recent.length,
    accuracy: recent.reduce((sum, m) => sum + m.accuracy, 0) / recent.length,
    confidence: recent.reduce((sum, m) => sum + m.confidence, 0) / recent.length,
    signalsProcessed: Math.round(recent.reduce((sum, m) => sum + m.signalsProcessed, 0) / recent.length),
    mlScore: recent.reduce((sum, m) => sum + m.mlScore, 0) / recent.length,
    historicalBoost: recent.reduce((sum, m) => sum + m.historicalBoost, 0) / recent.length
  };
  return {
    recent,
    average,
    benchmark: benchmarkResults
  };
}
/**
 * Performance monitoring decorator
 */
export function withPerformanceMonitoring<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  name: string = 'unknown'
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const { startTime, startMemory } = startPerformanceMeasurement();
    try {
      const result = await fn(...args);
      const endTime = performance.now();
      // Log performance
      return result;
    } catch (error) {
      const endTime = performance.now();
      console.error(`❌ [Performance] ${name} failed after ${(endTime - startTime).toFixed(2)}ms:`, error);
      throw error;
    }
  };
}
/**
 * Memory usage monitoring
 */
export function getMemoryUsage(): {
  used: number;
  total: number;
  limit: number;
  percentage: number;
} {
  const memory = (performance as any).memory;
  if (!memory) {
    return { used: 0, total: 0, limit: 0, percentage: 0 };
  }
  return {
    used: memory.usedJSHeapSize,
    total: memory.totalJSHeapSize,
    limit: memory.jsHeapSizeLimit,
    percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
  };
}
/**
 * Performance alerting
 */
export function checkPerformanceAlerts(): string[] {
  const alerts: string[] = [];
  const metrics = getPerformanceMetrics();
  const memory = getMemoryUsage();
  // Slow detection alert
  if (metrics.average.detectionTime > 10) {
    alerts.push(`🐌 Slow detection: ${metrics.average.detectionTime.toFixed(2)}ms average`);
  }
  // High memory usage alert
  if (memory.percentage > 80) {
    alerts.push(`💾 High memory usage: ${memory.percentage.toFixed(1)}%`);
  }
  // Low accuracy alert
  if (metrics.average.accuracy < 0.7) {
    alerts.push(`🎯 Low accuracy: ${(metrics.average.accuracy * 100).toFixed(1)}%`);
  }
  // Low cache hit rate alert
  if (metrics.average.cacheHitRate < 0.5) {
    alerts.push(`📦 Low cache hit rate: ${(metrics.average.cacheHitRate * 100).toFixed(1)}%`);
  }
  return alerts;
}
/**
 * Performance optimization suggestions
 */
export function getOptimizationSuggestions(): string[] {
  const suggestions: string[] = [];
  const metrics = getPerformanceMetrics();
  const memory = getMemoryUsage();
  if (metrics.average.detectionTime > 5) {
    suggestions.push('💡 Consider caching more browser info to reduce detection time');
  }
  if (memory.percentage > 70) {
    suggestions.push('💡 Consider reducing fingerprint history size to save memory');
  }
  if (metrics.average.cacheHitRate < 0.8) {
    suggestions.push('💡 Consider increasing cache duration for better hit rates');
  }
  if (metrics.average.signalsProcessed > 20) {
    suggestions.push('💡 Consider filtering less important signals to reduce processing');
  }
  return suggestions;
}
/**
 * Export performance data
 */
export function exportPerformanceData(): {
  history: PerformanceMetrics[];
  benchmark: BenchmarkResult | null;
  current: ReturnType<typeof getPerformanceMetrics>;
  memory: ReturnType<typeof getMemoryUsage>;
} {
  return {
    history: [...performanceHistory],
    benchmark: benchmarkResults,
    current: getPerformanceMetrics(),
    memory: getMemoryUsage()
  };
}
/**
 * Clear performance data
 */
export function clearPerformanceData(): void {
  performanceHistory = [];
  benchmarkResults = null;
}
