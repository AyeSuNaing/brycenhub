import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  {
    path: 'login',
    loadComponent: () => import('./login/login').then(m => m.Login),
  },

  {
    path: 'dashboard',
    canActivate: [authGuard],
    children: [
      { path: 'boss',    loadComponent: () => import('./dashboard/boss-dashboard').then(m => m.BossDashboard) },
      { path: 'admin',   loadComponent: () => import('./dashboard/admin-dashboard').then(m => m.AdminDashboard) },

      // Role-based — PM / Leader / Developer / UI_UX / QA တွေ အားလုံး member dashboard သုံး
      { path: 'pm',        loadComponent: () => import('./dashboard/member-dashboard').then(m => m.MemberDashboard) },
      { path: 'leader',    loadComponent: () => import('./dashboard/member-dashboard').then(m => m.MemberDashboard) },
      { path: 'developer', loadComponent: () => import('./dashboard/member-dashboard').then(m => m.MemberDashboard) },
      { path: 'uiux',      loadComponent: () => import('./dashboard/member-dashboard').then(m => m.MemberDashboard) },
      { path: 'qa',        loadComponent: () => import('./dashboard/member-dashboard').then(m => m.MemberDashboard) },

      // member ← old path (backward compatible)
      { path: 'member', loadComponent: () => import('./dashboard/member-dashboard').then(m => m.MemberDashboard) },
    ],
  },

  {
    path: 'projects',
    canActivate: [authGuard],
    loadComponent: () => import('./projects/projects').then(m => m.Projects),
  },

  {
    path: 'design/:projectId',
    canActivate: [authGuard],
    loadComponent: () => import('./design/design-tool').then(m => m.DesignToolComponent),
  },

  {
    path: 'kanban/:projectId',
    canActivate: [authGuard],
    loadComponent: () => import('./kanban/kanban').then(m => m.Kanban),
  },

  {
    path: 'chat',
    canActivate: [authGuard],
    loadComponent: () => import('./chat/chat').then(m => m.Chat),
  },

  { path: '**', redirectTo: 'login' },
];