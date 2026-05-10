import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface IncomingCall {
  roomId:       string;
  mode:         'voice' | 'video';
  callerName:   string;
  callerUserId: string;
  callerId:     number;
  isGroup:      boolean;
}

export interface CallInvitePayload {
  callerId:     number;
  calleeId:     number;
  roomId:       string;
  mode:         'voice' | 'video';
  callerName:   string;
  callerUserId: string;
  isGroup:      boolean;
}

@Injectable({ providedIn: 'root' })
export class CallNotificationService {

  // ✅ Reactive signal — IncomingCallComponent က effect() နဲ့ subscribe
  readonly incomingCall = signal<IncomingCall | null>(null);

  // ✅ FIX: seen roomIds tracking — တူတဲ့ invite ထပ်မပြအောင်
  private _seenRoomIds = new Set<string>();

  // ✅ FIX: currently active roomId — accept/reject ပြီးရင် dismiss အောင်
  private _activeRoomId: string | null = null;

  private _pollTimer: any = null;
  private _currentUserId = 0;

  constructor(private http: HttpClient) {}

  // ── Caller side: invite send ─────────────────────
  sendCallInvite(payload: CallInvitePayload): void {
    this.http.post(
      `${environment.apiBaseUrl}/call/invite`,
      payload,
      { headers: this.getAuthHeaders() }
    ).subscribe({ error: () => {} });
  }

  // ── Receiver side: start polling ─────────────────
  startListening(): void {
    const token = localStorage.getItem('token');
    if (!token) return;

    const user = this.getUserFromStorage();
    this._currentUserId = Number(user?.id || user?.userId || 0);
    if (!this._currentUserId) return;

    this.stopListening();
    // ✅ FIX: Interval 3s → 4s (slightly reduce race condition)
    this._pollTimer = setInterval(() => this._poll(), 4000);
    // First poll immediately
    this._poll();
  }

  stopListening(): void {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  // ── Receiver accepts ─────────────────────────────
  acceptCall(roomId: string, calleeId: number): void {
    // ✅ FIX: Immediately clear signal + mark seen → popup ချက်ချင်း ပိတ်သွားမယ်
    this._activeRoomId = roomId;
    this._seenRoomIds.add(roomId);
    this.incomingCall.set(null);

    this.http.post(
      `${environment.apiBaseUrl}/call/accept`,
      { roomId, calleeId },
      { headers: this.getAuthHeaders() }
    ).subscribe({ error: () => {} });
  }

  // ── Receiver rejects ─────────────────────────────
  rejectCall(roomId: string, calleeId: number): void {
    // ✅ FIX: Immediately clear signal + mark seen → popup ချက်ချင်း ပိတ်သွားမယ်
    this._activeRoomId = roomId;
    this._seenRoomIds.add(roomId);
    this.incomingCall.set(null);

    this.http.post(
      `${environment.apiBaseUrl}/call/reject`,
      { roomId, calleeId },
      { headers: this.getAuthHeaders() }
    ).subscribe({ error: () => {} });
  }

  // ── Internal polling ─────────────────────────────
  private _poll(): void {
    if (!this._currentUserId) return;

    this.http.get<any>(
      `${environment.apiBaseUrl}/call/incoming/${this._currentUserId}`,
      { headers: this.getAuthHeaders() }
    ).subscribe({
      next: (res) => {
        // No incoming call (empty body / null)
        if (!res || !res.roomId) {
          // ✅ Clear stale signal if backend ပြန် empty ဖြစ်ရင်
          if (this.incomingCall() !== null) {
            this.incomingCall.set(null);
          }
          return;
        }

        const roomId: string = res.roomId;

        // ✅ FIX: seenRoomIds check — ဒီ roomId ကို ဖန်တီးပြီးပြီဆိုရင် ထပ်မပြ
        if (this._seenRoomIds.has(roomId)) {
          return;
        }

        // ✅ FIX: activeRoomId check — လက်ရှိ active call ရှိနေရင် ထပ်မပြ
        if (this._activeRoomId === roomId) {
          return;
        }

        // ✅ Same call already showing → skip
        const current = this.incomingCall();
        if (current && current.roomId === roomId) {
          return;
        }

        // New incoming call — show popup
        this._seenRoomIds.add(roomId);
        this.incomingCall.set({
          roomId,
          mode:         res.mode    || 'video',
          callerName:   res.callerName   || 'Unknown',
          callerUserId: res.callerUserId || '',
          callerId:     Number(res.callerId || 0),
          isGroup:      Boolean(res.isGroup),
        });
      },
      error: () => {}
    });
  }

  // ── Helpers ──────────────────────────────────────
  private getUserFromStorage(): any {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}