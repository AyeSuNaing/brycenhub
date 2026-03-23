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
| AI Model | `claude-haiku-4-5-20251001` (CV analyze, translation) |
| Backend Port | 8080 |
| Frontend Port | 4200 |

**CSS Architecture:**
- `styles.css` = global styles + CSS vars + animations
- Component `.scss` files = EMPTY (all styles in global `styles.css`)
- Theme = `body.dark { ... }` / `body.light { ... }`

---

## 📁 Project Path

```
/Users/brycen_cambodia_2/Documents/1ASNworkspace/welcome/
└── src/main/angular/frontend/
    ├── tailwind.config.js         ✅ EXISTS
    ├── angular.json
    └── src/
        ├── styles.css             ← Global (CSS vars + all styles)
        └── app/
            ├── models/            ← dashboard.models.ts
            ├── services/          ← auth.service, dashboard-data.service
            ├── shared/            ← announcement-bar, bell-notification, custom-select
            ├── dashboard/         ← admin-dashboard, member-dashboard, boss-dashboard
            ├── admin/             ← staff-list-inline, add-staff-inline, staff-profile-inline ✅
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

Badge colors stored in `user_roles.color` (hex):
BOSS=yellow | DIRECTOR=purple | ADMIN=pink | PM=green | LEADER=cyan | DEV=indigo | QA=orange

---

## 🗄️ DATABASE — Key Tables

### users
```sql
id, name, email UNIQUE, password(BCrypt),
role_id FK → user_roles,        ← NOT role STRING
branch_id FK → branches,
department_id FK → departments,
client_id FK → clients,
preferred_language(en/ja/my/vi/ko/km),
is_active(0/1), profile_image, phone,
last_seen DATETIME, created_at, updated_at
```

### user_roles
```sql
id, name, display_name, level INT, color VARCHAR(7)
-- name: BOSS|COUNTRY_DIRECTOR|ADMIN|PROJECT_MANAGER|LEADER|UI_UX|DEVELOPER|QA|CLIENT
```

### departments
```sql
id, branch_id FK, name VARCHAR(100), description,
created_by FK users, created_at
UNIQUE(branch_id, name)
-- Seed: Cambodia(3): Engineering(1), Admin(2), Content(3)
--       Japan(1):    Engineering(4), Management(5)
```

### ot_requests
```sql
id, user_id FK, work_date DATE, ot_hours DECIMAL,
day_type(WEEKDAY/SATURDAY/SUNDAY/HOLIDAY),
ot_rate(1.5/2.0), ot_amount, project_id FK,
reason, status(PENDING/APPROVED/REJECTED),
approved_by FK, approved_at, reject_reason, created_at
```

### leave_requests
```sql
id, user_id FK, leave_type(ANNUAL/SICK/UNPAID),
start_date DATE, end_date DATE, total_days INT,
reason, status(PENDING/APPROVED/REJECTED),
approved_by FK, approved_at, reject_reason, created_at
```

### public_holidays
```sql
id, country_id FK, name, holiday_date DATE, description, created_at
```

### member_profiles (1:1 with users)
```sql
id, user_id UNIQUE FK CASCADE,
experience_years INT,
experience_detail TEXT,       -- original language
experience_detail_en TEXT,    -- EN standard (AI search + translation source)
projects_json TEXT,           -- JSON array: [{title,description,techStack,duration,role}]
education TEXT,               -- original language
education_en TEXT,            -- EN standard
cv_file_url VARCHAR(500),
cv_analyzed TINYINT(1) DEFAULT 0,
cv_original_language VARCHAR(5),
input_type ENUM(CV/MANUAL/BOTH),
analyzed_at, created_at, updated_at
FULLTEXT INDEX (education_en, experience_detail_en)
```

### member_profile_translations (on-demand cache)
```sql
id, user_id FK CASCADE,
language_code VARCHAR(5),     -- en/ja/my/km/vi/ko
education TEXT,               -- translated from education_en
experience_detail TEXT,       -- translated from experience_detail_en
projects_json TEXT,           -- translated projects JSON (title+desc only)
created_at
UNIQUE(user_id, language_code)
```

### member_skills (1:N with users)
```sql
id, user_id FK CASCADE,
skill_name VARCHAR(100),      -- original language (ja: iOSエンジニア)
skill_name_en VARCHAR(100),   -- EN standard (AI query: iOS (Swift))
skill_level ENUM(BEGINNER/MID/SENIOR) NULL,
input_type ENUM(CV/MANUAL),
created_at
INDEX (skill_name_en)
```

### member_skill_translations (on-demand cache)
```sql
id, skill_id FK CASCADE,
language_code VARCHAR(5),
skill_name VARCHAR(200),      -- translated skill name
created_at
UNIQUE(skill_id, language_code)
```

---

## 🌐 Translation Flow

### Strategy: On-demand + Cache
```
User views profile (preferredLanguage = 'ja')
        ↓
