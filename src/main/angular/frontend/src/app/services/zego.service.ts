import { Injectable } from '@angular/core';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { environment } from '../../environments/environment';

export interface ZegoUser {
  userId: string;
  userName: string;
}

@Injectable({
  providedIn: 'root'
})
export class ZegoService {

  private appID = environment.zegoAppId;
  private serverSecret = environment.zegoServerSecret;

  // ── Token Generate ──────────────────────────────
  generateToken(roomID: string, user: ZegoUser): string {
    // ✅ unique roomID — same room rejoin error fix
    const uniqueRoomID = `${roomID}_${Date.now()}`;
    return ZegoUIKitPrebuilt.generateKitTokenForTest(
      this.appID,
      this.serverSecret,
      uniqueRoomID,
      user.userId,
      user.userName
    );
  }

  // ── Room ID Generate ────────────────────────────

  // 1-to-1 chat/call room ID
  getDirectRoomId(userId1: string | number, userId2: string | number): string {
    const ids = [String(userId1), String(userId2)].sort();
    return `direct_${ids[0]}_${ids[1]}`;
  }

  // Group/Project room ID
  getProjectRoomId(projectId: string | number): string {
    return `project_${projectId}`;
  }

  // ── ZegoCloud Instance Create ───────────────────
  createInstance(roomID: string, user: ZegoUser): any {
    const token = this.generateToken(roomID, user);
    return ZegoUIKitPrebuilt.create(token);
  }

  // ── Random ID helper ────────────────────────────
  randomID(len = 5): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < len; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}