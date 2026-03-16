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

  constructor(private http: HttpClient, private router: Router) {}

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
          // Role-based redirect
          const role = res.role;
          // if (role === 'BOSS' || role === 'COUNTRY_DIRECTOR') {
          //   this.router.navigate(['/dashboard/boss']);
          // } else if (role === 'PROJECT_MANAGER' || role === 'LEADER') {
          //   this.router.navigate(['/dashboard/member']);
          // } else {
          //   this.router.navigate(['/dashboard/dev']);
          // }
          if (role === 'BOSS' || role === 'COUNTRY_DIRECTOR') {
            this.router.navigate(['/dashboard/boss']);
          } else  {
            this.router.navigate(['/dashboard/member']);
          } 

        },
        error: () => {
          this.isLoading = false;
          this.errorMessage = 'Invalid email or password';
        },
      });
  }
}
