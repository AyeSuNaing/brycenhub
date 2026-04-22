// src/app/constants/api-endpoints.ts
import { environment } from '../../environments/environment';

const BASE = environment.apiBaseUrl;

export const API = {

  // ── AUTH ────────────────────────────────────────────
  AUTH: {
    LOGIN:           `${BASE}/auth/login`,
    ME:              `${BASE}/auth/me`,
    LANGUAGE:        `${BASE}/auth/language`,
  },

  // ── USERS ───────────────────────────────────────────
  USERS: {
    BASE:            `${BASE}/users`,
    BY_ID:      (id: number | string) => `${BASE}/users/${id}`,
    BY_BRANCH:  (branchId: number | string) => `${BASE}/users?branchId=${branchId}`,
    STAFF_LIST:      `${BASE}/users/staff-list`,
    ACTIVATE:   (id: number | string) => `${BASE}/users/${id}/activate`,
    DEACTIVATE: (id: number | string) => `${BASE}/users/${id}/deactivate`,
    PASSWORD:   (id: number | string) => `${BASE}/users/${id}/password`,
  },

  // ── PROJECTS ────────────────────────────────────────
  PROJECTS: {
    BASE:            `${BASE}/projects`,
    MY:              `${BASE}/projects/my`,
    BY_ID:      (id: number | string) => `${BASE}/projects/${id}`,
    BY_BRANCH:  (branchId: number | string) => `${BASE}/projects/by-branch/${branchId}`,
    MEMBERS:    (id: number | string) => `${BASE}/projects/${id}/members`,
  },

  // ── TASKS ───────────────────────────────────────────
  TASKS: {
    BASE:            `${BASE}/tasks`,
    MY:              `${BASE}/tasks/my`,
    BY_ID:      (id: number | string) => `${BASE}/tasks/${id}`,
    STATUS:     (id: number | string) => `${BASE}/tasks/${id}/status`,
    BY_PROJECT: (projectId: number | string) => `${BASE}/tasks?projectId=${projectId}`,
  },

  // ── SPRINTS ─────────────────────────────────────────
  SPRINTS: {
    BASE:            `${BASE}/sprints`,
    BY_ID:      (id: number | string) => `${BASE}/sprints/${id}`,
    BY_PROJECT: (projectId: number | string) => `${BASE}/sprints?projectId=${projectId}`,
  },

  // ── CHAT ────────────────────────────────────────────
  CHAT: {
    BY_KEY:     (key: string) => `${BASE}/chat/${key.toLowerCase()}`,
    SEND:            `${BASE}/chat/send`,
  },

  // ── BRANCHES ────────────────────────────────────────
  BRANCHES: {
    BASE:            `${BASE}/branches`,
    BY_ID:      (id: number | string) => `${BASE}/branches/${id}`,
    BY_COUNTRY: (countryId: number | string) => `${BASE}/branches/by-country/${countryId}`,
  },

  // ── NOTIFICATIONS ───────────────────────────────────
  NOTIFICATIONS: {
    BASE:            `${BASE}/notifications`,
    MY:              `${BASE}/notifications/my`,
    UNREAD_COUNT:    `${BASE}/notifications/unread-count`,
    MARK_READ:  (id: number | string) => `${BASE}/notifications/${id}/read`,
    MARK_ALL:        `${BASE}/notifications/read-all`,
  },

  // ── ANNOUNCEMENTS ───────────────────────────────────
  ANNOUNCEMENTS: {
    BASE:            `${BASE}/announcements`,
    BY_ID:      (id: number | string) => `${BASE}/announcements/${id}`,
  },

  // ── COMMENTS ────────────────────────────────────────
  COMMENTS: {
    BASE:            `${BASE}/comments`,
    BY_ID:      (id: number | string) => `${BASE}/comments/${id}`,
    BY_TASK:    (taskId: number | string) => `${BASE}/comments?taskId=${taskId}`,
  },

  // ── ATTACHMENTS ─────────────────────────────────────
  ATTACHMENTS: {
    BASE:            `${BASE}/attachments`,
    BY_ID:      (id: number | string) => `${BASE}/attachments/${id}`,
    UPLOAD:          `${BASE}/attachments/upload`,
  },

  // ── ACTIVITY LOGS ───────────────────────────────────
  ACTIVITY: {
    BASE:            `${BASE}/activity-logs`,
    BY_PROJECT: (projectId: number | string) => `${BASE}/activity-logs?projectId=${projectId}`,
  },

  // ── DASHBOARD (PM / Member) ─────────────────────────
  DASHBOARD: {
    STATS:           `${BASE}/dashboard/pm/stats`,
    ACTIVE_PROJECTS: `${BASE}/dashboard/pm/active-projects`,
    PORTFOLIO:       `${BASE}/dashboard/pm/portfolio`,
    TEAM:            `${BASE}/dashboard/pm/team`,
    MY_TASKS:        `${BASE}/dashboard/pm/my-tasks`,
    OVERDUE_TASKS:   `${BASE}/dashboard/pm/overdue-tasks`,
    ACTIVITIES:      `${BASE}/dashboard/pm/activities`,
    DEADLINES:       `${BASE}/dashboard/pm/deadlines`,
    ANNOUNCEMENTS:   `${BASE}/dashboard/pm/announcements`,
    TASK_STATS:      `${BASE}/dashboard/pm/task-stats`,
    CHART_DATA:      `${BASE}/dashboard/pm/chart-data`,
  },

  PROJECT: {
    BY_ID:      (id: number) => `${BASE}/projects/${id}`,
    MEMBERS:    (id: number) => `${BASE}/projects/${id}/members`,
    STATS:      (id: number) => `${BASE}/projects/${id}/stats`,
    TASKS:      (id: number) => `${BASE}/tasks/by-project/${id}`,
    SPRINTS:    (id: number) => `${BASE}/sprints/by-project/${id}`,
    ACTIVITY:   (id: number) => `${BASE}/activity-logs/by-project/${id}`,
    ANNOUNCEMENTS: `${BASE}/dashboard/pm/announcements`,
  },

  // ── ADMIN DASHBOARD (shared with VP / Director / Boss) ─
  ADMIN: {
    STATS:                 `${BASE}/admin/dashboard/stats`,
    OT_REQUESTS:           `${BASE}/admin/dashboard/ot-requests`,
    OT_APPROVE:       (id: number | string) => `${BASE}/admin/dashboard/ot-requests/${id}/approve`,
    OT_REJECT:        (id: number | string) => `${BASE}/admin/dashboard/ot-requests/${id}/reject`,
    LEAVE_REQUESTS:        `${BASE}/admin/dashboard/leave-requests`,
    LEAVE_APPROVE:    (id: number | string) => `${BASE}/admin/dashboard/leave-requests/${id}/approve`,
    LEAVE_REJECT:     (id: number | string) => `${BASE}/admin/dashboard/leave-requests/${id}/reject`,
    TODAY_LEAVE:           `${BASE}/admin/dashboard/today-leave`,
    HOLIDAYS:              `${BASE}/admin/dashboard/holidays`,
  },

  // ── BRANCH EXPENSES (Salary + Expense approvals) ────
  BRANCH_EXPENSES: {
    BASE:            `${BASE}/branch-expenses`,
    BY_ID:      (id: number | string) => `${BASE}/branch-expenses/${id}`,
    APPROVE:    (id: number | string) => `${BASE}/branch-expenses/${id}/approve`,
    REJECT:     (id: number | string) => `${BASE}/branch-expenses/${id}/reject`,
  },

  // ── BRANCH INCOME ───────────────────────────────────
  BRANCH_INCOME: {
    BASE:            `${BASE}/branch-income`,
    BY_ID:      (id: number | string) => `${BASE}/branch-income/${id}`,
  },

  // ── FINANCE CATEGORIES ──────────────────────────────
  FINANCE_CATEGORIES: {
    BASE:            `${BASE}/finance-categories`,
    BY_ID:      (id: number | string) => `${BASE}/finance-categories/${id}`,
  },

  // ── DEPARTMENTS ─────────────────────────────────────
  DEPARTMENTS: {
    BASE:            `${BASE}/departments`,
    BY_ID:      (id: number | string) => `${BASE}/departments/${id}`,
    BY_BRANCH:  (branchId: number | string) => `${BASE}/departments/by-branch/${branchId}`,
    MY_BRANCH:       `${BASE}/departments/my-branch`,
  },

};