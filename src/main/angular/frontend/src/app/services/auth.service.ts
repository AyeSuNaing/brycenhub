import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { API } from '../constants/api-endpoints';

@Injectable({ providedIn: 'root' })
export class AuthService {

  constructor(private http: HttpClient) {}

  // ── Token ──────────────────────────────────────────────────────────
  getToken(): string | null {
    return localStorage.getItem('token');
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  // ── User (localStorage cache) ──────────────────────────────────────
  getUser(): any {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  }

  getRole(): string {
    return this.getUser()?.role || '';
  }

  // ── Headers (chat, kanban, projects တွေ သုံးနေတာ — မဖြုတ်ရ) ──────
  getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.getToken()}`,
      'Content-Type': 'application/json',
    });
  }

  // ── Login ──────────────────────────────────────────────────────────
  login(email: string, password: string): Observable<any> {
    return this.http.post<any>(API.AUTH.LOGIN, { email, password }).pipe(
      tap(res => {
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res));
      })
    );
  }

  // ── Load current user from API → save to localStorage ─────────────
  // Reload ဖြစ်ရင် ဒါကို call လုပ်မယ် → user info ပြန်ရမယ်
  loadCurrentUser(): Observable<any> {
    return this.http.get<any>(API.AUTH.ME).pipe(
      tap(user => {
        const cached = this.getUser();
        // token နဲ့ role ကို မထိဘဲ user info update
        const updated = {
          ...cached,
          id:               user.id,
          name:             user.name,
          email:            user.email,
          branchId:         user.branchId,
          roleId:           user.roleId,
          profileImage:     user.profileImage,
          preferredLanguage: user.preferredLanguage,
        };
        localStorage.setItem('user', JSON.stringify(updated));
      })
    );
  }

  // ── Logout ─────────────────────────────────────────────────────────
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
}

// import { Injectable } from '@angular/core';
// import { HttpClient, HttpHeaders } from '@angular/common/http';
// import { Observable } from 'rxjs';
// import { environment } from '../../environments/environment';

// @Injectable({ providedIn: 'root' })
// export class AuthService {
//   private baseUrl = environment.apiBaseUrl;

//   constructor(private http: HttpClient) {}

//   getToken(): string | null {
//     return localStorage.getItem('token');
//   }

//   getUser(): any {
//     const u = localStorage.getItem('user');
//     return u ? JSON.parse(u) : null;
//   }

//   getRole(): string {
//     return this.getUser()?.role || '';
//   }

//   isLoggedIn(): boolean {
//     return !!this.getToken();
//   }

//   logout() {
//     localStorage.removeItem('token');
//     localStorage.removeItem('user');
//   }

//   getHeaders(): HttpHeaders {
//     return new HttpHeaders({
//       Authorization: `Bearer ${this.getToken()}`,
//       'Content-Type': 'application/json',
//     });
//   }
// }
