import { Component, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { API } from '../constants/api-endpoints';

type ErrorType = 'INVALID_CREDENTIALS' | 'ACCOUNT_INACTIVE' | 'NETWORK' | 'SERVER' | 'VALIDATION' | 'TIMEOUT' | 'UNKNOWN';

interface LoginResponse {
  token: string;
  userId: number;
  name: string;
  email: string;
  role: string;
  branchId?: number;
  preferredLanguage?: string;
  profileImage?: string;
}

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  standalone: true,
  imports: [FormsModule, CommonModule],
})
export class Login implements OnDestroy {
  email: string = '';
  password: string = '';
  errorMessage: string = '';
  errorType: ErrorType | null = null;
  isLoading: boolean = false;

  private errorTimer: ReturnType<typeof setTimeout> | null = null;
  private loginSub: Subscription | null = null;
  private readonly ERROR_AUTO_DISMISS_MS = 6000;
  private readonly REQUEST_TIMEOUT_MS = 15000;

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) {}

  ngOnDestroy(): void {
    this.clearErrorTimer();
    this.loginSub?.unsubscribe();
  }

  
getDashboardRoute(role: string, branchId?: number | null): string {
  switch (role) {
    case 'BOSS':             return '/dashboard/boss';
    case 'COUNTRY_DIRECTOR': return '/dashboard/boss';
    case 'VICE_PRESIDENT':   return '/dashboard/vp';
    case 'ADMIN':
      // Super Admin = ADMIN + branchId NULL
      return (branchId == null) ? '/dashboard/super-admin' : '/dashboard/admin';
    case 'PROJECT_MANAGER':  return '/dashboard/pm';
    case 'LEADER':           return '/dashboard/leader';
    case 'DEVELOPER':        return '/dashboard/developer';
    case 'UI_UX':            return '/dashboard/uiux';
    case 'QA':               return '/dashboard/qa';
    default:                 return '/dashboard/member';
  }
}

  private validateInput(): string | null {
    const email = this.email?.trim() ?? '';
    const password = this.password ?? '';

    if (!email && !password) return 'Please enter your email and password';
    if (!email) return 'Email is required';
    if (!password) return 'Password is required';

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) return 'Please enter a valid email address';
    if (password.length < 4) return 'Password is too short';

    return null;
  }

  /**
   * Robust error classifier — doesn't rely on instanceof checks
   * because wrapped errors from interceptors / timeout operator
   * can break them.
   */
  private handleError(err: any): { type: ErrorType; message: string } {
    console.error('[Login] Raw error:', err);

    // RxJS timeout
    if (err?.name === 'TimeoutError') {
      return { type: 'TIMEOUT', message: 'Request timed out. Server is not responding.' };
    }

    // Network error (no response from server)
    const status = err?.status ?? err?.statusCode ?? 0;
    if (status === 0) {
      return { type: 'NETWORK', message: 'Cannot reach server. Please check your connection.' };
    }

    // Extract backend message from various possible shapes
    const backendMessage: string =
      err?.error?.message ||
      err?.error?.error ||
      err?.message ||
      '';

    const lowerMsg = backendMessage.toLowerCase();

    // Inactive account detection (works with any status code)
    if (lowerMsg.includes('inactive') ||
        lowerMsg.includes('disabled') ||
        lowerMsg.includes('deactivated')) {
      return {
        type: 'ACCOUNT_INACTIVE',
        message: 'Your account is inactive. Please contact your administrator.'
      };
    }

    // "Invalid email or password" detection — works with 400 OR 401
    if (lowerMsg.includes('invalid') &&
        (lowerMsg.includes('email') || lowerMsg.includes('password') || lowerMsg.includes('credential'))) {
      return { type: 'INVALID_CREDENTIALS', message: 'Invalid email or password' };
    }

    switch (status) {
      case 400:
        return { type: 'VALIDATION', message: backendMessage || 'Invalid request. Please check your input.' };
      case 401:
        return { type: 'INVALID_CREDENTIALS', message: 'Invalid email or password' };
      case 403:
        return { type: 'ACCOUNT_INACTIVE', message: backendMessage || 'Access denied.' };
      case 404:
        return { type: 'SERVER', message: 'Login service not found. Please contact IT support.' };
      case 429:
        return { type: 'SERVER', message: 'Too many login attempts. Please wait and try again.' };
      case 500:
      case 502:
      case 503:
      case 504:
        return { type: 'SERVER', message: 'Server error. Please try again in a moment.' };
      default:
        return {
          type: 'UNKNOWN',
          message: backendMessage || `Login failed (${status}). Please try again.`
        };
    }
  }

  private showError(type: ErrorType, message: string): void {
    this.errorType = type;
    this.errorMessage = message;
    this.scheduleErrorDismiss();
    this.cdr.detectChanges();
  }

  private clearError(): void {
    this.errorType = null;
    this.errorMessage = '';
    this.clearErrorTimer();
  }

  private scheduleErrorDismiss(): void {
    this.clearErrorTimer();
    this.errorTimer = setTimeout(() => {
      this.zone.run(() => {
        this.errorMessage = '';
        this.errorType = null;
        this.cdr.detectChanges();
      });
    }, this.ERROR_AUTO_DISMISS_MS);
  }

  private clearErrorTimer(): void {
    if (this.errorTimer) {
      clearTimeout(this.errorTimer);
      this.errorTimer = null;
    }
  }

  /**
   * GUARANTEED to reset isLoading and trigger change detection.
   * Uses NgZone.run to ensure Angular picks up the change.
   */
  private stopLoading(): void {
    this.zone.run(() => {
      this.isLoading = false;
      this.cdr.detectChanges();
    });
  }

  onInputChange(): void {
    if (this.errorMessage) this.clearError();
  }

  onKeyEnter(): void {
    if (!this.isLoading) this.login();
  }

  dismissError(): void {
    this.clearError();
  }

  login(): void {
    if (this.isLoading) return;

    const validationError = this.validateInput();
    if (validationError) {
      this.showError('VALIDATION', validationError);
      return;
    }

    this.isLoading = true;
    this.clearError();

    const payload = {
      email: this.email.trim().toLowerCase(),
      password: this.password,
    };

    // Clean up any stale subscription
    this.loginSub?.unsubscribe();

    this.loginSub = this.http
      .post<LoginResponse>(API.AUTH.LOGIN, payload)
      .pipe(timeout(this.REQUEST_TIMEOUT_MS))
      .subscribe({
        next: (res) => {
          this.stopLoading();

          if (!res?.token || !res?.role) {
            this.showError('SERVER', 'Invalid server response. Please try again.');
            return;
          }

          try {
            localStorage.setItem('token', res.token);
            localStorage.setItem('user', JSON.stringify(res));
          } catch {
            this.showError('UNKNOWN', 'Could not save session. Please enable cookies.');
            return;
          }

          const target = this.getDashboardRoute(res.role);
          this.router.navigate([target]);
        },

        error: (err: any) => {
          this.stopLoading();   // ← FIRST — GUARANTEED reset

          const { type, message } = this.handleError(err);
          this.showError(type, message);

          if (type === 'INVALID_CREDENTIALS') {
            this.password = '';
          }
        },

        complete: () => {
          // Safety net — if somehow next/error both missed
          this.stopLoading();
        },
      });
  }
}