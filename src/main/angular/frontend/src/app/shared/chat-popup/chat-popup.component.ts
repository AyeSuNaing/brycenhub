import {
  Component, OnInit, OnDestroy, Input, Output,
  EventEmitter, ViewChild, ElementRef, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  projectId?: number;
  projectName?: string;
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

  isMinimized = false;
  newMessage = '';
  messages: ChatMessage[] = [];

  private currentUser: any = null;
  private roomID = '';
  private _pollTimer: any = null;
  private _lastMessageId = '';


  constructor(
    private zegoService: ZegoService,
    private authService: AuthService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getUser();

    if (!this.currentUser.id && this.currentUser.userId) {
      this.currentUser.id = this.currentUser.userId;
    }

    if (this.isGroup && this.member.projectId) {
      this.roomID = this.zegoService.getProjectRoomId(this.member.projectId);
    } else {
      this.roomID = this.zegoService.getDirectRoomId(
        this.currentUser.id, this.member.id
      );
    }

    this.loadChatHistory();
    this.startPolling();
  }

  ngOnDestroy() {
    this.stopPolling();
  }

  loadChatHistory() {
    let url: string;
    if (!this.isGroup) {
      url = `${environment.apiBaseUrl}/chat/direct/${this.member.id}`;
    } else if (this.member.projectName === 'Branch Chat') {
      url = `${environment.apiBaseUrl}/chat/branch/${this.member.projectId}`;
    } else {
      url = `${environment.apiBaseUrl}/chat/project/${this.member.projectId}`;
    }

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
          isMine: Number(m.senderId) === Number(this.currentUser.id || this.currentUser.userId)
        }));
        this.cdr.detectChanges();
        this.scrollToBottom();
      },
      error: () => { this.messages = []; }
    });
  }

  sendMessage() {
    if (!this.newMessage.trim()) return;
    const content = this.newMessage.trim();
    this.newMessage = '';

    this.http.post<any>(
      `${environment.apiBaseUrl}/chat/send`,
      {
        channelType: this.isGroup
          ? (this.member.projectName === 'Branch Chat' ? 'BRANCH' : 'PROJECT')
          : 'DIRECT',
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

  // ✅ NEW TAB approach — black screen ပြဿနာ မရှိတော့ဘူး
  startCall(mode: 'voice' | 'video') {
    const params = new URLSearchParams({
      roomId:   this.roomID,
      mode:     mode,
      name:     this.member.projectName || this.member.name,
      isGroup:  String(this.isGroup),
      userName: this.currentUser.name,
      userId:   String(this.currentUser.id),
    });

    window.open(`/call?${params.toString()}`, '_blank');
  }

  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
  }

  closePopup() {
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

  startPolling(): void {
    this.stopPolling();
    this._pollTimer = setInterval(() => {
      this.pollNewMessages();
    }, 3000);
  }

  stopPolling(): void {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  pollNewMessages(): void {
    let url: string;
    if (!this.isGroup) {
      url = `${environment.apiBaseUrl}/chat/direct/${this.member.id}`;
    } else if (this.member.projectName === 'Branch Chat') {
      url = `${environment.apiBaseUrl}/chat/branch/${this.member.projectId}`;
    } else {
      url = `${environment.apiBaseUrl}/chat/project/${this.member.projectId}`;
    }

    this.http.get<any[]>(url, {
      headers: this.authService.getHeaders()
    }).subscribe({
      next: (msgs) => {
        if (!msgs || msgs.length === 0) return;
        const myId = this.currentUser?.id || this.currentUser?.userId;
        const newMessages = msgs.map(m => ({
          id: String(m.id),
          senderId: String(m.senderId),
          senderName: m.senderName || 'User',
          content: m.content,
          time: this.formatTime(m.createdAt),
          isMine: Number(m.senderId) === Number(myId)
        }));
        // ✅ Message အသစ်တွေ ပေါင်းထည့် — existing IDs တွေ skip
        const existingIds = new Set(this.messages.map(m => m.id));
        const added = newMessages.filter(m => !existingIds.has(m.id));
        if (added.length > 0) {
          this.messages = [...this.messages, ...added];
          this.cdr.detectChanges();
          this.scrollToBottom();
        }
      },
      error: () => {}
    });
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

  // call မရှိတော့တာကြောင့် isInCall မလို — HTML compatibility အတွက်
  get isInCall(): boolean { return false; }
}
