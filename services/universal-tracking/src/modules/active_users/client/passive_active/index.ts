/**
 * Passive Active Manager
 * 
 * SADECE DESKTOP cihazlar için!
 * 
 * State Machine:
 * - active: Kullanıcı aktif, WebSocket bağlantısı
 * - passive_active: Kullanıcı pasif, Polling bağlantısı (90dk interval)
 * - removed: Redis'ten silinmiş, yeniden JOIN gerekiyor
 * 
 * Durum Geçişleri:
 * 
 * active → passive_active:
 *   1. Foreground + 5 dk hareketsizlik
 *   2. Background'a geçiş (başka sekme/uygulama)
 * 
 * passive_active → active:
 *   1. Foreground + kullanıcı hareketi
 *   2. Background → Foreground geçişi
 * 
 * passive_active → removed:
 *   1. 4 dk hareketsizlik sonrası Redis'ten sil
 * 
 * removed → active:
 *   1. Kullanıcı hareketi (yeni JOIN)
 *   2. Foreground'a dönüş (yeni JOIN)
 */

export type SessionMode = 'active' | 'passive_active' | 'removed';
export type VisibilityState = 'foreground' | 'background';

export interface PassiveActiveConfig {
  customerId: string;
  sessionId: string;
  onStateChange: (newState: SessionMode) => void;
  onRemoveFromRedis: () => void;
  onRejoinToRedis: () => Promise<void>;
  isLeaderTab: () => boolean;
}

export class PassiveActiveManager {
  private config: PassiveActiveConfig;
  
  // Current state
  private currentState: SessionMode = 'active';
  private visibilityState: VisibilityState = 'foreground';
  
  // Timers
  private foregroundInactivityTimer: NodeJS.Timeout | null = null;
  private passiveInactivityTimer: NodeJS.Timeout | null = null;
  
  // Durations
  private readonly FOREGROUND_INACTIVE_DURATION = 5 * 60 * 1000; // 5 dakika
  private readonly PASSIVE_INACTIVE_DURATION = 4 * 60 * 1000; // 4 dakika
  
  // Device detection
  private isDesktop: boolean = false;
  
  constructor(config: PassiveActiveConfig) {
    this.config = config;
    this.detectDesktop();
    
    if (this.isDesktop) {
    }
  }
  
