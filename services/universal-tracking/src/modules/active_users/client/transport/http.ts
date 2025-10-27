/**
 * HTTP Client
 * Handles REST API calls (join, leave)
 */
import type { JoinPayload, LeavePayload } from '../../types/Messages.js';
export class HttpClient {
  private apiUrl: string;
  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }
  async join(payload: JoinPayload): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/presence/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
          } catch (error) {
      console.error('[HTTP] Join failed:', error);
      throw error;
    }
  }
  async leave(payload: LeavePayload): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/presence/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
          } catch (error) {
      console.error('[HTTP] Leave failed:', error);
      throw error;
    }
  }
}
