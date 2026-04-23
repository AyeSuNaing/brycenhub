import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * RefreshService — Global broadcast every 60s + manual trigger.
 * AnnouncementBar + BellNotification + Dashboard stats auto-refresh.
 */
@Injectable({ providedIn: 'root' })
export class RefreshService implements OnDestroy {

  private _refresh$ = new Subject<void>();
  readonly refresh$ = this._refresh$.asObservable();

  private _interval?: ReturnType<typeof setInterval>;

  constructor() {
    // Auto broadcast every 60 seconds
    this._interval = setInterval(() => this._refresh$.next(), 60000);
  }

  /** Manual trigger — call after Mark as Paid, Submit, Approve etc. */
  trigger(): void {
    this._refresh$.next();
  }

  ngOnDestroy(): void {
    if (this._interval) clearInterval(this._interval);
  }
}