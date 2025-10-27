// Base Event Interface - Yeni tracking modülleri için hazır
export interface BaseEvent {
  event_type: string;
  timestamp: number;
  user_id?: string;
  session_id?: string;
  site_id?: string;
}

// Placeholder Event - Yeni modüllerde genişletilecek
export interface PlaceholderEvent extends BaseEvent {
  event_type: 'placeholder';
  data?: any;
}

// Union of all event types - Yeni modüllerde genişletilecek
export type TrackingEvent = PlaceholderEvent;

// Collect API Types - Yeni modüllerde genişletilecek
export interface CollectRequest {
  events: TrackingEvent[];
  site_id: string;
  timestamp: number;
  signature?: string;
}

export interface CollectResponse {
  success: boolean;
  processed: number;
  errors?: string[];
}