import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { API } from '../constants/api-endpoints';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  standalone: true,
  imports: [FormsModule, CommonModule],
})
export class Login {
  email: string = '';
  password: string = '';
  errorMessage: string = '';
  isLoading: boolean = false;

  constructor(private http: HttpClient, private router: Router) { }

  getDashboardRoute(role: string): string {
    switch (role) {
      case 'BOSS':
      case 'COUNTRY_DIRECTOR': return '/dashboard/boss';
      case 'ADMIN':            return '/dashboard/admin';
      case 'PROJECT_MANAGER':  return '/dashboard/pm';
      case 'LEADER':           return '/dashboard/leader';
      case 'DEVELOPER':        return '/dashboard/developer';
      case 'UI_UX':            return '/dashboard/uiux';
      case 'QA':               return '/dashboard/qa';
      default:                 return '/dashboard/member';
    }
  }

  login() {
    this.isLoading = true;
    this.errorMessage = '';

    this.http
      .post<any>(API.AUTH.LOGIN, {
        email: this.email,
        password: this.password,
      })
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          localStorage.setItem('token', res.token);
          localStorage.setItem('user', JSON.stringify(res));
          this.router.navigate([this.getDashboardRoute(res.role)]);
        },
        error: () => {
          this.isLoading = false;
          this.errorMessage = 'Invalid email or password';
        },
      });
  }
}