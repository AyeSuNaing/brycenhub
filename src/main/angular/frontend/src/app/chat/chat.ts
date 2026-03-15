import { Component, OnInit, AfterViewChecked, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { Sidebar  } from '../shared/sidebar';
import { API } from '../constants/api-endpoints';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, Sidebar],
  template: `
    <div class="flex min-h-screen bg-gray-950">
      <app-sidebar></app-sidebar>

      <main class="flex-1 flex overflow-hidden" style="height:100vh">

        <!-- Channel list -->
        <div class="w-56 bg-gray-900 border-r border-gray-800 flex flex-col flex-shrink-0">
          <div class="p-4 border-b border-gray-800">
            <h2 class="text-sm font-semibold text-gray-300">Channels</h2>
          </div>
          <div class="flex-1 overflow-y-auto p-2 space-y-0.5">
            <button *ngFor="let ch of channels"
              (click)="selectChannel(ch)"
              class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors text-left"
              [class]="activeChannel?.key === ch.key
                ? 'bg-blue-600/10 text-blue-400'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'">
              <span>{{ ch.icon }}</span>
              <span class="truncate">{{ ch.label }}</span>
            </button>
          </div>
        </div>

        <!-- Chat area -->
        <div class="flex-1 flex flex-col overflow-hidden">

          <!-- Chat Header -->
          <div class="px-6 py-4 border-b border-gray-800 bg-gray-900 flex-shrink-0">
            <div class="flex items-center gap-2">
              <span class="text-xl">{{ activeChannel?.icon }}</span>
              <div>
                <h3 class="text-white font-semibold text-sm">{{ activeChannel?.label }}</h3>
                <p class="text-gray-500 text-xs">{{ messages.length }} messages</p>
              </div>
            </div>
          </div>

          <!-- Messages -->
          <div #messageContainer class="flex-1 overflow-y-auto p-6 space-y-4">

            <div *ngIf="isLoading" class="flex justify-center py-8">
              <div class="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            </div>

            <div *ngIf="!isLoading && messages.length === 0"
              class="flex flex-col items-center justify-center h-full text-gray-500">
              <p class="text-4xl mb-3">💬</p>
              <p class="text-sm">No messages yet. Say hello!</p>
            </div>

            <div *ngFor="let msg of messages"
              class="flex gap-3"
              [class.flex-row-reverse]="msg.senderId === currentUserId">

              <!-- Avatar -->
              <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {{ msg.senderId }}
              </div>

              <!-- Bubble -->
              <div class="max-w-sm">
                <div class="px-4 py-2.5 rounded-2xl text-sm"
                  [class]="msg.senderId === currentUserId
                    ? 'bg-blue-600 text-white rounded-tr-sm'
                    : 'bg-gray-800 text-gray-100 rounded-tl-sm'">
                  {{ msg.content }}
                </div>
                <p class="text-gray-600 text-xs mt-1"
                  [class.text-right]="msg.senderId === currentUserId">
                  {{ msg.createdAt | date:'HH:mm' }}
                </p>
              </div>
            </div>
          </div>

          <!-- Input -->
          <div class="p-4 border-t border-gray-800 bg-gray-900 flex-shrink-0">
            <div class="flex gap-3 items-end">
              <input
                [(ngModel)]="newMessage"
                (keyup.enter)="sendMessage()"
                placeholder="Type a message..."
                class="flex-1 bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none" />
              <button
                (click)="sendMessage()"
                [disabled]="!newMessage.trim()"
                class="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-colors flex-shrink-0">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  `,
})
export class Chat implements OnInit, AfterViewChecked {
  @ViewChild('messageContainer') messageContainer!: ElementRef;

  channels = [
    { key: 'GLOBAL', label: 'Global', icon: '🌏', channelId: null },
    { key: 'COUNTRY', label: 'Cambodia', icon: '🇰🇭', channelId: 3 },
    { key: 'PROJECT', label: 'Project #1', icon: '📁', channelId: 1 },
  ];

  activeChannel: any = this.channels[0];
  messages: any[] = [];
  newMessage = '';
  isLoading = false;
  currentUserId: number = 0;

  constructor(private http: HttpClient, private auth: AuthService) {}

  ngOnInit() {
    this.currentUserId = this.auth.getUser()?.id || 0;
    this.loadMessages();
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  scrollToBottom() {
    try {
      const el = this.messageContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }

  selectChannel(channel: any) {
    this.activeChannel = channel;
    this.loadMessages();
  }

  loadMessages() {
    this.isLoading = true;
    const ch = this.activeChannel;
    let url = API.CHAT.BY_KEY(ch.key);
    if (ch.channelId) url += `/${ch.channelId}`;

    this.http.get<any[]>(url, { headers: this.auth.getHeaders() })
      .subscribe({
        next: (msgs) => { this.messages = msgs; this.isLoading = false; },
        error: () => { this.isLoading = false; }
      });
  }

  sendMessage() {
    if (!this.newMessage.trim()) return;
    const ch = this.activeChannel;

    this.http.post<any>(
      API.CHAT.SEND,
      {
        channelType: ch.key,
        channelId: ch.channelId,
        content: this.newMessage.trim(),
        originalLanguage: 'en',
      },
      { headers: this.auth.getHeaders() }
    ).subscribe({
      next: (msg) => {
        this.messages.push(msg);
        this.newMessage = '';
      }
    });
  }
}
