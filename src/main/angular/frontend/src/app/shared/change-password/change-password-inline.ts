import {
  Component, Output, EventEmitter, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import { getLabel, AppLabelKey } from '../../i18n/app-labels.i18n';

const BASE = environment.apiBaseUrl;

@Component({
  selector: 'app-change-password-inline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './change-password-inline.html',
  host: { style: 'display:contents' }
})
export class ChangePasswordInline {

  @Output() back = new EventEmitter<void>();

  newPassword     = '';
  confirmPassword = '';
  showNew         = false;
  showConfirm     = false;
  saving          = false;
  success         = false;
  errorMsg        = '';
  savedPassword   = '';
  passwordCopied  = false;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr:  ChangeDetectorRef,
  ) {}

  lbl(key: AppLabelKey): string {
    return getLabel(this.auth.getUser()?.preferredLanguage, key);
  }

  get strengthScore(): number {
    const p = this.newPassword;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8)           s++;
    if (p.length >= 12)          s++;
    if (/[A-Z]/.test(p))         s++;
    if (/[0-9]/.test(p))         s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  }

  get strengthLabel(): string {
    const s = this.strengthScore;
    if (s <= 1) return this.lbl('Weak');
    if (s <= 3) return this.lbl('Fair');
    if (s === 4) return this.lbl('Good');
    return this.lbl('Strong');
  }

  get strengthColor(): string {
    const s = this.strengthScore;
    if (s <= 1) return '#ef4444';
    if (s <= 3) return '#f59e0b';
    if (s === 4) return '#3b82f6';
    return '#22c55e';
  }

  get passwordsMatch(): boolean {
    return this.confirmPassword.length > 0 &&
           this.newPassword === this.confirmPassword;
  }

  get canSubmit(): boolean {
    return this.newPassword.length >= 6 &&
           this.passwordsMatch &&
           !this.saving;
  }

  submit(): void {
    this.errorMsg = '';
    if (!this.canSubmit) return;

    const user = this.auth.getUser();
    const id   = user?.id || user?.userId;
    if (!id) { this.errorMsg = 'User not found'; return; }

    this.saving = true;
    this.cdr.detectChanges();

    this.http.put(
      `${BASE}/users/${id}/change-password`,
      { newPassword: this.newPassword },
      { headers: this.auth.getHeaders() }
    ).subscribe({
      next: () => {
        this.savedPassword = this.newPassword;
        this.saving  = false;
        this.success = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.saving   = false;
        this.errorMsg = err?.error?.message || 'Failed to change password';
        this.cdr.detectChanges();
      }
    });
  }

  copyPassword(): void {
    if (!this.savedPassword) return;
    navigator.clipboard.writeText(this.savedPassword).then(() => {
      this.passwordCopied = true;
      this.cdr.detectChanges();
      setTimeout(() => { this.passwordCopied = false; this.cdr.detectChanges(); }, 2500);
    });
  }
}