# BRYCEN HUB PMS — CLAUDE.md
# Brycen AI Development Contest 2026
# ⚠️ READ THIS FIRST IN EVERY NEW CHAT

---

## 🚨 HOW TO START A NEW CHAT

### Step 1 — GitHub Latest Code Sync (အရေးကြီး!)
Claude.ai Project sidebar မှာ:
> **Files section** → **AyeSuNaing/brycenhub** card → **🔄 (Refresh) button နှိပ်ပါ**

ဒီ step မလုပ်ရင် Claude က old code ကိုသာ မြင်မယ်။

### Step 2 — CLAUDE.md Upload
ဒီ file ကို chat ထဲ upload လုပ်ပါ။

### Step 3 — Resume Command
> "CLAUDE.md ဖတ်ပြီး project resume လုပ်ပါ"

---

Transcripts: `/mnt/transcripts/` (bash tool နဲ့ ဖတ်ရမယ်)

---

## 📋 Project Info

| Item | Detail |
|------|--------|
| Name | Brycen Hub PMS |
| Company | Brycen Group — JP + MM + KH + VN + KR + US |
| Contest | Brycen AI Driven Development Contest 2026 |
| Prize | 1st = 1,000,000 yen |
| Deadline | May 18, 2026 |
| Developer | Brycen Cambodia Team |

---

## 🏗️ Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Spring Boot 2.7.18 / Java 17 |
| Security | JWT — jjwt 0.11.5 |
| Database | MySQL — `asn_db` |
| Frontend | Angular 21 (Standalone Components) |
| Styling | **Tailwind CSS v3** — `tailwind.config.js` EXISTS ✅ |
| Backend Port | 8080 |
| Frontend Port | 4200 |

**CSS Architecture:**
- `styles.css` = `@import Google Fonts` → `@tailwind base/components/utilities` → CSS vars → global styles
- Component `.scss` files = **EMPTY** (all styles in global `styles.css`)
- Theme = `body.dark { --bg: #0a0f1e; ... }` / `body.light { --bg: #f1f5f9; ... }`

---

## 📁 Project Path (CONFIRMED)

```
/Users/brycen_cambodia_2/Documents/1ASNworkspace/welcome/
└── src/main/angular/frontend/
    ├── tailwind.config.js         ✅ EXISTS
    ├── angular.json
    └── src/
        ├── styles.css             ← Global (Tailwind + CSS vars + all styles)
        └── app/
            ├── models/            ← dashboard.models.ts
            ├── services/          ← dashboard-data.service.ts
            ├── shared/            ← announcement-bar, bell-notification
            ├── dashboard/         ← admin-dashboard, member-dashboard, boss-dashboard
            ├── admin/             ← staff-list-inline, add-staff-inline (NEW ✅)
            ├── login/
            ├── projects/
            ├── kanban/
            ├── chat/
            ├── guards/
            ├── app.routes.ts
            └── app.config.ts
```

---

## 👥 Roles

```
BOSS → COUNTRY_DIRECTOR → ADMIN (HR) → PROJECT_MANAGER → LEADER → UI_UX/DEVELOPER/QA
CUSTOMER (separate)
```

Badge colors: BOSS=yellow | DIRECTOR=purple | ADMIN=pink | PM=green | LEADER=cyan | DEV=indigo | QA=orange

---

## 🗄️ DATABASE — Key Tables (40+ tables in asn_db)

### users
```sql
id, name, email UNIQUE, password(BCrypt),
role_id FK → user_roles,
branch_id FK → branches,
department_id FK → departments,   ← NEW ✅ (2026-03-20)
client_id FK → clients,
preferred_language(en/ja/my/vi/ko/km),
is_active(0/1), profile_image, phone,
last_seen DATETIME, created_at, updated_at
```

### departments (NEW ✅ 2026-03-20)
```sql
id, branch_id FK, name VARCHAR(100), description,
created_by FK users, created_at
UNIQUE(branch_id, name)

-- Seed data:
-- Cambodia(3): Engineering(1), Admin(2), Content(3)
-- Japan(1):    Engineering(4), Management(5)
```

### ot_requests
```sql
id, user_id FK, work_date DATE, ot_hours DECIMAL,
day_type(WEEKDAY/SATURDAY/SUNDAY/HOLIDAY),
ot_rate(1.5/2.0), ot_amount, project_id FK,
reason, status(PENDING/APPROVED/REJECTED),
approved_by FK, approved_at, reject_reason, created_at
```

