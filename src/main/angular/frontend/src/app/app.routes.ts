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
      { path: 'boss', loadComponent: () => import('./dashboard/boss-dashboard').then(m => m.BossDashboard) },
      { path: 'member', loadComponent: () => import('./dashboard/member-dashboard').then(m => m.MemberDashboard) },
      { path: 'dev', loadComponent: () => import('./dashboard/dev-dashboard').then(m => m.DevDashboard) },
    ],
  },
  {
    path: 'projects/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./projects/project-detail').then(m => m.ProjectDetail),
  },
  {
    path: 'projects',
    canActivate: [authGuard],
    loadComponent: () => import('./projects/projects').then(m => m.Projects),
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