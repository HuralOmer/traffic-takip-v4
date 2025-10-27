/**
 * ML-Based Scoring System for Device Detection
 * Uses weighted algorithms and statistical analysis
 */
export interface MLScoringConfig {
  enableAdaptiveWeights: boolean;
  enableHistoricalLearning: boolean;
  confidenceThreshold: number;
  debug: boolean;
}
export interface MLSignal {
  name: string;
  value: any;
  weight: number;
  reliability: number; // 0-1, how reliable this signal is
  category: 'ua' | 'screen' | 'touch' | 'vendor' | 'hardware' | 'behavior';
}
export interface MLDetectionResult {
  deviceType: string;
  confidence: number;
  signals: MLSignal[];
  reasoning: string[];
  adaptiveWeights: Record<string, number>;
}
// ✅ ML-BASED ADAPTIVE WEIGHTS
// These weights adjust based on historical accuracy
let adaptiveWeights: Record<string, number> = {
  // User-Agent signals (high reliability)
  'ua_iphone': 12.0,
  'ua_ipad': 12.0,
  'ua_android': 10.0,
  'ua_macintosh': 8.0,
  // Screen size signals (medium-high reliability)
  'screen_small': 6.0,
  'screen_large': 6.0,
  'screen_ratio': 4.0,
  // Touch signals (high reliability)
  'touch_5_points': 8.0,
  'touch_many_points': 7.0,
  'touch_none': 6.0,
  // Vendor signals (very high reliability)
  'vendor_apple': 10.0,
  'vendor_google': 8.0,
  'vendor_other': 3.0,
  // Hardware signals (medium reliability)
  'hardware_memory': 3.0,
  'hardware_cores': 2.0,
  // Behavioral signals (low-medium reliability)
  'behavior_touch_events': 4.0,
  'behavior_pointer_type': 3.0,
};
// Historical accuracy tracking
const accuracyHistory: Record<string, number[]> = {};
/**
 * Calculate ML-based score for a signal
 */
export function calculateMLScore(
  signal: MLSignal,
  adaptiveWeights: Record<string, number>
): number {
  const baseWeight = adaptiveWeights[signal.name] || 1.0;
  const reliabilityMultiplier = signal.reliability;
  const valueStrength = typeof signal.value === 'boolean' 
    ? (signal.value ? 1.0 : 0.0)
    : Math.min(Math.abs(signal.value) / 10, 1.0); // Normalize numeric values
  return baseWeight * reliabilityMultiplier * valueStrength;
}
/**
 * Extract ML signals from browser info
 */
export function extractMLSignals(
  userAgent: string,
  screen: any,
  touch: any,
  vendor: any,
  hardware: any
): MLSignal[] {
  const signals: MLSignal[] = [];
  // User-Agent signals
  const ua = userAgent.toLowerCase();
  signals.push({
    name: 'ua_iphone',
    value: ua.includes('iphone'),
    weight: 12.0,
    reliability: 0.95,
    category: 'ua'
  });
  signals.push({
    name: 'ua_ipad',
    value: ua.includes('ipad'),
    weight: 12.0,
    reliability: 0.95,
    category: 'ua'
  });
  signals.push({
    name: 'ua_android',
    value: ua.includes('android'),
    weight: 10.0,
    reliability: 0.90,
    category: 'ua'
  });
  signals.push({
    name: 'ua_macintosh',
    value: ua.includes('macintosh'),
    weight: 8.0,
    reliability: 0.85,
    category: 'ua'
  });
  signals.push({
    name: 'ua_safari',
    value: ua.includes('safari') && !ua.includes('chrome'),
    weight: 9.0,
    reliability: 0.90,
    category: 'ua'
  });
  // Screen size signals
  signals.push({
    name: 'screen_small',
    value: screen.width < 600,
    weight: 6.0,
    reliability: 0.80,
    category: 'screen'
  });
  signals.push({
    name: 'screen_large',
    value: screen.width >= 768,
    weight: 6.0,
    reliability: 0.80,
    category: 'screen'
  });
  signals.push({
    name: 'screen_ratio',
    value: screen.aspectRatio,
    weight: 4.0,
    reliability: 0.70,
    category: 'screen'
  });
  // Touch signals
  signals.push({
    name: 'touch_5_points',
    value: touch.maxTouchPoints === 5,
    weight: 8.0,
    reliability: 0.85,
    category: 'touch'
  });
  signals.push({
    name: 'touch_many_points',
    value: touch.maxTouchPoints > 5,
    weight: 7.0,
    reliability: 0.80,
    category: 'touch'
  });
  signals.push({
    name: 'touch_none',
    value: touch.maxTouchPoints === 0,
    weight: 6.0,
    reliability: 0.85,
    category: 'touch'
  });
  // Vendor signals
  signals.push({
    name: 'vendor_apple',
    value: vendor.vendor.includes('Apple'),
    weight: 10.0,
    reliability: 0.95,
    category: 'vendor'
  });
  signals.push({
    name: 'vendor_google',
    value: vendor.vendor.includes('Google'),
    weight: 8.0,
    reliability: 0.90,
    category: 'vendor'
  });
  // Behavioral signals
  signals.push({
    name: 'behavior_touch_events',
    value: touch.hasTouchSupport,
    weight: 4.0,
    reliability: 0.75,
    category: 'behavior'
  });
  return signals;
}
/**
 * ML-based device detection
 */