### leave_requests (NEW ✅)
```sql
id, user_id FK, leave_type(ANNUAL/SICK/UNPAID),
start_date DATE, end_date DATE, total_days INT,
reason, status(PENDING/APPROVED/REJECTED),
approved_by FK, approved_at, reject_reason, created_at
```

### public_holidays
```sql
id, country_id FK, name, holiday_date DATE,
description, created_at
```

### member_skills (NEW ✅)
```sql
id, user_id FK, skill_name VARCHAR(100),
skill_name_en VARCHAR(100),   ← EN standard (AI search)
skill_level(BEGINNER/MID/SENIOR), input_type(CV/MANUAL),
created_at
```

---

## 🔗 API Endpoints

### Admin Dashboard
```
GET  /api/admin/dashboard/stats
GET  /api/admin/dashboard/ot-requests?status=PENDING
GET  /api/admin/dashboard/leave-requests?status=PENDING
GET  /api/admin/dashboard/today-leave
GET  /api/admin/dashboard/holidays?year=2026&month=3
PATCH /api/admin/dashboard/ot-requests/{id}/approve
PATCH /api/admin/dashboard/ot-requests/{id}/reject
PATCH /api/admin/dashboard/leave-requests/{id}/approve
PATCH /api/admin/dashboard/leave-requests/{id}/reject
```

### Users
```
GET  /api/users/staff-list    ← role name + dept + skills (top 3) ✅
GET  /api/users/by-branch/{branchId}
PUT  /api/users/{id}/activate
PUT  /api/users/{id}/deactivate
```

### Departments (NEW ✅)
```
GET  /api/departments/my-branch   ← admin ကိုယ်တိုင်ရဲ့ branch depts
GET  /api/departments/by-branch/{branchId}
POST /api/departments
PUT  /api/departments/{id}
DELETE /api/departments/{id}
```

### Announcements
```
GET /api/dashboard/pm/announcements
→ AnnouncementResponse { id, pinned, tag, tagColor, title, text, meta, time }
```

---

## 📢 Announcement Logic (IMPORTANT — မမေ့ပါနဲ့)

```
DB: announcements.target_scope = GLOBAL | BRANCH | PROJECT
    announcements.target_id    = NULL | branch_id | project_id

Filter rule (DashboardController.getAnnouncements()):
  GLOBAL           → user အားလုံး မြင်ရ
  BRANCH target=X  → branchId=X ဖြစ်တဲ့ user မြင်ရ
  PROJECT target=Y → Y project member မြင်ရ

Examples:
  admin@asn.com (branch=1, Japan)
    → GLOBAL ✅ + BRANCH target=1 ✅

  admin@brycen.kh (branch=3, Cambodia)
    → GLOBAL ✅ + BRANCH target=3 ✅

Angular flow:
  DashboardDataService.getAnnouncements()
  → API.DASHBOARD.ANNOUNCEMENTS (/api/dashboard/pm/announcements)
  → this.announcements = data
  → <app-announcement-bar [announcements]="announcements">
  → *ngIf="announcements.length > 0" → bar ပြ
```

---

## 🖥️ Admin Dashboard — Angular Files

### Pattern: member-dashboard project-inline pattern အတိုင်း

```
activeView = 'dashboard'   → Dashboard home (stats, OT, Leave, Staff preview)
activeView = 'staff-list'  → <app-staff-list-inline>
activeView = 'add-staff'   → <app-add-staff-inline>
(future) activeView = 'department' | 'leave' | 'payroll' | 'holidays'
```

### File Locations
```
src/app/dashboard/
  admin-dashboard.ts     ← shell (activeView pattern)
  admin-dashboard.html   ← topbar + sidebar + inline component swap
  admin-dashboard.scss   ← empty

src/app/admin/           ← NEW folder ✅
  staff-list-inline.ts   ← search + filter + full table
  staff-list-inline.html
  add-staff-inline.ts    ← 3-section form + CV upload
  add-staff-inline.html
```