GET /api/users/{id}/full-profile?lang=ja
        ↓
UserService.getFullProfile(id)
  → EN data: education_en, experience_detail_en, projects_json, skill_name_en
        ↓
ProfileTranslationService.applyTranslation(dto, 'ja')
        ↓
SELECT * FROM member_profile_translations
  WHERE user_id=X AND language_code='ja'
        ↓
    Cache HIT?  → overwrite dto fields with cached ja ✅ (fast)
    Cache MISS? → TranslationProvider.translate(EN → ja)
                    education_en          → ja ✅
                    experience_detail_en  → ja ✅
                    projects[].title      → ja ✅
                    projects[].description → ja ✅
                    projects[].techStack   → EN ← technical, မပြောင်း
                    projects[].role        → EN ← job title, မပြောင်း
                    projects[].duration    → EN ← date, မပြောင်း
                → INSERT INTO member_profile_translations (cache)
                → Return translated dto ✅
```

### Translation Tables Summary
```
Content               Source column          Cache table / column
────────────────────────────────────────────────────────────────
Education             education_en           member_profile_translations.education
Experience            experience_detail_en   member_profile_translations.experience_detail
CV Projects           projects_json          member_profile_translations.projects_json
Skills                skill_name_en          member_skill_translations.skill_name
Tasks                 title / description    task_translations
Comments              content                comment_translations
Projects (PM)         title / description    project_translations
```

### Supported Languages
```
en → source (no translate needed)
ja → Japanese
my → Myanmar / Burmese
km → Khmer / Cambodian
vi → Vietnamese
ko → Korean
```

### TranslationProvider (interface pattern)
```java
// Config: application.properties → translation.provider=mock|deepl|claude
// Implementations: MockTranslationProvider, DeepLTranslationProvider
String translate(String text, String sourceLang, String targetLang)
String getProviderName()
```

---

## 🔗 API Endpoints

Base URL: `http://localhost:8080/api`
All protected: `Authorization: Bearer {token}`

### Auth
```
POST /api/auth/login
  Body: { email, password }
  Response: { token, userId, name, email, role, branchId, preferredLanguage }
GET  /api/auth/me
PUT  /api/auth/language    Body: { language }
```

### Users
```
GET    /api/users/staff-list              -- role+dept+skills (UserResponse DTO)
GET    /api/users/{id}/full-profile?lang= -- ALL: basic+cv+skills+projects (translated)
GET    /api/users/check-email?email=      -- duplicate check (blur event)
POST   /api/users                         -- create staff
PUT    /api/users/{id}/activate
PUT    /api/users/{id}/deactivate
```

### CV
```
POST   /api/cv/analyze       -- PDF → Claude AI → JSON preview
POST   /api/cv/upload        -- save file + update member_profiles (projects_json included)
POST   /api/member-skills/bulk  -- save skills { userId, skills[] }
```

### Departments
```
GET  /api/departments/my-branch
GET  /api/departments/by-branch/{branchId}
POST /api/departments
PUT  /api/departments/{id}
DELETE /api/departments/{id}
```

### User Roles
```
GET  /api/user-roles    -- CLIENT ဖြုတ်ပြီး list ပြ
```

