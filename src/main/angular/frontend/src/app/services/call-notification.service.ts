import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export interface IncomingCall {
  roomId: string;
  mode: 'voice' | 'video';
  callerName: string;
  callerUserId: string;
  callerId: number;
  isGroup: boolean;
}

@Injectable({ providedIn: 'root' })
export class CallNotificationService {

  incomingCall = signal<IncomingCall | null>(null);

  private _pollTimer: any = null;
  private _currentUserId: number | null = null;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  startListening() {
    const user = this.authService.getUser();
    if (!user) return;
    this._currentUserId = Number(user.id || user.userId);
    this._stopPolling();
    this._pollTimer = setInterval(() => this._poll(), 3000);
  }

  stopListening() {
    this._stopPolling();
  }

  private _stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  private _poll() {
    if (!this._currentUserId) return;
    this.http.get<any>(
      `${environment.apiBaseUrl}/call/incoming/${this._currentUserId}`,
      { headers: this.authService.getHeaders() }
    ).subscribe({
      next: (call) => {
        if (call && call.roomId) {
          this.incomingCall.set(call);
        }
      },
      error: () => {}
    });
  }

  // ── Caller sends call invite ──────────────────────
  sendCallInvite(invite: {
    callerId: number;      // ← ထည့်ပြီ
    calleeId: number;
    roomId: string;
    mode: 'voice' | 'video';
    callerName: string;
    callerUserId: string;
    isGroup: boolean;
  }) {
    console.log('[CallNotif] Sending invite:', invite);
    this.http.post(
      `${environment.apiBaseUrl}/call/invite`,
      invite,
      { headers: this.authService.getHeaders() }
    ).subscribe({
      next: () => console.log('[CallNotif] Invite sent ✅'),
      error: (e) => console.error('[CallNotif] Invite failed ❌', e)
    });
  }

  acceptCall(roomId: string, calleeId: number) {
    this.http.post(
      `${environment.apiBaseUrl}/call/accept`,
      { roomId, calleeId },
      { headers: this.authService.getHeaders() }
    ).subscribe();
    this.incomingCall.set(null);
  }

  rejectCall(roomId: string, calleeId: number) {
    this.http.post(
      `${environment.apiBaseUrl}/call/reject`,
      { roomId, calleeId },
      { headers: this.authService.getHeaders() }
    ).subscribe();
    this.incomingCall.set(null);
  }

  clearIncoming() {
    this.incomingCall.set(null);
  }
}