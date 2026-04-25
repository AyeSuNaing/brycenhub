import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

/**
 * RefreshService — Global broadcast every 60s + manual trigger.
 * AnnouncementBar + BellNotification + Dashboard stats auto-refresh.
 * ✅ Heartbeat every 60s — keeps user "Online" (lastSeen updated)
 */
@Injectable({ providedIn: 'root' })
export class RefreshService implements OnDestroy {

  private _refresh$ = new Subject<void>();
  readonly refresh$ = this._refresh$.asObservable();

  private _interval?: ReturnType<typeof setInterval>;
  private _heartbeatInterval?: ReturnType<typeof setInterval>;

  constructor(private http: HttpClient) {
    // Auto broadcast every 60 seconds
    this._interval = setInterval(() => this._refresh$.next(), 60000);

    // ✅ Heartbeat every 60s — update lastSeen
    this._heartbeatInterval = setInterval(() => this.ping(), 60000);

    // ✅ Ping immediately on app start (1s delay)
    setTimeout(() => this.ping(), 1000);
  }

  private ping(): void {
    const token = localStorage.getItem('token');
    if (!token) return;
    this.http.put(
      `${environment.apiBaseUrl}/auth/heartbeat`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    ).subscribe({ error: () => {} });
  }

  /** Manual trigger — call after Mark as Paid, Submit, Approve etc. */
  trigger(): void {
    this._refresh$.next();
  }

  ngOnDestroy(): void {
    if (this._interval) clearInterval(this._interval);
    if (this._heartbeatInterval) clearInterval(this._heartbeatInterval);
  }
}