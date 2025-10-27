/**
 * Client-Side State Store
 * Manages connection state and metrics
 */
import type { ActiveUserMetrics } from '../../types/index.js';
export type ConnectionMode = 'websocket' | 'polling' | 'disconnected';
export type AppState = 'foreground' | 'background' | 'closed';
export class StateStore {
  private connectionMode: ConnectionMode = 'disconnected';
  private appState: AppState = 'foreground';
  private isLeader: boolean = false;
  private currentMetrics: ActiveUserMetrics | null = null;
  private listeners: Set<(metrics: ActiveUserMetrics) => void> = new Set();
  setConnectionMode(mode: ConnectionMode): void {
    this.connectionMode = mode;
  }
  getConnectionMode(): ConnectionMode {
    return this.connectionMode;
  }
  setAppState(state: AppState): void {
    this.appState = state;
  }
  getAppState(): AppState {
    return this.appState;
  }
  setLeader(isLeader: boolean): void {
    this.isLeader = isLeader;
  }
  isTabLeader(): boolean {
    return this.isLeader;
  }
  updateMetrics(metrics: ActiveUserMetrics): void {
    this.currentMetrics = metrics;
    this.notifyListeners(metrics);
  }
  getMetrics(): ActiveUserMetrics | null {
    return this.currentMetrics;
  }
  onMetricsUpdate(callback: (metrics: ActiveUserMetrics) => void): () => void {
    this.listeners.add(callback);
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }
  private notifyListeners(metrics: ActiveUserMetrics): void {
    this.listeners.forEach(listener => listener(metrics));
  }
  clear(): void {
    this.currentMetrics = null;
    this.listeners.clear();
  }
}