export function detectDeviceWithML(
  userAgent: string,
  screen: any,
  touch: any,
  vendor: any,
  hardware: any,
  config: MLScoringConfig = {
    enableAdaptiveWeights: true,
    enableHistoricalLearning: false,
    confidenceThreshold: 0.7,
    debug: false
  }
): MLDetectionResult {
  const signals = extractMLSignals(userAgent, screen, touch, vendor, hardware);
  // Calculate scores for each device type
  const deviceScores: {
    ios_mobile: { score: number; reasoning: string[] };
    ios_tablet: { score: number; reasoning: string[] };
    android_mobile: { score: number; reasoning: string[] };
    android_tablet: { score: number; reasoning: string[] };
    desktop: { score: number; reasoning: string[] };
  } = {
    ios_mobile: { score: 0, reasoning: [] },
    ios_tablet: { score: 0, reasoning: [] },
    android_mobile: { score: 0, reasoning: [] },
    android_tablet: { score: 0, reasoning: [] },
    desktop: { score: 0, reasoning: [] }
  };
  // iOS Mobile scoring
  signals.forEach(signal => {
    const mlScore = calculateMLScore(signal, adaptiveWeights);
    if (signal.name === 'ua_iphone' && signal.value) {
      deviceScores.ios_mobile.score += mlScore;
      deviceScores.ios_mobile.reasoning.push(`iPhone UA: +${mlScore.toFixed(1)}`);
    }
    if (signal.name === 'ua_safari' && signal.value) {
      deviceScores.ios_mobile.score += mlScore * 0.8; // Safari on mobile
      deviceScores.ios_mobile.reasoning.push(`Safari mobile: +${(mlScore * 0.8).toFixed(1)}`);
    }
    if (signal.name === 'screen_small' && signal.value) {
      deviceScores.ios_mobile.score += mlScore;
      deviceScores.ios_mobile.reasoning.push(`Small screen: +${mlScore.toFixed(1)}`);
    }
    if (signal.name === 'touch_5_points' && signal.value) {
      deviceScores.ios_mobile.score += mlScore;
      deviceScores.ios_mobile.reasoning.push(`5 touch points: +${mlScore.toFixed(1)}`);
    }
    if (signal.name === 'vendor_apple' && signal.value) {
      deviceScores.ios_mobile.score += mlScore;
      deviceScores.ios_mobile.reasoning.push(`Apple vendor: +${mlScore.toFixed(1)}`);
    }
    // Negative signals for iOS Mobile
    if (signal.name === 'ua_android' && signal.value) {
      deviceScores.ios_mobile.score -= mlScore * 2; // Strong negative
      deviceScores.ios_mobile.reasoning.push(`Android UA: -${(mlScore * 2).toFixed(1)}`);
    }
    if (signal.name === 'vendor_google' && signal.value) {
      deviceScores.ios_mobile.score -= mlScore;
      deviceScores.ios_mobile.reasoning.push(`Google vendor: -${mlScore.toFixed(1)}`);
    }
  });
  // iOS Tablet scoring
  const hasMacintosh = signals.some(s => s.name === 'ua_macintosh' && s.value);
  const hasSafari = signals.some(s => s.name === 'ua_safari' && s.value);
  const hasTouch = signals.some(s => (s.name === 'touch_5_points' || s.name === 'touch_many_points') && s.value);
  const noTouch = signals.some(s => s.name === 'touch_none' && s.value);
  
  signals.forEach(signal => {
    const mlScore = calculateMLScore(signal, adaptiveWeights);
    if (signal.name === 'ua_ipad' && signal.value) {
      deviceScores.ios_tablet.score += mlScore;
      deviceScores.ios_tablet.reasoning.push(`iPad UA: +${mlScore.toFixed(1)}`);
    }
    // ✅ CRITICAL FIX: Macintosh + Safari + Touch = iPad, but Macintosh + Safari + No Touch = Mac Desktop!
    if (signal.name === 'ua_macintosh' && signal.value && hasSafari) {
      if (hasTouch) {
        // Has touch = iPad
        deviceScores.ios_tablet.score += mlScore * 1.2; // Strong iPad signal
        deviceScores.ios_tablet.reasoning.push(`Macintosh + Safari + Touch: +${(mlScore * 1.2).toFixed(1)}`);
      } else if (noTouch) {
        // No touch = Real Mac desktop, NOT iPad!
        deviceScores.ios_tablet.score -= mlScore * 2.0; // Strong negative
        deviceScores.ios_tablet.reasoning.push(`Macintosh + Safari + No Touch (Mac Desktop): -${(mlScore * 2.0).toFixed(1)}`);
      }
    }
    if (signal.name === 'screen_large' && signal.value) {
      deviceScores.ios_tablet.score += mlScore;
      deviceScores.ios_tablet.reasoning.push(`Large screen: +${mlScore.toFixed(1)}`);
    }
    if (signal.name === 'touch_5_points' && signal.value) {
      deviceScores.ios_tablet.score += mlScore * 0.8;
      deviceScores.ios_tablet.reasoning.push(`5 touch points: +${(mlScore * 0.8).toFixed(1)}`);
    }
    if (signal.name === 'vendor_apple' && signal.value) {
      deviceScores.ios_tablet.score += mlScore;
      deviceScores.ios_tablet.reasoning.push(`Apple vendor: +${mlScore.toFixed(1)}`);
    }
    // Negative for small screens
    if (signal.name === 'screen_small' && signal.value) {
      deviceScores.ios_tablet.score -= mlScore * 1.5;
      deviceScores.ios_tablet.reasoning.push(`Small screen (iPhone): -${(mlScore * 1.5).toFixed(1)}`);
    }
    // ✅ Strong negative: No touch + Macintosh = definitely NOT iPad
    if (signal.name === 'touch_none' && signal.value && hasMacintosh) {
      deviceScores.ios_tablet.score -= mlScore * 2.5;
      deviceScores.ios_tablet.reasoning.push(`No touch + Macintosh (Real Mac): -${(mlScore * 2.5).toFixed(1)}`);
    }
  });
  // Android Mobile scoring
  signals.forEach(signal => {
    const mlScore = calculateMLScore(signal, adaptiveWeights);
    if (signal.name === 'ua_android' && signal.value) {
      deviceScores.android_mobile.score += mlScore;
      deviceScores.android_mobile.reasoning.push(`Android UA: +${mlScore.toFixed(1)}`);
    }
    if (signal.name === 'screen_small' && signal.value) {
      deviceScores.android_mobile.score += mlScore;
      deviceScores.android_mobile.reasoning.push(`Small screen: +${mlScore.toFixed(1)}`);
    }
    if (signal.name === 'touch_many_points' && signal.value) {
      deviceScores.android_mobile.score += mlScore;
      deviceScores.android_mobile.reasoning.push(`Many touch points: +${mlScore.toFixed(1)}`);
    }
    if (signal.name === 'vendor_google' && signal.value) {
      deviceScores.android_mobile.score += mlScore;
      deviceScores.android_mobile.reasoning.push(`Google vendor: +${mlScore.toFixed(1)}`);
    }
    // Negative signals
    if (signal.name === 'ua_iphone' && signal.value) {
      deviceScores.android_mobile.score -= mlScore * 2;
      deviceScores.android_mobile.reasoning.push(`iPhone UA: -${(mlScore * 2).toFixed(1)}`);
    }
    if (signal.name === 'vendor_apple' && signal.value) {
      deviceScores.android_mobile.score -= mlScore;
      deviceScores.android_mobile.reasoning.push(`Apple vendor: -${mlScore.toFixed(1)}`);
    }
  });
  // Desktop scoring
  signals.forEach(signal => {
    const mlScore = calculateMLScore(signal, adaptiveWeights);
    if (signal.name === 'touch_none' && signal.value) {
      deviceScores.desktop.score += mlScore;
      deviceScores.desktop.reasoning.push(`No touch: +${mlScore.toFixed(1)}`);
    }
    if (signal.name === 'screen_large' && signal.value) {
      deviceScores.desktop.score += mlScore * 0.5;
      deviceScores.desktop.reasoning.push(`Large screen: +${(mlScore * 0.5).toFixed(1)}`);
    }
    // ✅ STRONG SIGNAL: Macintosh + Safari + No Touch = Mac Desktop!
    if (signal.name === 'ua_macintosh' && signal.value && hasSafari && noTouch) {
      deviceScores.desktop.score += mlScore * 2.0; // Very strong desktop signal
      deviceScores.desktop.reasoning.push(`Macintosh + Safari + No Touch (Mac Desktop): +${(mlScore * 2.0).toFixed(1)}`);
    }
    // Apple vendor + no touch = likely Mac desktop
    if (signal.name === 'vendor_apple' && signal.value && noTouch) {
      deviceScores.desktop.score += mlScore * 1.5;
      deviceScores.desktop.reasoning.push(`Apple vendor + No Touch (Mac Desktop): +${(mlScore * 1.5).toFixed(1)}`);
    }
    // Negative for touch devices
    if (signal.name === 'touch_5_points' && signal.value) {
      deviceScores.desktop.score -= mlScore;
      deviceScores.desktop.reasoning.push(`5 touch points: -${mlScore.toFixed(1)}`);
    }
    if (signal.name === 'touch_many_points' && signal.value) {
      deviceScores.desktop.score -= mlScore;
      deviceScores.desktop.reasoning.push(`Many touch points: -${mlScore.toFixed(1)}`);
    }
  });
  // Find the best match
  let bestDevice = 'unknown';
  let bestScore = 0;
  let bestReasoning: string[] = [];
  Object.entries(deviceScores).forEach(([device, data]) => {
    if (data.score > bestScore) {
      bestScore = data.score;
      bestDevice = device;
      bestReasoning = data.reasoning;
    }
  });
  // Calculate confidence (normalize score)
  const maxPossibleScore = Object.values(adaptiveWeights).reduce((sum, weight) => sum + weight, 0);
  const confidence = Math.min(bestScore / (maxPossibleScore * 0.3), 1.0); // Normalize to 0-1
  // Debug logs removed for cleaner console
  return {
    deviceType: bestDevice,
    confidence,
    signals,
    reasoning: bestReasoning,
    adaptiveWeights: { ...adaptiveWeights }
  };
}
/**
 * Update adaptive weights based on feedback
 */
