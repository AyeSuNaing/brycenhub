import { Component, OnInit, OnDestroy, ChangeDetectorRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CallNotificationService, IncomingCall } from '../../services/call-notification.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-incoming-call',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './incoming-call.component.html',
  styleUrl: './incoming-call.component.scss',
})
export class IncomingCallComponent implements OnInit, OnDestroy {

  call: IncomingCall | null = null;
  private _currentUserId = 0;

  constructor(
    private callService: CallNotificationService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    effect(() => {
      this.call = this.callService.incomingCall();
      this.cdr.detectChanges();
    });
  }

  ngOnInit() {
    const user = this.authService.getUser();
    this._currentUserId = Number(user?.id || user?.userId || 0);
    this.callService.startListening();
  }

  ngOnDestroy() {
    this.callService.stopListening();
  }

  accept() {
    if (!this.call) return;
    const user = this.authService.getUser();
    const params = new URLSearchParams({
      roomId:   this.call.roomId,
      mode:     this.call.mode,
      name:     this.call.callerName,
      isGroup:  String(this.call.isGroup),
      userName: user?.name || 'User',
      userId:   String(user?.id || user?.userId || 0),
    });
    this.callService.acceptCall(this.call.roomId, this._currentUserId);
    window.open(`/call?${params.toString()}`, '_blank');
  }

  reject() {
    if (!this.call) return;
    this.callService.rejectCall(this.call.roomId, this._currentUserId);
  }
}