  /**
   * Detect if device is real desktop (not mobile/tablet)
   */
  private detectDesktop(): void {
    const ua = navigator.userAgent.toLowerCase();
    
    // Check for mobile/tablet OS
    const isMobileOS = /android|iphone|ipad|ipod/i.test(ua) || 
                       (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    // Check for desktop OS
    const isDesktopOS = /windows|macintosh|mac os x|linux/i.test(ua) && !isMobileOS;
    
    this.isDesktop = isDesktopOS;
  }
  
  /**
   * Check if module should be active
   */
  public shouldBeActive(): boolean {
    // Desktop'ta her zaman çalış, mobile/tablet'ta sadece leader tab'da
    if (this.isDesktop) {
      return true;
    }
    return this.config.isLeaderTab();
  }
  
  /**
   * Start tracking (called on page load)
   */
  public startTracking(): void {
    if (!this.shouldBeActive()) return;
    
    this.currentState = 'active';
    this.visibilityState = 'foreground'; // Safe assumption on page load
    
    // Start foreground inactivity timer
    this.startForegroundInactivityTimer();
  }
  
  /**
   * Start tracking with explicit visibility state (called after rejoin)
   */
  public startTrackingWithVisibility(isForeground: boolean): void {
    if (!this.shouldBeActive()) return;
    
    this.visibilityState = isForeground ? 'foreground' : 'background';
    this.stopAllTimers();
    
    if (isForeground) {
      // Foreground: Set active state and start 5 min timer
      this.currentState = 'active';
      this.startForegroundInactivityTimer();
    } else {
      // Background: Set passive_active state and start 4 min timer
      this.currentState = 'passive_active';
      this.startPassiveInactivityTimer();
      // ✅ DON'T call transitionToPassiveActive() - it would trigger onStateChange!
      // Parent already set session_mode correctly before calling this method
    }
  }
  
  /**
   * Stop tracking (called when tab becomes follower)
   */
  public stopTracking(): void {
    this.stopAllTimers();
  }
  
  /**
   * Handle user activity (click, scroll, keypress, etc.)
   */
  public async onUserActivity(): Promise<void> {
    if (!this.shouldBeActive()) return;
    
    const timestamp = this.getTimestamp();
    
    // State: removed → active (Durum 4.1)
    if (this.currentState === 'removed') {
      // ✅ CRITICAL: Don't call transitionToActive here!
      // onRejoinToRedis will call startTrackingWithVisibility which handles everything
      await this.config.onRejoinToRedis();
      return;
    }
    
    // ✅ User activity in active/passive_active states means foreground
    this.visibilityState = 'foreground';
    
    // State: passive_active → active (Durum 2.1)
    if (this.currentState === 'passive_active') {
      this.transitionToActive();
      return;
    }
    
    // State: active → reset timer
    if (this.currentState === 'active') {
      this.resetForegroundTimer();
    }
  }
  
  /**
   * Handle visibility change
   */
  public async onVisibilityChange(isForeground: boolean): Promise<void> {
    if (!this.shouldBeActive()) return;
    
    const timestamp = this.getTimestamp();
    const newVisibility: VisibilityState = isForeground ? 'foreground' : 'background';
    
    // No change
    if (this.visibilityState === newVisibility) return;
    
    this.visibilityState = newVisibility;
    
    if (isForeground) {
      await this.handleBecameForeground();
    } else {
      this.handleBecameBackground();
    }
  }
  
  /**
   * Handle foreground transition
   */
  private async handleBecameForeground(): Promise<void> {
    const timestamp = this.getTimestamp();
    
    // State: removed → active (Durum 4.2)
    if (this.currentState === 'removed') {
      // ✅ CRITICAL: Don't call transitionToActive here!
      // onRejoinToRedis will call startTrackingWithVisibility which handles everything
      await this.config.onRejoinToRedis();
      return;
    }
    
    // State: passive_active → active (Durum 2.2)
    if (this.currentState === 'passive_active') {
      this.transitionToActive();
      return;
    }
    
    // State: active → restart foreground timer
    if (this.currentState === 'active') {
      this.startForegroundInactivityTimer();
    }
  }
  
  /**
   * Handle background transition
   */
  private handleBecameBackground(): void {
    const timestamp = this.getTimestamp();
    
    // State: active → passive_active (Durum 1.2)
    if (this.currentState === 'active') {
      this.transitionToPassiveActive();
      return;
    }
    
    // Stop foreground timer
    this.stopForegroundTimer();
  }
  
  /**
   * Transition: active
   */
  private transitionToActive(): void {
    const timestamp = this.getTimestamp();
    
    this.currentState = 'active';
    this.stopAllTimers();
    
    // ✅ CRITICAL FIX: Always start foreground timer when transitioning to active
    // User activity or visibility change to foreground means we should track inactivity
    this.startForegroundInactivityTimer();
    
    // Notify parent
    this.config.onStateChange('active');
    
  }
  
  /**
   * Transition: passive_active
   */
  private transitionToPassiveActive(): void {
    const timestamp = this.getTimestamp();
    
    this.currentState = 'passive_active';
    this.stopAllTimers();
    
    // Start passive inactivity timer (4 dk)
    this.startPassiveInactivityTimer();
    
    // Notify parent
    this.config.onStateChange('passive_active');
    
  }
  
  /**
   * Transition: removed
   */
  private transitionToRemoved(): void {
    const timestamp = this.getTimestamp();
    
    this.currentState = 'removed';
    this.stopAllTimers();
    
    // Remove from Redis
    this.config.onRemoveFromRedis();
  }
  
  /**
   * Start foreground inactivity timer (5 dakika)
   */
  private startForegroundInactivityTimer(): void {
    this.stopForegroundTimer();
    
    const timestamp = this.getTimestamp();
    
    this.foregroundInactivityTimer = setTimeout(() => {
      const timestamp = this.getTimestamp();
      this.transitionToPassiveActive();
    }, this.FOREGROUND_INACTIVE_DURATION);
  }
  
  /**
   * Start passive inactivity timer (4 dakika)
   */
  private startPassiveInactivityTimer(): void {
    this.stopPassiveTimer();
    
    const timestamp = this.getTimestamp();
    
    this.passiveInactivityTimer = setTimeout(() => {
      // Durum 3.1: passive_active → removed
      this.transitionToRemoved();
    }, this.PASSIVE_INACTIVE_DURATION);
  }
  
  /**
   * Reset foreground timer
   */
  private resetForegroundTimer(): void {
    this.stopForegroundTimer();
    this.startForegroundInactivityTimer();
  }
  
  /**
   * Stop foreground timer
   */
  private stopForegroundTimer(): void {
    if (this.foregroundInactivityTimer) {
      clearTimeout(this.foregroundInactivityTimer);
      this.foregroundInactivityTimer = null;
      const timestamp = this.getTimestamp();
    }
  }
  
  /**
   * Stop passive timer
   */
  private stopPassiveTimer(): void {
    if (this.passiveInactivityTimer) {
      clearTimeout(this.passiveInactivityTimer);
      this.passiveInactivityTimer = null;
      const timestamp = this.getTimestamp();
    }
  }
  
  /**
   * Stop all timers
   */
  private stopAllTimers(): void {
    this.stopForegroundTimer();
    this.stopPassiveTimer();
  }
  
  /**
   * Get current state
   */
  public getCurrentState(): SessionMode {
    return this.currentState;
  }
  
  /**
   * Get timestamp string (HH:MM:SS)
   */
  private getTimestamp(): string {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  }
  
  /**
   * Cleanup
   */
  public destroy(): void {
    this.stopAllTimers();
  }
}