### Key Points
```typescript
// admin-dashboard.ts
activeView = 'dashboard';           // NOT activeNav
setView(key)                        // NOT setNav
closeToDashboard()                  // ← back to dashboard
onStaffCreated()                    // reload stats + go staff-list

// Announcements — DashboardDataService သုံး (interceptor handles auth)
this.dataService.getAnnouncements()
this.dataService.getNotifications()

// Multipart upload — getHeadersMultipart() မလို
// authInterceptor က FormData auto detect ပြီး Authorization ပဲ ထည့်
```

### UserResponse DTO (staff-list API response)
```
id, name, email, branchId, isActive,
roleId, roleName, roleDisplayName, roleColor,  ← user_roles join
departmentId, departmentName,                   ← departments join
cvAnalyzed,                                     ← member_profiles join
skills: string[]                                ← member_skills top 3
```

---

## 📐 Java Coding Standards

```java
// Always Lombok
@Data @NoArgsConstructor @AllArgsConstructor

// Java 11 — Text Blocks မသုံးရ ❌
// String concatenation သုံး ✅
@Query("SELECT o FROM OtRequest o " +
       "WHERE o.status = :status")

// Service pattern
@Service @Transactional

// Security: Eclipse IDE, Lombok v1.18.42
```

### Company Admin vs Branch Admin
```java
// AdminDashboardController
boolean isCompanyAdmin = admin.getBranchId() == null;
// Company Admin → all branches
// Branch Admin  → own branch only (subquery)
```

### Branch → Country
```java
// UserRepository @Query မသုံး
// BranchRepository.findById() သုံး
branchRepository.findById(admin.getBranchId())
    .map(Branch::getCountryId).orElse(null);
```

---

## 🖥️ Phase Status

```
✅ Phase 1   — Auth + JWT
✅ Phase 2   — Country + Branch + User Management
✅ Phase 3   — Project + Sprint + Task
✅ Phase 4   — Comment + Attachment + Notification + ActivityLog
✅ Phase 5   — Translation API
✅ Phase 6   — Chat API
✅ Phase 10  — PM Dashboard Angular UI ✅
✅ Phase 11  — Admin Dashboard (HR) — API + Angular UI ✅
⏳ Phase 7   — WebSocket Real-time
⏳ Phase 8   — API Docs + ERD
⏳ Phase 12  — AI Staff Assignment + CV Upload
⏳ Phase 13  — Boss Dashboard Angular UI
⏳ Phase 14  — Cloud Deploy + Presentation
```

---

## 🎯 Current Status (2026-03-20)

**DONE TODAY:**
- Admin Dashboard API (OtRequest, LeaveRequest, PublicHoliday) ✅
- Admin Dashboard Angular (member-dashboard pattern) ✅
- Department table + API ✅
- UserResponse DTO (role + dept + skills) ✅
- staff-list-inline component ✅
- add-staff-inline component (CV upload ready) ✅
- Announcement bar working ✅
- Java 11 Text Blocks fix ✅

**IN PROGRESS:**
- Add Staff page — UserRole API endpoint test
- CV Upload + AI Analyze

**NEXT STEPS:**
1. Add Staff — test လုပ် (UserRole list ထွက်မထွက်)
2. CV Upload Spring Boot service
3. Boss Dashboard Angular UI
4. CLAUDE.md GitHub push

---

## 📂 Key Output Files

```
/mnt/user-data/outputs/
├── admin-dashboard.ts / .html        ← Admin shell
├── staff-list-inline.ts / .html      ← Staff list
├── add-staff-inline.ts / .html       ← Add staff + CV
├── AdminDashboardController.java
├── OtRequest.java / LeaveRequest.java / PublicHoliday.java
├── OtRequestDto.java / LeaveRequestDto.java
├── OtRequestRepository.java / LeaveRequestRepository.java
├── PublicHolidayRepository.java
├── UserRepository.java               ← countByIsActive ထည့်ပြီ
├── UserDto.java                      ← UserResponse inner class
├── UserService.java                  ← getUsersByBranchAsResponse()
├── UserController.java               ← /staff-list endpoint
├── MemberSkill.java / MemberSkillRepository.java
├── Department.java / DepartmentRepository.java / DepartmentController.java
├── department_migration.sql          ← departments table + ALTER users
└── User.java                         ← departmentId field ထည့်ပြီ
```

---

*Last updated: 2026-03-20 | Brycen Cambodia Team*
