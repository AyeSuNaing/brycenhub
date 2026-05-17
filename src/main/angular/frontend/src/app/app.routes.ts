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
      { path: 'boss', loadComponent: () => import('./dashboard/boss-dashboard/boss-dashboard').then(m => m.BossDashboard) },
      { path: 'director', loadComponent: () => import('./dashboard/boss-dashboard/boss-dashboard').then(m => m.BossDashboard) },
      { path: 'vp',        loadComponent: () => import('./dashboard/vp-dashboard/vp-dashboard').then(m => m.VpDashboardComponent) },
      { path: 'admin',     loadComponent: () => import('./dashboard/admin-dashboard').then(m => m.AdminDashboard) },
      { path: 'super-admin', loadComponent: () => import('./dashboard/super-admin-dashboard/super-admin-dashboard').then(m => m.SuperAdminDashboard) },
      { path: 'pm',        loadComponent: () => import('./dashboard/member-dashboard').then(m => m.MemberDashboard) },
      { path: 'leader',    loadComponent: () => import('./dashboard/member-dashboard').then(m => m.MemberDashboard) },
      { path: 'developer', loadComponent: () => import('./dashboard/member-dashboard').then(m => m.MemberDashboard) },
      { path: 'uiux',      loadComponent: () => import('./dashboard/member-dashboard').then(m => m.MemberDashboard) },
      { path: 'qa',        loadComponent: () => import('./dashboard/member-dashboard').then(m => m.MemberDashboard) },
      { path: 'member',    loadComponent: () => import('./dashboard/member-dashboard').then(m => m.MemberDashboard) },
    ],
  },

  {
    path: 'projects',
    canActivate: [authGuard],
    loadComponent: () => import('./projects/projects').then(m => m.Projects),
  },

  // ── API Documentation page ──
  {
    path: 'projects/:projectId/api-docs',
    canActivate: [authGuard],
    loadComponent: () => import('./projects/api-docs').then(m => m.ApiDocsComponent),
  },

  // ── DB Schema ERD page ──
  {
    path: 'projects/:projectId/db-schema',
    canActivate: [authGuard],
    loadComponent: () => import('./projects/db-schema').then(m => m.DbSchemaComponent),
  },

  // ── Activity Log page ──
  {
    path: 'projects/:id/activity',
    canActivate: [authGuard],
    loadComponent: () => import('./projects/activity-log-page').then(m => m.ActivityLogPageComponent),
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

  // ── Voice / Video Call — authGuard မထည့်ရ (new tab မှာ token pass မဖြစ်) ──
  {
    path: 'call',
    loadComponent: () => import('./call/call').then(m => m.CallComponent),
  },

  { path: '**', redirectTo: 'login' },
];