### Translations
```
GET  /api/translations/task/{taskId}?lang=
GET  /api/translations/comment/{commentId}?lang=
```

### Admin Dashboard
```
GET   /api/admin/dashboard/stats
GET   /api/admin/dashboard/ot-requests?status=PENDING
GET   /api/admin/dashboard/leave-requests?status=PENDING
GET   /api/admin/dashboard/today-leave
GET   /api/admin/dashboard/holidays?year=&month=
PATCH /api/admin/dashboard/ot-requests/{id}/approve
PATCH /api/admin/dashboard/ot-requests/{id}/reject
PATCH /api/admin/dashboard/leave-requests/{id}/approve
PATCH /api/admin/dashboard/leave-requests/{id}/reject
```

### Chat
```
POST /api/chat/send    Body: { channelType, channelId?, content }
GET  /api/chat/global | /country/{id} | /project/{id} | /direct/{userId}
```

---

## 📢 Announcement Logic

```
DB: announcements.target_scope = GLOBAL | BRANCH | PROJECT
Filter rule:
  GLOBAL           → user အားလုံး မြင်ရ
  BRANCH target=X  → branchId=X user မြင်ရ
  PROJECT target=Y → Y project member မြင်ရ

Angular: DashboardDataService.getAnnouncements()
  → <app-announcement-bar [announcements]="announcements">
```

---

## 🖥️ Admin Dashboard — Angular

### activeView Pattern
```
'dashboard'     → AdminDashboard home (stats, OT, Leave, staff preview)
'staff-list'    → StaffListInline   (row click → staff-profile)
'add-staff'     → AddStaffInline    (4-step form + CV upload)
'staff-profile' → StaffProfileInline (full profile)
```

### StaffProfileInline
- `GET /api/users/{id}/full-profile?lang={userLang}`
- Sections: Basic Info | Login Credentials | CV Info | Skills | CV Projects | Social Links | Danger Zone
- Skills grouped by level: SENIOR(purple) | MID(blue) | BEGINNER(green)
- CV Projects: title+desc translated, techStack/role/duration = EN

### AddStaffInline (4-step)
```
Step 1: Basic Info  (name, email, password, roleId, dept, phone+country)
Step 2: CV Upload   → AI Analyze → Preview
Step 3: Skills      (manual add + import from CV)
Step 4: Preview & Submit
```
- Email blur → `GET /api/users/check-email?email=` (real-time duplicate check)
- Phone: country prefix selector (KH +855 / MM +95 / JP +81 / VN +84 / KR +82 / US +1)
- Submit flow: `POST /api/users` → `POST /api/cv/upload` → `POST /api/member-skills/bulk`

### UserDto.CreateUserRequest (IMPORTANT)
```java
// ✅ role String ဖြုတ်ပြီ — DB မှာ role column မရှိ
@NotNull Long roleId;     // required
Long branchId;            // optional (@NotNull မပါ — DB NULL allowed)
Long departmentId;        // optional
```

### UserService.createUser() (IMPORTANT)
```java
user.setDepartmentId(request.getDepartmentId());  // ← မမေ့ပါနဲ့!
// မထည့်ရင် department column NULL ဖြစ်မယ်
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
boolean isCompanyAdmin = admin.getBranchId() == null;
// Company Admin → all branches
// Branch Admin  → own branch only
```

### Branch → Country
```java
branchRepository.findById(admin.getBranchId())
    .map(Branch::getCountryId).orElse(null);
```

---

## ⚙️ application.properties

```properties
spring.datasource.url=jdbc:mysql://localhost:3306/asn_db
spring.datasource.username=root
spring.datasource.password=
spring.jpa.hibernate.ddl-auto=none
server.port=8080
translation.provider=mock
jwt.secret=brycen-secret-key-2026
anthropic.api.key=YOUR_KEY_HERE
cv.upload.path=uploads/cv/
```

---

## 🌐 Angular Routes

```
/login
/dashboard/boss
/dashboard/admin    ← DONE ✅
/dashboard/member   ← PM + LEADER ✅
/projects
/kanban/:projectId
/chat
```

---

## 🖥️ Phase Status