export function updateAdaptiveWeights(
  signalName: string,
  wasCorrect: boolean,
  config: MLScoringConfig
): void {
  if (!config.enableAdaptiveWeights) return;
  // Track accuracy
  if (!accuracyHistory[signalName]) {
    accuracyHistory[signalName] = [];
  }
  accuracyHistory[signalName].push(wasCorrect ? 1 : 0);
  // Keep only last 100 measurements
  if (accuracyHistory[signalName].length > 100) {
    accuracyHistory[signalName] = accuracyHistory[signalName].slice(-100);
  }
  // Calculate accuracy
  const accuracy = accuracyHistory[signalName].reduce((sum, val) => sum + val, 0) / 
                   accuracyHistory[signalName].length;
  // Adjust weight based on accuracy
  const currentWeight = adaptiveWeights[signalName] || 1.0;
  const adjustmentFactor = accuracy > 0.7 ? 1.1 : accuracy < 0.3 ? 0.9 : 1.0;
  adaptiveWeights[signalName] = Math.max(0.1, Math.min(20.0, currentWeight * adjustmentFactor));
  if (config.debug) {
      // Weight update log removed for cleaner console
  }
}
/**
 * Reset adaptive weights to defaults
 */
export function resetAdaptiveWeights(): void {
  adaptiveWeights = {
    'ua_iphone': 12.0,
    'ua_ipad': 12.0,
    'ua_android': 10.0,
    'ua_macintosh': 8.0,
    'screen_small': 6.0,
    'screen_large': 6.0,
    'screen_ratio': 4.0,
    'touch_5_points': 8.0,
    'touch_many_points': 7.0,
    'touch_none': 6.0,
    'vendor_apple': 10.0,
    'vendor_google': 8.0,
    'vendor_other': 3.0,
    'hardware_memory': 3.0,
    'hardware_cores': 2.0,
    'behavior_touch_events': 4.0,
    'behavior_pointer_type': 3.0,
  };
  // Clear history
  Object.keys(accuracyHistory).forEach(key => {
    delete accuracyHistory[key];
  });
}
