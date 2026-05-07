import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-call',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './call.html',
  styleUrl: './call.scss'
})
export class CallComponent implements OnInit, OnDestroy {

  roomId   = '';
  mode: 'video' | 'voice' = 'video';
  callName = '';
  isGroup  = false;
  userName = '';
  userId   = '';

  private zpInstance: any = null;
  error = '';

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.roomId   = params['roomId']   || '';
      this.mode     = params['mode']     || 'video';
      this.callName = params['name']     || 'Call';
      this.isGroup  = params['isGroup']  === 'true';
      this.userName = params['userName'] || 'User';
      this.userId   = params['userId']   || String(Date.now());

      if (!this.roomId) {
        this.error = 'Invalid call link.';
        return;
      }

      setTimeout(() => this.initCall(), 300);
    });
  }

  ngOnDestroy() {
    if (this.zpInstance) {
      try { this.zpInstance.destroy(); } catch {}
    }
  }

  initCall() {
    const container = document.getElementById('zego-call-container');
    if (!container) return;

    try {
      const token = ZegoUIKitPrebuilt.generateKitTokenForTest(
        environment.zegoAppId,
        environment.zegoServerSecret,
        this.roomId,
        this.userId,
        this.userName
      );

      this.zpInstance = ZegoUIKitPrebuilt.create(token);

      this.zpInstance.joinRoom({
        container:                    container,
        scenario: {
          mode: this.isGroup
            ? ZegoUIKitPrebuilt.GroupCall
            : ZegoUIKitPrebuilt.OneONoneCall,
        },
        showPreJoinView:              false,
        turnOnMicrophoneWhenJoining:  true,
        turnOnCameraWhenJoining:      this.mode === 'video',
        showMyCameraToggleButton:     true,
        showMicrophoneButton:         true,
        showAudioVideoSettingsButton: true,
        showScreenSharingButton:      this.mode === 'video',
        showTextChat:                 true,
        showUserList:                 this.isGroup,
        maxUsers:                     this.isGroup ? 20 : 2,

        // ✅ Self leave → close tab
        onLeaveRoom: () => {
          this.closeTab();
        },

        // ✅ Other user leaves → auto close tab (1-to-1 only)
        onUserLeave: (users: any[]) => {
          if (!this.isGroup && users && users.length > 0) {
            setTimeout(() => {
              this.closeTab();
            }, 1500); // 1.5s နဲနဲ ကြာမှ close
          }
        },
      });

    } catch (e) {
      this.error = 'Failed to start call.';
    }
  }

  closeTab() {
    if (this.zpInstance) {
      try { this.zpInstance.destroy(); } catch {}
    }
    window.close();
  }
}