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
    BY_BRANCH:  (branchId: number | string) => `${BASE}/users/branch/${branchId}`,
    ACTIVATE:   (id: number | string) => `${BASE}/users/${id}/activate`,
    DEACTIVATE: (id: number | string) => `${BASE}/users/${id}/deactivate`,
    PASSWORD:   (id: number | string) => `${BASE}/users/${id}/password`,
  },

  // ── PROJECTS ────────────────────────────────────────
  PROJECTS: {
    BASE:            `${BASE}/projects`,
    BY_ID:      (id: number | string) => `${BASE}/projects/${id}`,
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
    TASK_STATS:      `${BASE}/dashboard/pm/task-stats`,   // ✅ ထည့်
    CHART_DATA:      `${BASE}/dashboard/pm/chart-data`,   // ✅ ထည့်
  },

  PROJECT: {
    BY_ID:      (id: number) => `${BASE}/projects/${id}`,
    MEMBERS:    (id: number) => `${BASE}/projects/${id}/members`,
    STATS:      (id: number) => `${BASE}/projects/${id}/stats`,   // ← NEW လိုတယ်
    TASKS:      (id: number) => `${BASE}/tasks/by-project/${id}`,
    SPRINTS:    (id: number) => `${BASE}/sprints/by-project/${id}`,
    ACTIVITY:   (id: number) => `${BASE}/activity-logs/by-project/${id}`,
    ANNOUNCEMENTS: `${BASE}/dashboard/pm/announcements`,          // project scope filter လုပ်မယ်
},


// constants/api-endpoints.ts ထဲ ထပ်ထည့်
ADMIN: {
  STATS:          `${BASE}/admin/dashboard/stats`,
  OT_REQUESTS:    `${BASE}/admin/dashboard/ot-requests`,
  LEAVE_REQUESTS: `${BASE}/admin/dashboard/leave-requests`,
  TODAY_LEAVE:    `${BASE}/admin/dashboard/today-leave`,
  HOLIDAYS:       `${BASE}/admin/dashboard/holidays`,
}


};