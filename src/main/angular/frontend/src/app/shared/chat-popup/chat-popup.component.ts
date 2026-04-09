import {
  Component, OnInit, OnDestroy, Input, Output,
  EventEmitter, ViewChild, ElementRef, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { ZegoService } from '../../services/zego.service';
import { AuthService } from '../../services/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface ChatMember {
  id: number;
  name: string;
  role?: string;
  color?: string;
  initial?: string;
  online?: boolean;
  projectId?: number;   // group chat အတွက်
  projectName?: string; // group chat အတွက်
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  time: string;
  isMine: boolean;
}

@Component({
  selector: 'app-chat-popup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-popup.component.html',
  styleUrl: './chat-popup.component.scss'
})
export class ChatPopupComponent implements OnInit, OnDestroy {

  @Input() member!: ChatMember;
  @Input() isGroup = false;
  @Output() close = new EventEmitter<void>();

  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('callContainer') callContainer!: ElementRef;

  // UI State
  activeTab: 'chat' | 'call' = 'chat';
  isMinimized = false;
  newMessage = '';
  messages: ChatMessage[] = [];
  isInCall = false;
  callMode: 'voice' | 'video' = 'voice';

  // Zego
  private zpInstance: any = null;
  private currentUser: any = null;
  private roomID = '';

  constructor(
    private zegoService: ZegoService,
    private authService: AuthService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getUser();

    // Room ID set
    if (this.isGroup && this.member.projectId) {
      this.roomID = this.zegoService.getProjectRoomId(this.member.projectId);
    } else {
      this.roomID = this.zegoService.getDirectRoomId(
        this.currentUser.id, this.member.id
      );
    }

    this.loadChatHistory();
  }

  ngOnDestroy() {
    this.endCall();
  }

  // ── Chat ─────────────────────────────────────────
  loadChatHistory() {
    const url = this.isGroup
      ? `${environment.apiBaseUrl}/chat/project/${this.member.projectId}`
      : `${environment.apiBaseUrl}/chat/direct/${this.member.id}`;

    this.http.get<any[]>(url, {
      headers: this.authService.getHeaders()
    }).subscribe({
      next: (msgs) => {
        this.messages = msgs.map(m => ({
          id: String(m.id),
          senderId: String(m.senderId),
          senderName: m.senderName || 'User',
          content: m.content,
          time: this.formatTime(m.createdAt),
          isMine: m.senderId === this.currentUser.id
        }));
        this.cdr.detectChanges();
        this.scrollToBottom();
      },
      error: () => {
        this.messages = [];
      }
    });
  }

  sendMessage() {
    if (!this.newMessage.trim()) return;

    const content = this.newMessage.trim();
    this.newMessage = '';

    this.http.post<any>(
      `${environment.apiBaseUrl}/chat/send`,
      {
        channelType: this.isGroup ? 'PROJECT' : 'DIRECT',
        channelId: this.isGroup ? this.member.projectId : this.member.id,
        content: content,
        originalLanguage: this.currentUser?.preferredLanguage || 'en'
      },
      { headers: this.authService.getHeaders() }
    ).subscribe({
      next: (msg) => {
        this.messages.push({
          id: String(msg.id || Date.now()),
          senderId: String(this.currentUser.id),
          senderName: this.currentUser.name,
          content: content,
          time: this.formatTime(new Date().toISOString()),
          isMine: true
        });
        this.cdr.detectChanges();
        this.scrollToBottom();
      },
      error: () => {
        // Optimistic update
        this.messages.push({
          id: String(Date.now()),
          senderId: String(this.currentUser.id),
          senderName: this.currentUser.name,
          content: content,
          time: this.formatTime(new Date().toISOString()),
          isMine: true
        });
        this.cdr.detectChanges();
        this.scrollToBottom();
      }
    });
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  // ── Call ─────────────────────────────────────────
  startCall(mode: 'voice' | 'video') {
    this.callMode = mode;
    this.activeTab = 'call';
    this.isInCall = true;
    this.cdr.detectChanges();

    setTimeout(() => {
      if (!this.callContainer?.nativeElement) return;

      const user = {
        userId: String(this.currentUser.id),
        userName: this.currentUser.name
      };

      const token = this.zegoService.generateToken(this.roomID, user);
      this.zpInstance = ZegoUIKitPrebuilt.create(token);

      this.zpInstance.joinRoom({
        container: this.callContainer.nativeElement,
        scenario: {
          mode: this.isGroup
            ? ZegoUIKitPrebuilt.GroupCall
            : ZegoUIKitPrebuilt.OneONoneCall,
        },
        turnOnMicrophoneWhenJoining: true,
        turnOnCameraWhenJoining: mode === 'video',
        showMyCameraToggleButton: mode === 'video',
        showAudioVideoSettingsButton: true,
        showScreenSharingButton: mode === 'video',
        showTextChat: false,
        showUserList: this.isGroup,
        maxUsers: this.isGroup ? 20 : 2,
        onLeaveRoom: () => {
          this.endCall();
        }
      });
    }, 300);
  }

  endCall() {
    if (this.zpInstance) {
      try { this.zpInstance.destroy(); } catch {}
      this.zpInstance = null;
    }
    this.isInCall = false;
    this.activeTab = 'chat';
    this.cdr.detectChanges();
  }

  // ── UI Helpers ───────────────────────────────────
  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
  }

  closePopup() {
    this.endCall();
    this.close.emit();
  }

  scrollToBottom() {
    setTimeout(() => {
      if (this.messagesContainer?.nativeElement) {
        const el = this.messagesContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    }, 50);
  }

  formatTime(isoString: string): string {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: false
      });
    } catch { return ''; }
  }

  get popupTitle(): string {
    return this.isGroup
      ? (this.member.projectName || 'Group Chat')
      : this.member.name;
  }
}
