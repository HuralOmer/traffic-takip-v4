// API Response Types - Altyapı korundu
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

// Health Check Types - Altyapı korundu
export interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  timestamp: number;
  service: string;
  version: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
  };
}

export interface ReadinessCheck {
  status: 'ready' | 'not_ready';
  timestamp: number;
  checks: {
    database: boolean;
    redis: boolean;
    clickhouse: boolean;
  };
}

// Dashboard API Types - Yeni modüllerde genişletilecek
export interface DashboardMetrics {
  timestamp: number;
  // Yeni modüllerde genişletilecek
}

export interface LiveMetrics {
  timestamp: number;
  // Yeni modüllerde genişletilecek
}

// SSE Event Types - Yeni modüllerde genişletilecek
export interface SSEEvent {
  type: 'connected' | 'data' | 'error';
  data: any;
  timestamp: number;
}