```
✅ Phase 1   — Auth + JWT
✅ Phase 2   — Country + Branch + User Management
✅ Phase 3   — Project + Sprint + Task
✅ Phase 4   — Comment + Attachment + Notification + ActivityLog
✅ Phase 5   — Translation API (TranslationProvider interface)
✅ Phase 6   — Chat API
✅ Phase 10  — PM Dashboard Angular UI ✅
✅ Phase 11  — Admin Dashboard (HR) — API + Angular UI ✅
✅ Phase 12  — CV Upload + AI Analyze + Staff Profile ✅
⏳ Phase 7   — WebSocket Real-time
⏳ Phase 8   — API Docs + ERD
⏳ Phase 13  — Boss Dashboard Angular UI
⏳ Phase 14  — Cloud Deploy + Presentation
```

---

## 🎯 Current Status (2026-03-22)

**DONE:**
- Admin Dashboard — Stats, OT/Leave requests, Staff list ✅
- Staff List — search, filter, row click → profile ✅
- Add Staff — 4-step form, CV upload, AI analyze, skills ✅
- Staff Profile — all data (basic+cv+skills+projects) ✅
- Email duplicate check (real-time blur) ✅
- Phone country selector (6 countries) ✅
- CV Projects → projects_json DB save ✅
- Translation Flow — EN → ja/my/km/vi/ko (on-demand + cache) ✅
  - ProfileTranslationService ✅
  - member_profile_translations.projects_json column ✅
- UserDto — role String ဖြုတ်ပြီ, @NotNull roleId ✅
- departmentId save fix ✅

**NEXT STEPS:**
1. Test full flow end-to-end (Add Staff → CV → Profile → Translation)
2. Boss Dashboard Angular UI (Phase 13)
3. WebSocket Real-time (Phase 7)
4. CLAUDE.md GitHub push

---

## 📂 Key Output Files

```
/mnt/user-data/outputs/
├── CLAUDE.md                              ← THIS FILE (2026-03-22)
│
├── Java — Models
│   ├── User.java                          ← departmentId field
│   ├── MemberProfile.java                 ← projectsJson field
│   ├── MemberProfileTranslation.java      ← NEW ✅
│   ├── MemberSkill.java
│   └── Department.java
│
├── Java — Repositories
│   ├── UserRepository.java
│   ├── MemberProfileRepository.java
│   ├── MemberProfileTranslationRepository.java  ← NEW ✅
│   └── MemberSkillRepository.java
│
├── Java — Services
│   ├── UserService.java                   ← getFullProfile(), existsByEmail()
│   ├── UserFullProfileService.java        ← getFullProfile() method snippet
│   ├── ProfileTranslationService.java     ← NEW ✅ on-demand translate+cache
│   └── CvService.java                     ← analyzeCv() + recoverTruncatedJson()
│
├── Java — Controllers
│   ├── UserController.java                ← /check-email, /full-profile?lang=
│   ├── UserFullProfileController.java     ← endpoint snippet
│   ├── CvController.java                  ← /analyze, /upload
│   ├── AdminDashboardController.java
│   └── DepartmentController.java
│
├── Java — DTOs
│   ├── UserDto.java                       ← role ဖြုတ်ပြီ, @NotNull roleId
│   ├── UserFullProfileDto.java            ← projectsJson field
│   └── CvDto.java                         ← ProjectItem, SkillItem, SocialLinks
│
├── Angular
│   ├── admin-dashboard.ts / .html         ← shell (activeView pattern)
│   ├── staff-list-inline.ts / .html       ← search + filter + row click
│   ├── add-staff-inline.ts / .html        ← 4-step form
│   ├── staff-profile-inline.ts / .html    ← full profile + translation
│   └── styles.css                         ← global + CSS vars + @keyframes
│
└── SQL Migrations
    ├── department_migration.sql            ← departments table
    ├── add_projects_json.sql               ← ALTER member_profiles
    └── add_projects_json_translation.sql   ← ALTER member_profile_translations
```

---

*Last updated: 2026-03-22 | Brycen Cambodia Team*