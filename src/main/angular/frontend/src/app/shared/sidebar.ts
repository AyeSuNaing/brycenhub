import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <aside class="w-60 bg-gray-900 border-r border-gray-800 min-h-screen flex flex-col flex-shrink-0">

      <!-- Logo -->
      <div class="p-5 border-b border-gray-800">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-600/30">
            <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064" />
            </svg>
          </div>
          <div>
            <p class="text-white font-bold text-sm tracking-tight">ASN Global</p>
            <p class="text-gray-500 text-xs">Project Management</p>
          </div>
        </div>
      </div>

      <!-- User info -->
      <div class="p-4 border-b border-gray-800">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {{ userInitial }}
          </div>
          <div class="min-w-0">
            <p class="text-white text-sm font-medium truncate">{{ userName }}</p>
            <span class="inline-block text-xs px-2 py-0.5 rounded-full font-medium"
              [class]="getRoleBadgeClass()">{{ userRole }}</span>
          </div>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 p-3 space-y-0.5 overflow-y-auto">

        <!-- Section label -->
        <p *ngIf="mainNavItems.length > 0" class="text-gray-600 text-xs font-semibold uppercase tracking-wider px-3 py-2">Main</p>

        <a *ngFor="let item of mainNavItems"
          [routerLink]="item.route"
          routerLinkActive="bg-blue-600/10 text-blue-400 border-blue-500/20"
          [routerLinkActiveOptions]="{exact: item.exact || false}"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 border border-transparent transition-all text-sm">
          <span class="text-base w-5 text-center flex-shrink-0">{{ item.icon }}</span>
          <span class="truncate">{{ item.label }}</span>
          <span *ngIf="item.badge" class="ml-auto bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">{{ item.badge }}</span>
        </a>

        <!-- Projects section -->
        <div *ngIf="projectNavItems.length > 0">
          <p class="text-gray-600 text-xs font-semibold uppercase tracking-wider px-3 py-2 mt-2">Projects</p>
          <a *ngFor="let item of projectNavItems"
            [routerLink]="item.route"
            [queryParams]="item.queryParams"
            routerLinkActive="bg-blue-600/10 text-blue-400 border-blue-500/20"
            class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 border border-transparent transition-all text-sm">
            <span class="text-base w-5 text-center flex-shrink-0">{{ item.icon }}</span>
            <span class="truncate">{{ item.label }}</span>
          </a>
        </div>

        <!-- Admin section -->
        <div *ngIf="adminNavItems.length > 0">
          <p class="text-gray-600 text-xs font-semibold uppercase tracking-wider px-3 py-2 mt-2">Admin</p>
          <a *ngFor="let item of adminNavItems"
            [routerLink]="item.route"
            routerLinkActive="bg-blue-600/10 text-blue-400 border-blue-500/20"
            class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 border border-transparent transition-all text-sm">
            <span class="text-base w-5 text-center flex-shrink-0">{{ item.icon }}</span>
            <span class="truncate">{{ item.label }}</span>
          </a>
        </div>
      </nav>

      <!-- Logout -->
      <div class="p-3 border-t border-gray-800">
        <button (click)="logout()"
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm">
          <span class="text-base w-5 text-center">🚪</span>
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  `,
})
export class Sidebar implements OnInit {
  userName = '';
  userRole = '';
  userInitial = '';

  mainNavItems: any[] = [];
  projectNavItems: any[] = [];
  adminNavItems: any[] = [];

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit() {
    const user = this.auth.getUser();
    this.userName = user?.name || 'User';
    this.userRole = user?.role || '';
    this.userInitial = this.userName.charAt(0).toUpperCase();
    this.buildNav(this.userRole);
  }

  buildNav(role: string) {
    // Main nav — everyone sees Dashboard + Chat
    this.mainNavItems = [
      { icon: '📊', label: 'Dashboard', route: this.getDashboardRoute(role), exact: true },
      { icon: '💬', label: 'Chat', route: '/chat' },
    ];

    // Projects section — role-based
    if (['BOSS', 'COUNTRY_DIRECTOR'].includes(role)) {
      this.projectNavItems = [
        { icon: '📁', label: 'All Projects', route: '/projects' },
      ];
      this.adminNavItems = [
        { icon: '🏢', label: 'Branches', route: '/branches' },
        { icon: '👥', label: 'Team', route: '/team' },
      ];
    } else if (['ADMIN'].includes(role)) {
      this.projectNavItems = [
        { icon: '📁', label: 'All Projects', route: '/projects' },
      ];
      this.adminNavItems = [
        { icon: '👥', label: 'Team', route: '/team' },
      ];
    } else if (['PROJECT_MANAGER', 'LEADER'].includes(role)) {
      this.projectNavItems = [
        { icon: '⚡', label: 'My Active Projects', route: '/projects', queryParams: { filter: 'active' } },
        { icon: '📁', label: 'All Projects', route: '/projects', queryParams: { filter: 'all' } },
      ];
    } else {
      // UI_UX, DEVELOPER, QA
      this.projectNavItems = [
        { icon: '⚡', label: 'My Active Projects', route: '/projects', queryParams: { filter: 'active' } },
        { icon: '📁', label: 'All Projects', route: '/projects', queryParams: { filter: 'all' } },
      ];
    }
  }

  getDashboardRoute(role: string): string {
    if (['BOSS', 'COUNTRY_DIRECTOR'].includes(role)) return '/dashboard/boss';
    if (['PROJECT_MANAGER', 'LEADER' , 'DEVELOPER', 'UI_UX', 'QA' ].includes(role)) return '/dashboard/member';
    return '/dashboard/dev';
  }

  getRoleBadgeClass(): string {
    const map: any = {
      BOSS: 'bg-yellow-600/20 text-yellow-400',
      COUNTRY_DIRECTOR: 'bg-purple-600/20 text-purple-400',
      ADMIN: 'bg-pink-600/20 text-pink-400',
      PROJECT_MANAGER: 'bg-blue-600/20 text-blue-400',
      LEADER: 'bg-cyan-600/20 text-cyan-400',
      UI_UX: 'bg-green-600/20 text-green-400',
      DEVELOPER: 'bg-indigo-600/20 text-indigo-400',
      QA: 'bg-orange-600/20 text-orange-400',
    };
    return map[this.userRole] || 'bg-gray-700 text-gray-300';
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}