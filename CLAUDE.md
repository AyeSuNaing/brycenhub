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

# BRYCEN HUB PMS — CLAUDE.md
# Brycen AI Development Contest 2026
# ⚠️ READ THIS FIRST IN EVERY NEW CHAT

---

## 🚨 HOW TO START A NEW CHAT

### Step 1 — GitHub Latest Code Sync (အရေးကြီး!)
Claude.ai Project sidebar မှာ:
> **Files section** → **AyeSuNaing/brycenhub** card → **🔄 (Refresh) button နှိပ်ပါ**

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
| AI Model | `claude-sonnet-4-20250514` |
| Backend Port | 8080 |
| Frontend Port | 4200 |

---

## 📁 Project Path

```
/Users/brycen_cambodia_2/Documents/1ASNworkspace/welcome/
└── src/main/angular/frontend/
    ├── angular.json
    └── src/
        ├── styles.css
        └── app/
            ├── design/         ← BrycenDesign Tool
            ├── dashboard/
            ├── projects/
            ├── kanban/
            └── chat/
```

---

## 🎨 BrycenDesign Tool — CURRENT STATUS (2026-04-01)

### Architecture — 3 File Approach

Role ပေါ်မူတည်ပြီး iframe src ပြောင်းမယ်:

```typescript
// design-tool.ts မှာ
const iframePath =
  designMode === 'edit'    ? '/design-edit.html'    :
  designMode === 'present' ? '/design-present.html' :
                              '/design-dev.html';
```

| File | Location | Role |
|------|----------|------|
| `design-edit.html` | `public/` | UI_UX, PROJECT_MANAGER, LEADER |
| `design-dev.html` | `public/` | Developer (view/inspect only) |
| `design-present.html` | `public/` | CLIENT |

### Angular Files (src/app/design/)

| File | Purpose |
|------|---------|
| `design-tool.ts` | iframe wrapper, postMessage bridge, role detect |
| `design-tool.html` | Angular topbar + iframe body |
| `design-tool.scss` | Angular wrapper styles |

### design-tool.ts Key Logic

```typescript
// Role → mode
EDIT_ROLES = ['UI_UX', 'PROJECT_MANAGER', 'LEADER']
// role in EDIT_ROLES → 'edit' → design-edit.html
// role === 'CLIENT'  → 'present' → design-present.html
// others             → 'view'   → design-dev.html

// postMessage bridge
window.addEventListener('message', (e) => {
  DESIGN_READY      → hide loading, send DESIGN_SET_MODE
  DESIGN_SAVE       → POST /api/designs/save
  DESIGN_REQUEST_SAVE → trigger save
})
sendToIframe({ type: 'DESIGN_LOAD', canvasData })
sendToIframe({ type: 'DESIGN_CMD', cmd: 'undo'|'redo' })
```

### Backend API

```
GET  /api/designs/by-project/{projectId}
POST /api/designs/save
Body: { projectId, canvasData, updatedBy, thumbnailUrl }
Table: design_boards (MySQL asn_db)
```

---

## 🖌️ design-edit.html — Edit Mode

**Features:**
- Left Panel: Components library + Layers tree
- Canvas: drag/drop, resize, pan/zoom
- Right Panel: Properties (Attributes/Size tabs) + Color picker + Spacing

**Components supported:**
Rectangle, Circle, Text, Label, Button, Input, Dropdown, Checkbox,
Toggle, DatePicker, Image, Icon, Navbar, Sidebar, Tabs, Badge,
Alert, Progress, Spinner, Table, Divider

**Key functions:**
```javascript
addC(type, x, y, frameId)   // add component
selComp(id)                  // select component
fillProps(c)                 // fill right panel
save()                       // → postMessage DESIGN_SAVE
restoreSnap(framesData)      // load canvas from JSON
```

---

## 🔍 design-dev.html — Developer Mode

### Layout
```
[LP 248px — Layers only] [Canvas] [RP 272px — Dev Inspector]
```

### Right Panel Tabs
```
DEV INSPECTOR (default) | PROPERTIES
```

### Dev Inspector Tab
- CSS output (position, size, colors, typography)
- Angular Template
- JSON data
- **✦ Generate Code button** → opens AI Code Generator popup

### Properties Tab
- Attributes: Fill color + Copy, Stroke + Copy, Appearance, Typography + Copy
- Size: X, Y, W, H, Rotation, Margin, Padding

### Frame Select Behavior
- Frame click → unselect all components
- Frame info ပြ (name, size, bg, components list)
- Dev Inspector tab မှာ frame CSS/Angular/JSON ပြ

---

## ✦ AI Code Generator Popup

### Trigger
Dev Inspector → **✦ Generate Code** button click

### Frame Size Auto-detect
```javascript
frame.w <= 520  → 📱 Mobile categories
frame.w > 520   → 🖥 Desktop categories
```

### Flow
```
1. Popup open → Claude API call #1
   → "latest stable frameworks for mobile/desktop" → JSON
   → Dynamic list render (NOT hardcoded)

2. User selects framework + types extra instructions

3. ✦ Generate button → Claude API call #2
   → frame data (components, colors, sizes) + selected lang + prompt
   → Returns: { files: [{name, content}], summary }

4. File tabs ပြ → code preview → Copy / Download
```

### Popup UI
- Size: 95vw × 90vh (ကြီးကြီး)
- Left: Dynamic framework list + Extra instructions textarea + Generate button
- Right: File tabs (filename.ext) + Code preview + Copy + Download

### Mobile Categories (AI generated, dynamic)
```
Native:         SwiftUI, Android Java, Android Kotlin
Cross-platform: Flutter, React Native, Ionic, Xamarin, ...
```

### Desktop Categories (AI generated, dynamic)
```
Frontend:  Angular, React, Vue, HTML+CSS, ...
Backend:   Java Spring Boot, Node.js, Python, PHP, ...
Database:  MySQL, PostgreSQL, MongoDB, ...
Full Stack: Frontend + Backend + DB တစ်ခါတည်း
```

### ⚠️ CORS Issue (PENDING FIX)
iframe ထဲကနေ Anthropic API direct call → "Network error: Failed to fetch"

**Fix plan:** Angular design-tool.ts ကနေ postMessage proxy:
```
iframe → postMessage(AI_REQUEST) → Angular
Angular → HttpClient → Spring Boot /api/ai/generate
Spring Boot → Anthropic API → response
Spring Boot → Angular → postMessage(AI_RESPONSE) → iframe
```

---

## 🖥️ design-present.html — Present Mode

- Frame render only (no panels, no interaction)
- Client view — read only
- Components render with exact design

---

## 📌 Scroll Fix (design-dev.html)

```javascript
// dscroll direct wheel handler — canvas onWheel を bypass
dscroll.addEventListener('wheel', function(e) {
  e.stopPropagation();
  e.stopImmediatePropagation();
  this.scrollTop += e.deltaY;
  e.preventDefault();
}, { passive: false, capture: true });
```

---

## 🎯 Current Status (2026-04-01)

### ✅ DONE
- design-edit.html — full edit mode working
- design-dev.html — dev inspector + properties + scroll
- design-present.html — present mode
- design-tool.ts — role-based iframe routing
- Frame select → unselect components
- Tab order: DEV INSPECTOR | PROPERTIES
- AI Code Generator popup UI (CORS fix pending)
- Properties: Attributes/Size tabs with copy buttons

### ⏳ PENDING
1. **CORS fix** — AI API call via Spring Boot proxy
2. **Boss Dashboard** — Angular UI
3. **Kanban Board** — pending
4. **WebSocket Real-time** — pending

---

## ⚙️ application.properties

```properties
spring.datasource.url=jdbc:mysql://localhost:3306/asn_db
spring.datasource.username=root
spring.datasource.password=
spring.jpa.hibernate.ddl-auto=none
server.port=8080
jwt.secret=brycen-secret-key-2026
anthropic.api.key=YOUR_KEY_HERE
```

---

## 🌐 Angular Routes

```
/login
/dashboard/boss
/dashboard/admin
/dashboard/member
/projects
/design/:projectId    ← BrycenDesign Tool
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
✅ Phase 5   — Translation API
✅ Phase 6   — Chat API
✅ Phase 10  — PM Dashboard Angular UI
✅ Phase 11  — Admin Dashboard (HR)
✅ Phase 12  — BrycenDesign Tool (Edit + Dev + Present modes)
⏳ Phase 7   — WebSocket Real-time
⏳ Phase 8   — API Docs + ERD
⏳ Phase 9   — Boss Dashboard
⏳ Phase 13  — Cloud Deploy + Presentation
⏳ Phase 14  — Video Call + Meeting Summary
```

# CV UPLOAD + ADMIN MODULE — DB Decisions
# Date: 2026-03-19
# ⚠️ နောက် session မှာ project knowledge ထဲ upload ထည့်ပါ

---

## 🗄️ CV Upload Tables (4 ခု)

### 1. `member_profiles` — users 1:1
```sql
id
user_id              UNIQUE FK users
experience_years     INT
experience_detail    TEXT          -- original language
experience_detail_en TEXT          -- EN standard (AI search)
education            TEXT          -- original language
education_en         TEXT          -- EN standard (AI search)
cv_file_url          VARCHAR(500)
cv_analyzed          TINYINT(1) DEFAULT 0
cv_original_language VARCHAR(5)    -- Claude detect: en/ja/my/km/vi/ko
input_type           ENUM(CV/MANUAL/BOTH)
analyzed_at          DATETIME
FULLTEXT INDEX (education_en, experience_detail_en)
```

### 2. `member_profile_translations` — cache (task_translations pattern)
```sql
id
user_id           FK users CASCADE
language_code     VARCHAR(5)    -- en/ja/my/km/vi/ko
education         TEXT          -- translated
experience_detail TEXT          -- translated
UNIQUE(user_id, language_code)
```

### 3. `member_skills` — users 1:N
```sql
id
user_id         FK users CASCADE
skill_name      VARCHAR(100)  -- original language (ja: iOSエンジニア)
skill_name_en   VARCHAR(100)  -- EN standard (AI query: iOS (Swift))
skill_level     ENUM(BEGINNER/MID/SENIOR) NULL  -- blank OK
input_type      ENUM(CV/MANUAL)
INDEX (skill_name_en)  -- AI query index
```

### 4. `member_skill_translations` — cache (task_translations pattern)
```sql
id
skill_id      FK member_skills CASCADE
language_code VARCHAR(5)     -- en/ja/my/km/vi/ko
skill_name    VARCHAR(200)   -- translated skill name
UNIQUE(skill_id, language_code)
```

---

## 📋 Key Design Decisions

### Skills
| Column | Purpose |
|---|---|
| `skill_name` | Original language (CV ထဲ detect လုပ်တာ) |
| `skill_name_en` | EN standard — AI suggest query |
| `member_skill_translations` | Display cache per language |

### Education / Experience
| Column | Purpose |
|---|---|
| `education` | Original language |
| `education_en` | EN standard — AI search |
| `experience_detail` | Original language |
| `experience_detail_en` | EN standard — AI search |
| `member_profile_translations` | Display cache per language |

### Translation Strategy
- **On-demand + Cache (Option B)**
- User ကြည့်မှ translate လုပ်
- Translate ပြီးရင် DB cache သိမ်း
- နောက်တစ်ကြိမ် cache hit → fast

### CV Upload Flow
```
Admin → CV Upload (PDF, any language)
         ↓
    Spring Boot → save file → /uploads/cv/
         ↓
    Claude API analyze:
      - detect language → cv_original_language
      - extract skills  → skill_name (original) + skill_name_en (EN)
      - extract edu     → education (original) + education_en (EN)
      - extract exp     → experience_detail (orig) + experience_detail_en (EN)
         ↓
    Preview show (Admin စစ်ကြည့်):
      - Skills list (editable)
      - Education (editable)
      - Experience (editable)
      - skill_level blank ဆိုရင် Admin manually ဖြည့်
         ↓
    Admin confirm / edit
         ↓
    DB save:
      - member_profiles
      - member_skills (per skill row)
      - member_profile_translations မသိမ်းသေးဘူး (on-demand)
      - member_skill_translations မသိမ်းသေးဘူး (on-demand)
```

### Translation On-demand Flow
```
User ကြည့် (preferredLanguage='my')
         ↓
member_skill_translations WHERE skill_id=X AND language_code='my'
         ↓
Cache hit?  → return cached ✅
Cache miss? → Claude translate (skill_name_en → my)
           → save to member_skill_translations
           → return translated
```

### AI Suggest Flow (New Project)
```
PM → project description type
   → "Suggest Team" button
   → Spring Boot → Claude API
   → Claude reads:
       member_skills.skill_name_en    (language-agnostic)
       member_profiles.education_en   (language-agnostic)
       member_profiles.experience_detail_en
   → Returns best match members
   → PM confirm / adjust
```

---

## 🗄️ Admin Module Tables (8 ခု) — admin-migration.sql

| Table | Purpose |
|---|---|
| `member_profiles` | CV, exp, edu |
| `member_skills` | Skills per row |
| `salary_structures` | Base salary history (append-only) |
| `attendance_logs` | Fingerprint in/out |
| `ot_requests` | OT request + approve |
| `salary_history` | Monthly payroll |
| `public_holidays` | Holiday calendar |
| `tax_brackets` | Country tax tiers |

### Salary Key Decisions
- Working days: Mon~Fri only (Sat/Sun ပိတ်)
- OT Rate: Mon~Fri/Sat = ×1.5 | Sun/Holiday = ×2.0
- Salary cycle: 25th ~ 24th next month
- Pay date: 25th
- Formula: `net = (base/working_days × actual_days) + OT - deductions - tax`
- Tax: Progressive (tax_brackets table) — Country Director + Admin manage
- `salary_structures` currency မသိမ်း → users→branches→countries.currency join
- `salary_history` currency သိမ်း (historical record မပျက်အောင်)
- Status flow: DRAFT → HR_REVIEWED → CONFIRMED → PAID

### Countries Table Update
```sql
ALTER TABLE countries ADD COLUMN currency VARCHAR(10);
-- JP=JPY, MM=MMK, KH=KHR, VN=VND, KR=KRW, US=USD
```

---

## 📋 Admin Dashboard Layout (Confirmed)

```
ROW 1 — Stats (Total Staff | OT/hrs | Leave/Today | Payroll)
ROW 2 — March Holidays | Quick Actions | Today on Leave (equal width)
ROW 3 — OT Requests (full width, table view)
ROW 4 — Leave Requests (full width, table view)
ROW 5 — Staff List (full width, table view)
```

### Leave Request Fields
- leave_type: ANNUAL / SICK / UNPAID
- start_date, end_date, total_days
- reason (required)
- status: PENDING → APPROVED / REJECTED

### OT Request Fields
- work_date, ot_hours, day_type, ot_rate
- project_id (ဘယ် project မှာ OT လဲ ပြမယ်)
- reason
- status: PENDING → APPROVED / REJECTED

---

## 📁 Migration Files
```
/mnt/user-data/outputs/admin-migration.sql     ← admin module (8 tables)
/mnt/user-data/outputs/cv_upload_tables.sql    ← CV upload (4 tables)
```

---

## ⏳ TODO (Next Sessions)

- [ ] Spring Boot — OT Request Model/Service/Controller
- [ ] Spring Boot — Leave Request Model/Service/Controller
- [ ] Spring Boot — Public Holiday Controller
- [ ] Spring Boot — MemberProfile + CV Upload + Claude analyze
- [ ] Spring Boot — MemberSkill + Translation on-demand
- [ ] Angular — Add Staff page (Basic Info + CV Upload + Skills)
- [ ] Angular — CV Preview + Confirm flow
- [ ] Angular — OT/Leave management pages

---
*Last updated: 2026-03-19 | Brycen Cambodia Team*

# ADMIN MODULE — DB Decisions (2026-03-18)
# ⚠️ နောက် session မှာ ဒီဖိုင်ကို CLAUDE.md ထဲ ထည့်ပါ

---

## 🗄️ New Tables (8 ခု) — admin-migration.sql

| Table | Purpose |
|---|---|
| `member_profiles` | CV, exp, edu — users 1:1 |
| `member_skills` | Skills per row — users 1:N |
| `salary_structures` | Base salary history (append-only) |
| `attendance_logs` | Fingerprint Excel in/out |
| `ot_requests` | OT request + approve flow |
| `salary_history` | Monthly payroll record |
| `public_holidays` | Country holiday calendar |
| `tax_brackets` | Country progressive tax tiers |

---

## 📋 Key Design Decisions

### member_profiles
- `users` table နဲ့ 1:1 (UNIQUE user_id)
- `input_type` ENUM('CV','MANUAL','BOTH')
- `cv_analyzed` TINYINT(1) — Claude analyze ပြီးပြီ flag

### member_skills
- `skill_level` ENUM('BEGINNER','MID','SENIOR') **NULL allowed** ✅
- CV ကနေ level မပါရင် blank ထားမယ် — Admin manually ဖြည့်
- `input_type` ENUM('CV','MANUAL')
- AI suggest query: `WHERE skill_name = 'iOS'`

### salary_structures
- **append-only** — update မလုပ်ဘူး
- `effective_date` နဲ့ latest salary ရှာ
- `active` flag မလို — `effective_date DESC LIMIT 1` သုံး
- **currency မသိမ်း** — `users → branches → countries.currency` join
- `note` VARCHAR(500) — "Promotion", "Annual raise" မှတ်

### attendance_logs
- `UNIQUE(user_id, work_date)` ✅
- `time_out NULL` = Not check out
- `is_dayoff = true` = Full day off / Weekend
- `source` ENUM('FINGERPRINT','MANUAL')

### ot_requests
- Staff က OT လုပ်ပြီး **နောက်နေ့** တင်မယ်
- Admin approve မှ `ot_amount` calculate
- `day_type` ENUM('WEEKDAY','SATURDAY','SUNDAY','HOLIDAY')
- OT Rate: WEEKDAY/SAT = 1.5, SUNDAY/HOLIDAY = 2.0

### salary_history
- `pay_period` VARCHAR(7) — "2026-03"
- `period_start` DATE — 2026-02-25 (25th prev month)
- `period_end` DATE — 2026-03-24 (24th this month)
- `currency` VARCHAR(10) သိမ်း ✅ (historical record မပျက်အောင်)
- Status: `DRAFT → HR_REVIEWED → CONFIRMED → PAID`
- `UNIQUE(user_id, pay_period)`

### public_holidays
- `UNIQUE(country_id, holiday_date)`
- Country Director + Admin manage

### tax_brackets
- Progressive tax (tier ခွဲ)
- `max_salary NULL` = highest bracket (unlimited)
- Country Director + Admin manage

---

## 💰 Salary Cycle
```
25th (this month) ~ 24th (next month) = 1 pay period
24th evening = Admin finalize
25th = Salary paid
```

## 💰 OT Rates
```
Mon ~ Fri  = × 1.5
Saturday   = × 1.5
Sunday     = × 2.0
Holiday    = × 2.0
```

## 💰 Salary Formula
```
working_days   = Mon~Fri count in period - public holidays
daily_rate     = base_salary ÷ working_days
actual_salary  = daily_rate × actual_days_worked
net_before_tax = actual_salary + ot_amount - deductions
tax            = progressive calculate from tax_brackets
net_salary     = net_before_tax - tax
```

## 🔄 Countries Table Update
```sql
-- currency column ထည့်ပြီး
ALTER TABLE countries ADD COLUMN currency VARCHAR(10);
-- JP=JPY, MM=MMK, KH=KHR, VN=VND, KR=KRW, US=USD
```

---

## 🤖 AI Features (Discussed)

### CV Analysis Flow
```
Admin → CV Upload (PDF)
      → Claude API analyze
      → Preview (skills, edu, exp)
      → Admin confirm / edit
      → DB save (member_profiles + member_skills)
```

### Smart Team Suggest Flow
```
PM → New Project description
   → "Suggest Team" button
   → Spring Boot → Claude API
   → Claude reads member_skills
   → Returns best match members
   → PM confirm / adjust
```

### Claude API
- Model: `claude-haiku-4-5-20251001` (fast + cheap)
- Key: stored in `application.properties`
- Translation: DeepL ဖြုတ်ပြီး Claude တစ်ခုတည်း ✅
- Supported languages: EN / JP / MY / KH / VN / KO ✅

---

## 📁 Migration File
```
/mnt/user-data/outputs/admin-migration.sql
Run after: asn_final_schema.sql
```

---

## ⏳ Admin Dashboard — TODO
- [ ] Staff List + CV Upload UI (Angular)
- [ ] Monthly Payroll Wizard (4 steps)
- [ ] AI Team Suggest integration
- [ ] Tax Brackets management UI
- [ ] Public Holidays UI
- [ ] Announcement create


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
Latest: `2026-03-10-04-24-15-brycen-hub-pms-angular-dev.txt`

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
            ├── dashboard/         ← pm-dashboard, boss-dashboard, dev-dashboard
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

## 🗄️ DATABASE — Full Schema (24 Tables)

### 1. countries
```sql
id, name, code(JP/MM/KH/VN/KR/US), flag_emoji, created_at
-- Data: JP(1), MM(2), KH(3), VN(4), KR(5), US(6)
```

### 2. branches
```sql
id, country_id FK, name, address, created_at
-- Data: Japan HQ(1), Myanmar(2), Cambodia(3), Vietnam(4), Korea(5), USA(6)
```

### 3. users
```sql
id, name, email UNIQUE, password(BCrypt), role, branch_id FK,
preferred_language(en/ja/my/vi/ko/km), is_active(0/1),
profile_image, phone, created_at, updated_at
-- Roles: BOSS|COUNTRY_DIRECTOR|ADMIN|PROJECT_MANAGER|LEADER|UI_UX|DEVELOPER|QA|CUSTOMER
-- Default: admin@asn.com / password → BOSS
```

### 4. director_countries (many-to-many)
```sql
id, director_id FK users, country_id FK countries,
assigned_at, assigned_by FK users
UNIQUE(director_id, country_id)
```

### 5. projects
```sql
id, title, description, status(PLANNING/ACTIVE/ON_HOLD/COMPLETED/CANCELLED),
pm_id FK users, branch_id FK branches,
start_date DATE, end_date DATE, budget DECIMAL(15,2),
progress INT(0-100), created_by FK users, created_at, updated_at
```

### 6. project_members
```sql
id, project_id FK CASCADE, user_id FK,
role_in_project(PROJECT_MANAGER/LEADER/UI_UX/DEVELOPER/QA/CUSTOMER),
status(ACTIVE/INACTIVE/REMOVED), joined_at, removed_at
```

### 7. sprints
```sql
id, project_id FK CASCADE, name, start_date DATE, end_date DATE,
status(PLANNED/ACTIVE/COMPLETED), created_at
```

### 8. tasks
```sql
id, project_id FK CASCADE, sprint_id FK, parent_task_id FK(subtask),
title, description, original_language(en),
status(TODO/IN_PROGRESS/IN_REVIEW/DONE/DELAYED/PENDING_APPROVAL),
priority(LOW/MEDIUM/HIGH/CRITICAL),
label VARCHAR(200) -- comma separated "bug,feature,urgent"
assignee_id FK users, reporter_id FK users,
due_date DATE, estimated_hours DECIMAL(6,2), actual_hours DECIMAL(6,2),
position INT, created_at, updated_at
-- ⚠️ Java field: assigneeId → assignee_id, reporterId → reporter_id
```

### 9. task_translations
```sql
id, task_id FK CASCADE, language_code(en/ja/my/vi/ko/km),
translated_title, translated_description, created_at
UNIQUE(task_id, language_code)
```

### 10. task_confirmations
```sql
id, task_id FK CASCADE, customer_id FK users,
status(PENDING/APPROVED/REJECTED), feedback TEXT, confirmed_at, created_at
```

### 11. comments
```sql
id, task_id FK CASCADE, user_id FK, content TEXT,
original_language(en), created_at, updated_at
```

### 12. comment_translations
```sql
id, comment_id FK CASCADE, language_code,
translated_content TEXT, created_at
UNIQUE(comment_id, language_code)
```

### 13. attachments
```sql
id, task_id FK, comment_id FK, uploaded_by FK users,
file_name, file_url, file_type(image/video/document),
file_size BIGINT(bytes), created_at
```

### 14. design_boards
```sql
id, project_id FK UNIQUE, canvas_data LONGTEXT(Fabric.js JSON),
thumbnail_url, version INT, updated_by FK users, updated_at
```

### 15. design_board_history
```sql
id, design_board_id FK CASCADE, version INT, canvas_data LONGTEXT,
thumbnail_url, save_note, saved_by FK users, saved_at
```

### 16. db_designs
```sql
id, project_id FK CASCADE, title, file_url, uploaded_by FK users, created_at
```

### 17. api_docs
```sql
id, project_id FK UNIQUE, title, description, version(1.0),
base_url, created_by FK users, created_at, updated_at
```

### 18. api_endpoints
```sql
id, api_doc_id FK CASCADE, group_name, title, method(GET/POST/PUT/DELETE/PATCH),
url, description, headers JSON, request_body JSON, request_example TEXT,
response_body JSON, response_example TEXT, status_codes JSON,
auth_required TINYINT(1), position INT, created_by FK users, created_at, updated_at
```

### 19. notifications
```sql
id, user_id FK CASCADE, type, title, content TEXT,
is_read TINYINT(1) DEFAULT 0,
reference_type(TASK/PROJECT/COMMENT), reference_id BIGINT, created_at
-- Types: TASK_ASSIGNED|TASK_MOVED|COMMENT_ADDED|MENTIONED|
--        CUSTOMER_CONFIRMED|CUSTOMER_REJECTED|ANNOUNCEMENT
```

### 20. announcements
```sql
id, author_id FK users, title, content TEXT, original_language(en),
target_scope(ALL/COUNTRY/BRANCH), target_id BIGINT(country_id or branch_id),
created_at
```

### 21. announcement_reads
```sql
id, announcement_id FK CASCADE, user_id FK CASCADE, read_at
UNIQUE(announcement_id, user_id)
```

### 22. chat_messages
```sql
id, channel_type(GLOBAL/COUNTRY/PROJECT/DIRECT), channel_id BIGINT,
sender_id FK users, content TEXT, original_language(en),
has_attachment TINYINT(1), created_at
-- channel_id = country_id / project_id / user_id(DM) depending on channel_type
```

### 23. chat_read_status
```sql
id, message_id FK CASCADE, user_id FK CASCADE, read_at
UNIQUE(message_id, user_id)
```

### 24. activity_logs
```sql
id, project_id FK SET NULL, user_id FK, action VARCHAR(100),
target_type(TASK/PROJECT/COMMENT/MEMBER), target_id BIGINT,
old_value VARCHAR(200), new_value VARCHAR(200), created_at
-- ⚠️ Java fields: targetType, targetId, oldValue, newValue (NOT entityType/detail)
-- Actions: TASK_CREATED|TASK_MOVED|TASK_ASSIGNED|COMMENT_ADDED|
--          FILE_UPLOADED|MEMBER_ADDED|PROJECT_CREATED|STATUS_CHANGED
```

---

## 🔗 API — Full Reference

All protected endpoints: `Authorization: Bearer {token}`
Base URL: `http://localhost:8080/api`

### Auth `/api/auth`
```
POST /login
  Body: { email, password }
  Response: { token, userId, name, email, role, branchId, preferredLanguage, profileImage }

GET  /me
  Response: current user info

PUT  /language
  Body: { language }   -- en|ja|my|vi|ko|km
```

### Users `/api/users`
```
GET    /                    -- all users (BOSS/DIRECTOR/ADMIN only)
GET    /by-branch/{branchId}
GET    /{id}
POST   /                    -- create user
  Body: { name, email, password, role, branchId, preferredLanguage?, phone?, profileImage? }

PUT    /{id}                -- update user
  Body: { name?, phone?, profileImage?, preferredLanguage?, branchId?, role? }

PUT    /{id}/activate
PUT    /{id}/deactivate
PUT    /{id}/change-password
  Body: { newPassword }

DELETE /{id}
```

### Countries `/api/countries`
```
GET    /
GET    /{id}
POST   /    Body: { name, code, flagEmoji? }
PUT    /{id}
DELETE /{id}
```

### Branches `/api/branches`
```
GET    /
GET    /by-country/{countryId}
GET    /{id}
POST   /    Body: { countryId, name, address? }
PUT    /{id}
DELETE /{id}
```

### Projects `/api/projects`
```
GET    /                    -- all (filtered by role)
GET    /by-branch/{branchId}
GET    /my                  -- my projects
GET    /{id}
POST   /
  Body: { title, description?, branchId, pmId?, startDate?, endDate?, budget? }

PUT    /{id}
  Body: { title?, description?, status?, pmId?, startDate?, endDate?, budget?, progress? }
  status: PLANNING|IN_PROGRESS|ON_HOLD|COMPLETED|CANCELLED

DELETE /{id}

GET    /{id}/members
POST   /{id}/members
  Body: { userId, roleInProject }
  roleInProject: PROJECT_MANAGER|LEADER|UI_UX|DEVELOPER|QA|CUSTOMER

DELETE /{id}/members/{userId}
```

### Sprints `/api/sprints`
```
GET    /by-project/{projectId}
GET    /{id}
POST   /    Body: { projectId, name, startDate?, endDate? }
PATCH  /{id}/status    Body: { status }   -- PLANNED|ACTIVE|COMPLETED
DELETE /{id}
```

### Tasks `/api/tasks`
```
GET    /by-project/{projectId}
GET    /by-project/{projectId}/status/{status}
GET    /by-project/{projectId}/sprint/{sprintId}
GET    /{id}/subtasks
GET    /my
GET    /{id}
POST   /
  Body: { title, projectId, description?, sprintId?, parentTaskId?,
          priority?, label?, assigneeId?, dueDate?, estimatedHours? }
  priority: LOW|MEDIUM|HIGH|CRITICAL

PUT    /{id}
  Body: { title?, description?, status?, priority?, label?, assigneeId?,
          sprintId?, dueDate?, estimatedHours?, actualHours?, position? }

PATCH  /{id}/status
  Body: { status, position? }
  status: TODO|IN_PROGRESS|IN_REVIEW|DONE|DELAYED|PENDING_APPROVAL

DELETE /{id}
```

### Comments `/api/comments`
```
GET    /by-task/{taskId}
GET    /{id}/replies
POST   /    Body: { taskId, content, originalLanguage? }
PUT    /{id}    Body: { content }
DELETE /{id}
```

### Notifications `/api/notifications`
```
GET    /my
GET    /unread-count    Response: { count: number }
PUT    /{id}/read
PUT    /read-all
```

### Attachments `/api/attachments`
```
POST   /upload    Body: multipart/form-data { file, taskId?, commentId? }
GET    /by-task/{taskId}
GET    /by-comment/{commentId}
DELETE /{id}
```

### Activity Logs `/api/activity-logs`
```
GET    /by-project/{projectId}
GET    /my
GET    /task/{taskId}
```

### Translations `/api/translations`
```
GET    /languages
  Response: [{ code: "en", name: "English" }, ...]

GET    /task/{taskId}?lang={langCode}
  Response: { taskId, language, title, description }

GET    /comment/{commentId}?lang={langCode}
  Response: { commentId, language, content }
```

### Chat `/api/chat`
```
POST   /send
  Body: { channelType, channelId?, content, originalLanguage? }
  channelType: GLOBAL|COUNTRY|PROJECT|DIRECT

GET    /global
GET    /country/{countryId}
GET    /project/{projectId}
GET    /direct/{otherUserId}

PUT    /read/{messageId}
PUT    /read-channel    Body: { channelType, channelId? }
GET    /unread    Response: { count: number }
```

---

## 🖥️ Phase Status

```
✅ Phase 1   — Auth + JWT
✅ Phase 2   — Country + Branch + User Management
✅ Phase 3   — Project + Sprint + Task
✅ Phase 4   — Comment + Attachment + Notification + ActivityLog
✅ Phase 5   — Translation API (Mock/DeepL/Google interface pattern)
✅ Phase 6   — Chat API
✅ Phase 10  — PM Dashboard Angular UI (ng serve OK ✅)
⏳ Phase 7   — WebSocket Real-time
⏳ Phase 8   — API Docs + ERD
⏳ Phase 9   — Dashboard APIs
⏳ Phase 11  — HR & Finance
⏳ Phase 12  — AI Staff Assignment
⏳ Phase 13  — Cloud Deploy + Presentation
⏳ Phase 14  — Video Call + Meeting Summary
```

---

## 🖥️ PM Dashboard (v26) — Angular Files

**Status:** `ng serve` → success ✅ | CSS styles being fixed 🔧

### Files location: `/mnt/user-data/outputs/angular-v26/`

| File | Place in project | Action |
|------|-----------------|--------|
| `pm-dashboard.ts` | `app/dashboard/` | REPLACE |
| `pm-dashboard.html` | `app/dashboard/` | NEW |
| `pm-dashboard.scss` | `app/dashboard/` | NEW (empty) |
| `dashboard.models.ts` | `app/models/` NEW folder | NEW |
| `dashboard-data.service.ts` | `app/services/` | NEW |
| `announcement-bar.component.*` (3 files) | `app/shared/` | NEW |
| `bell-notification.component.*` (3 files) | `app/shared/` | NEW |
| `styles.css` | `src/styles.css` | REPLACE |

### Layout (LOCKED v26)
```
[Topbar 56px]
[Announcement Bar 32px — click→modal]
[Left 210px FIXED] [Main SCROLLABLE] [Right 200px FIXED]
```

### Design Decisions (LOCKED)
- Theme: Brycen Green `#14532d → #16a34a`
- Slogan: "One Group. One Platform. Full Visibility." — purple→green italic
- Sign out: inside Settings submenu
- Dark/Light: `body.dark` / `body.light` class toggle
- Bell: Activity only (tabs: All / Activity / Mentions)
- Announcement pinned=🔒 no dismiss | normal=✕ dismissible

### pm-dashboard.ts REQUIRED properties
```typescript
searchQuery: string
settingsOpen: boolean
myTasksMaxH: number
chartData: { month, done, inProgress, todo }[]  // ← "inProgress" NOT "active"
donutData: { label, count, color }[]
portfolioProjects: PortfolioProject[]
// Methods:
signOut(), getUnreadCount(), getProgressColor(pct),
getStatusClass(status), getHealthDots(health), getHealthDotColor(i, health),
getBarMaxVal(), getBarHeight(val, max), getRoleBadgeStyle(role)
```

### DashboardDataService method names
```typescript
getAnnouncements()
getNotifications()        // Notification has .unread NOT .read
getActiveProjects()
getPortfolioProjects()    // ← NOT getPortfolio()
getTeamMembers()
getMyTasks()
getOverdueTasks()
getActivities()
getDeadlines()
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
```

---

## 📐 Java Coding Standards

```java
// Always Lombok
@Data @NoArgsConstructor @AllArgsConstructor @Builder

// ⚠️ Task model field names (NOT typo):
assigneeId    → assignee_id
reporterId    → reporter_id
originalLanguage → original_language

// ⚠️ ActivityLog field names:
targetType, targetId, oldValue, newValue
// NOT: entityType, entityId, detail

// Service pattern
@Service @Transactional
// Always log to activity_logs after mutations

// Security: Eclipse IDE (not IntelliJ), Lombok v1.18.42 installed
```

---

## 🌐 Angular Routes

```
/login
/dashboard/boss
/dashboard/pm      ← DONE ✅
/dashboard/dev
/projects
/kanban/:projectId
/chat
```

---

## 🎯 Current Status (2026-03-17)

**DONE:**
- `ng serve` builds successfully ✅
- PM Dashboard → renamed to `member-dashboard` ✅
- `dashboard.models.ts` — all models ✅
- `dashboard-data.service.ts` — `getTaskStats()`, `getChartData()` ✅
- `api-endpoints.ts` — all Dashboard endpoints ✅
- `boss-dashboard.ts` — basic version (Sidebar + simple template) ✅
- `dev-dashboard.ts` — basic version ✅
- GitHub repo: `AyeSuNaing/brycenhub` (public, main branch) ✅

**IN PROGRESS:**
- PM Dashboard CSS fix (styles.css Tailwind fix)
- Boss Dashboard — full design မရှိသေးဘူး

**NEXT STEPS:**
1. PM Dashboard CSS fix → styles.css correct Tailwind config
2. Boss Dashboard full Angular UI (Company Overview — all branches)
3. Dev Dashboard full Angular UI
4. Kanban Board
5. Connect to real Spring Boot API

---

## 📂 Key Files

```
/mnt/user-data/outputs/
├── CLAUDE.md                        ← THIS FILE
├── angular-v26/                     ← All Angular PM Dashboard files
├── asn_final_schema.sql             ← Full DB schema (24 tables)
├── application.properties           ← Spring Boot config
├── phase1/ phase2/ phase3/ ...      ← Java backend files by phase
└── pm-dashboard-files.zip           ← Latest zip

/mnt/transcripts/
├── journal.txt                      ← Session index
└── 2026-03-10-04-24-15-brycen-hub-pms-angular-dev.txt  ← Latest
```

---

*Last updated: 2026-03-10 | Brycen Cambodia Team*

# BRYCEN HUB PMS — CLAUDE.md
# Brycen AI Development Contest 2026
# ⚠️ READ THIS FIRST IN EVERY NEW CHAT

---

## 🚨 HOW TO START A NEW CHAT

Upload this file then say:
> "CLAUDE.md ဖတ်ပြီး project resume လုပ်ပါ"

Transcripts: `/mnt/transcripts/` (bash tool နဲ့ ဖတ်ရမယ်)
Latest: `2026-03-10-04-24-15-brycen-hub-pms-angular-dev.txt`

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
            ├── dashboard/         ← pm-dashboard, boss-dashboard, dev-dashboard
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

## 🗄️ DATABASE — Full Schema (24 Tables)

### 1. countries
```sql
id, name, code(JP/MM/KH/VN/KR/US), flag_emoji, created_at
-- Data: JP(1), MM(2), KH(3), VN(4), KR(5), US(6)
```

### 2. branches
```sql
id, country_id FK, name, address, created_at
-- Data: Japan HQ(1), Myanmar(2), Cambodia(3), Vietnam(4), Korea(5), USA(6)
```

### 3. users
```sql
id, name, email UNIQUE, password(BCrypt), role, branch_id FK,
preferred_language(en/ja/my/vi/ko/km), is_active(0/1),
profile_image, phone, created_at, updated_at
-- Roles: BOSS|COUNTRY_DIRECTOR|ADMIN|PROJECT_MANAGER|LEADER|UI_UX|DEVELOPER|QA|CUSTOMER
-- Default: admin@asn.com / password → BOSS
```

### 4. director_countries (many-to-many)
```sql
id, director_id FK users, country_id FK countries,
assigned_at, assigned_by FK users
UNIQUE(director_id, country_id)
```

### 5. projects
```sql
id, title, description, status(PLANNING/ACTIVE/ON_HOLD/COMPLETED/CANCELLED),
pm_id FK users, branch_id FK branches,
start_date DATE, end_date DATE, budget DECIMAL(15,2),
progress INT(0-100), created_by FK users, created_at, updated_at
```

### 6. project_members
```sql
id, project_id FK CASCADE, user_id FK,
role_in_project(PROJECT_MANAGER/LEADER/UI_UX/DEVELOPER/QA/CUSTOMER),
status(ACTIVE/INACTIVE/REMOVED), joined_at, removed_at
```

### 7. sprints
```sql
id, project_id FK CASCADE, name, start_date DATE, end_date DATE,
status(PLANNED/ACTIVE/COMPLETED), created_at
```

### 8. tasks
```sql
id, project_id FK CASCADE, sprint_id FK, parent_task_id FK(subtask),
title, description, original_language(en),
status(TODO/IN_PROGRESS/IN_REVIEW/DONE/DELAYED/PENDING_APPROVAL),
priority(LOW/MEDIUM/HIGH/CRITICAL),
label VARCHAR(200) -- comma separated "bug,feature,urgent"
assignee_id FK users, reporter_id FK users,
due_date DATE, estimated_hours DECIMAL(6,2), actual_hours DECIMAL(6,2),
position INT, created_at, updated_at
-- ⚠️ Java field: assigneeId → assignee_id, reporterId → reporter_id
```

### 9. task_translations
```sql
id, task_id FK CASCADE, language_code(en/ja/my/vi/ko/km),
translated_title, translated_description, created_at
UNIQUE(task_id, language_code)
```

### 10. task_confirmations
```sql
id, task_id FK CASCADE, customer_id FK users,
status(PENDING/APPROVED/REJECTED), feedback TEXT, confirmed_at, created_at
```

### 11. comments
```sql
id, task_id FK CASCADE, user_id FK, content TEXT,
original_language(en), created_at, updated_at
```

### 12. comment_translations
```sql
id, comment_id FK CASCADE, language_code,
translated_content TEXT, created_at
UNIQUE(comment_id, language_code)
```

### 13. attachments
```sql
id, task_id FK, comment_id FK, uploaded_by FK users,
file_name, file_url, file_type(image/video/document),
file_size BIGINT(bytes), created_at
```

### 14. design_boards
```sql
id, project_id FK UNIQUE, canvas_data LONGTEXT(Fabric.js JSON),
thumbnail_url, version INT, updated_by FK users, updated_at
```

### 15. design_board_history
```sql
id, design_board_id FK CASCADE, version INT, canvas_data LONGTEXT,
thumbnail_url, save_note, saved_by FK users, saved_at
```

### 16. db_designs
```sql
id, project_id FK CASCADE, title, file_url, uploaded_by FK users, created_at
```

### 17. api_docs
```sql
id, project_id FK UNIQUE, title, description, version(1.0),
base_url, created_by FK users, created_at, updated_at
```

### 18. api_endpoints
```sql
id, api_doc_id FK CASCADE, group_name, title, method(GET/POST/PUT/DELETE/PATCH),
url, description, headers JSON, request_body JSON, request_example TEXT,
response_body JSON, response_example TEXT, status_codes JSON,
auth_required TINYINT(1), position INT, created_by FK users, created_at, updated_at
```

### 19. notifications
```sql
id, user_id FK CASCADE, type, title, content TEXT,
is_read TINYINT(1) DEFAULT 0,
reference_type(TASK/PROJECT/COMMENT), reference_id BIGINT, created_at
-- Types: TASK_ASSIGNED|TASK_MOVED|COMMENT_ADDED|MENTIONED|
--        CUSTOMER_CONFIRMED|CUSTOMER_REJECTED|ANNOUNCEMENT
```

### 20. announcements
```sql
id, author_id FK users, title, content TEXT, original_language(en),
target_scope(ALL/COUNTRY/BRANCH), target_id BIGINT(country_id or branch_id),
created_at
```

### 21. announcement_reads
```sql
id, announcement_id FK CASCADE, user_id FK CASCADE, read_at
UNIQUE(announcement_id, user_id)
```

### 22. chat_messages
```sql
id, channel_type(GLOBAL/COUNTRY/PROJECT/DIRECT), channel_id BIGINT,
sender_id FK users, content TEXT, original_language(en),
has_attachment TINYINT(1), created_at
-- channel_id = country_id / project_id / user_id(DM) depending on channel_type
```

### 23. chat_read_status
```sql
id, message_id FK CASCADE, user_id FK CASCADE, read_at
UNIQUE(message_id, user_id)
```

### 24. activity_logs
```sql
id, project_id FK SET NULL, user_id FK, action VARCHAR(100),
target_type(TASK/PROJECT/COMMENT/MEMBER), target_id BIGINT,
old_value VARCHAR(200), new_value VARCHAR(200), created_at
-- ⚠️ Java fields: targetType, targetId, oldValue, newValue (NOT entityType/detail)
-- Actions: TASK_CREATED|TASK_MOVED|TASK_ASSIGNED|COMMENT_ADDED|
--          FILE_UPLOADED|MEMBER_ADDED|PROJECT_CREATED|STATUS_CHANGED
```

---

## 🔗 API — Full Reference

All protected endpoints: `Authorization: Bearer {token}`
Base URL: `http://localhost:8080/api`

### Auth `/api/auth`
```
POST /login
  Body: { email, password }
  Response: { token, userId, name, email, role, branchId, preferredLanguage, profileImage }

GET  /me
  Response: current user info

PUT  /language
  Body: { language }   -- en|ja|my|vi|ko|km
```

### Users `/api/users`
```
GET    /                    -- all users (BOSS/DIRECTOR/ADMIN only)
GET    /by-branch/{branchId}
GET    /{id}
POST   /                    -- create user
  Body: { name, email, password, role, branchId, preferredLanguage?, phone?, profileImage? }

PUT    /{id}                -- update user
  Body: { name?, phone?, profileImage?, preferredLanguage?, branchId?, role? }

PUT    /{id}/activate
PUT    /{id}/deactivate
PUT    /{id}/change-password
  Body: { newPassword }

DELETE /{id}
```

### Countries `/api/countries`
```
GET    /
GET    /{id}
POST   /    Body: { name, code, flagEmoji? }
PUT    /{id}
DELETE /{id}
```

### Branches `/api/branches`
```
GET    /
GET    /by-country/{countryId}
GET    /{id}
POST   /    Body: { countryId, name, address? }
PUT    /{id}
DELETE /{id}
```

### Projects `/api/projects`
```
GET    /                    -- all (filtered by role)
GET    /by-branch/{branchId}
GET    /my                  -- my projects
GET    /{id}
POST   /
  Body: { title, description?, branchId, pmId?, startDate?, endDate?, budget? }

PUT    /{id}
  Body: { title?, description?, status?, pmId?, startDate?, endDate?, budget?, progress? }
  status: PLANNING|IN_PROGRESS|ON_HOLD|COMPLETED|CANCELLED

DELETE /{id}

GET    /{id}/members
POST   /{id}/members
  Body: { userId, roleInProject }
  roleInProject: PROJECT_MANAGER|LEADER|UI_UX|DEVELOPER|QA|CUSTOMER

DELETE /{id}/members/{userId}
```

### Sprints `/api/sprints`
```
GET    /by-project/{projectId}
GET    /{id}
POST   /    Body: { projectId, name, startDate?, endDate? }
PATCH  /{id}/status    Body: { status }   -- PLANNED|ACTIVE|COMPLETED
DELETE /{id}
```

### Tasks `/api/tasks`
```
GET    /by-project/{projectId}
GET    /by-project/{projectId}/status/{status}
GET    /by-project/{projectId}/sprint/{sprintId}
GET    /{id}/subtasks
GET    /my
GET    /{id}
POST   /
  Body: { title, projectId, description?, sprintId?, parentTaskId?,
          priority?, label?, assigneeId?, dueDate?, estimatedHours? }
  priority: LOW|MEDIUM|HIGH|CRITICAL

PUT    /{id}
  Body: { title?, description?, status?, priority?, label?, assigneeId?,
          sprintId?, dueDate?, estimatedHours?, actualHours?, position? }

PATCH  /{id}/status
  Body: { status, position? }
  status: TODO|IN_PROGRESS|IN_REVIEW|DONE|DELAYED|PENDING_APPROVAL

DELETE /{id}
```

### Comments `/api/comments`
```
GET    /by-task/{taskId}
GET    /{id}/replies
POST   /    Body: { taskId, content, originalLanguage? }
PUT    /{id}    Body: { content }
DELETE /{id}
```

### Notifications `/api/notifications`
```
GET    /my
GET    /unread-count    Response: { count: number }
PUT    /{id}/read
PUT    /read-all
```

### Attachments `/api/attachments`
```
POST   /upload    Body: multipart/form-data { file, taskId?, commentId? }
GET    /by-task/{taskId}
GET    /by-comment/{commentId}
DELETE /{id}
```

### Activity Logs `/api/activity-logs`
```
GET    /by-project/{projectId}
GET    /my
GET    /task/{taskId}
```

### Translations `/api/translations`
```
GET    /languages
  Response: [{ code: "en", name: "English" }, ...]

GET    /task/{taskId}?lang={langCode}
  Response: { taskId, language, title, description }

GET    /comment/{commentId}?lang={langCode}
  Response: { commentId, language, content }
```

### Chat `/api/chat`
```
POST   /send
  Body: { channelType, channelId?, content, originalLanguage? }
  channelType: GLOBAL|COUNTRY|PROJECT|DIRECT

GET    /global
GET    /country/{countryId}
GET    /project/{projectId}
GET    /direct/{otherUserId}

PUT    /read/{messageId}
PUT    /read-channel    Body: { channelType, channelId? }
GET    /unread    Response: { count: number }
```

---

## 🖥️ Phase Status

```
✅ Phase 1   — Auth + JWT
✅ Phase 2   — Country + Branch + User Management
✅ Phase 3   — Project + Sprint + Task
✅ Phase 4   — Comment + Attachment + Notification + ActivityLog
✅ Phase 5   — Translation API (Mock/DeepL/Google interface pattern)
✅ Phase 6   — Chat API
✅ Phase 10  — PM Dashboard Angular UI (ng serve OK ✅)
⏳ Phase 7   — WebSocket Real-time
⏳ Phase 8   — API Docs + ERD
⏳ Phase 9   — Dashboard APIs
⏳ Phase 11  — HR & Finance
⏳ Phase 12  — AI Staff Assignment
⏳ Phase 13  — Cloud Deploy + Presentation
⏳ Phase 14  — Video Call + Meeting Summary
```

---

## 🖥️ PM Dashboard (v26) — Angular Files

**Status:** `ng serve` → success ✅ | CSS styles being fixed 🔧

### Files location: `/mnt/user-data/outputs/angular-v26/`

| File | Place in project | Action |
|------|-----------------|--------|
| `pm-dashboard.ts` | `app/dashboard/` | REPLACE |
| `pm-dashboard.html` | `app/dashboard/` | NEW |
| `pm-dashboard.scss` | `app/dashboard/` | NEW (empty) |
| `dashboard.models.ts` | `app/models/` NEW folder | NEW |
| `dashboard-data.service.ts` | `app/services/` | NEW |
| `announcement-bar.component.*` (3 files) | `app/shared/` | NEW |
| `bell-notification.component.*` (3 files) | `app/shared/` | NEW |
| `styles.css` | `src/styles.css` | REPLACE |

### Layout (LOCKED v26)
```
[Topbar 56px]
[Announcement Bar 32px — click→modal]
[Left 210px FIXED] [Main SCROLLABLE] [Right 200px FIXED]
```

### Design Decisions (LOCKED)
- Theme: Brycen Green `#14532d → #16a34a`
- Slogan: "One Group. One Platform. Full Visibility." — purple→green italic
- Sign out: inside Settings submenu
- Dark/Light: `body.dark` / `body.light` class toggle
- Bell: Activity only (tabs: All / Activity / Mentions)
- Announcement pinned=🔒 no dismiss | normal=✕ dismissible

### pm-dashboard.ts REQUIRED properties
```typescript
searchQuery: string
settingsOpen: boolean
myTasksMaxH: number
chartData: { month, done, inProgress, todo }[]  // ← "inProgress" NOT "active"
donutData: { label, count, color }[]
portfolioProjects: PortfolioProject[]
// Methods:
signOut(), getUnreadCount(), getProgressColor(pct),
getStatusClass(status), getHealthDots(health), getHealthDotColor(i, health),
getBarMaxVal(), getBarHeight(val, max), getRoleBadgeStyle(role)
```

### DashboardDataService method names
```typescript
getAnnouncements()
getNotifications()        // Notification has .unread NOT .read
getActiveProjects()
getPortfolioProjects()    // ← NOT getPortfolio()
getTeamMembers()
getMyTasks()
getOverdueTasks()
getActivities()
getDeadlines()
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
```

---

## 📐 Java Coding Standards

```java
// Always Lombok
@Data @NoArgsConstructor @AllArgsConstructor @Builder

// ⚠️ Task model field names (NOT typo):
assigneeId    → assignee_id
reporterId    → reporter_id
originalLanguage → original_language

// ⚠️ ActivityLog field names:
targetType, targetId, oldValue, newValue
// NOT: entityType, entityId, detail

// Service pattern
@Service @Transactional
// Always log to activity_logs after mutations

// Security: Eclipse IDE (not IntelliJ), Lombok v1.18.42 installed
```

---

## 🌐 Angular Routes

```
/login
/dashboard/boss
/dashboard/pm      ← DONE ✅
/dashboard/dev
/projects
/kanban/:projectId
/chat
```

---

## 🎯 Current Status (2026-03-10)

**DONE:**
- `ng serve` builds successfully ✅
- PM Dashboard renders at `localhost:4200/dashboard/pm`
- All 12 Angular files in place

**IN PROGRESS:**
- styles.css CSS fix (Tailwind confirmed → need to check tailwind.config.js content)
- UI should look like v26 design preview

**NEXT STEPS:**
1. Fix styles.css with correct Tailwind config
2. Boss Dashboard Angular files
3. Dev Dashboard Angular files
4. Kanban Board
5. Connect to real Spring Boot API

---

## 📂 Key Files

```
/mnt/user-data/outputs/
├── CLAUDE.md                        ← THIS FILE
├── angular-v26/                     ← All Angular PM Dashboard files
├── asn_final_schema.sql             ← Full DB schema (24 tables)
├── application.properties           ← Spring Boot config
├── phase1/ phase2/ phase3/ ...      ← Java backend files by phase
└── pm-dashboard-files.zip           ← Latest zip

/mnt/transcripts/
├── journal.txt                      ← Session index
└── 2026-03-10-04-24-15-brycen-hub-pms-angular-dev.txt  ← Latest
```

---

*Last updated: 2026-03-10 | Brycen Cambodia Team*


# HR & FINANCE APPROVAL FLOW — REFERENCE
# Brycen Hub PMS — Confirmed Logic
# Last updated: 2026-04-12

---

## 👥 ROLE HIERARCHY

```
BOSS (CEO)
  └── COUNTRY_DIRECTOR
        └── VICE_PRESIDENT
              └── ADMIN (HR)
                    └── PROJECT_MANAGER
                          └── LEADER → DEVELOPER / UI_UX / QA
```

---

## 📋 REQUEST TYPES & APPROVERS

### Type 1 — Leave Request
```
Who submits : Any staff (LEADER down)
Who approves: VICE_PRESIDENT | ADMIN | COUNTRY_DIRECTOR  (any one)
Scope       : Own branch only
```

### Type 2 — OT Request
```
Who submits : Any staff (LEADER down)
Who approves: VICE_PRESIDENT | ADMIN | COUNTRY_DIRECTOR  (any one)
Scope       : Own branch only
```

### Type 3 — Salary (payroll)
```
Who submits : ADMIN (HR) on behalf of branch
Who approves: VICE_PRESIDENT | COUNTRY_DIRECTOR | BOSS  (any one)
Scope       : Own branch (VP/Admin) | Assigned countries (Director) | All (Boss)
```

### Type 4 — Other Expense
```
Who submits : ADMIN (HR) or VICE_PRESIDENT
Who approves: VICE_PRESIDENT | COUNTRY_DIRECTOR | BOSS  (any one)
Scope       : Own branch (VP/Admin) | Assigned countries (Director) | All (Boss)
```

---

## 🔄 STATUS FLOW

```
PENDING → APPROVED
PENDING → REJECTED
```

- တစ်ယောက်ယောက် approve/reject လုပ်ရင် ပြီး (no chain)
- `approved_by` = ဘယ် user က action လုပ်တယ်
- `approved_at` = timestamp

---

## 🔐 PERMISSION CHECK LOGIC

```java
// ── Leave / OT ──────────────────────────────────
boolean canApproveLeaveOT(User user) {
    String role = user.getRole().getName();
    return role.equals("VICE_PRESIDENT")
        || role.equals("ADMIN")
        || role.equals("COUNTRY_DIRECTOR");
}

// ── Salary / Expense ────────────────────────────
boolean canApproveSalaryExpense(User user) {
    String role = user.getRole().getName();
    return role.equals("VICE_PRESIDENT")
        || role.equals("COUNTRY_DIRECTOR")
        || role.equals("BOSS");
}
```

---

## 🖥️ DASHBOARD VISIBILITY

### VP Dashboard (`/dashboard/vp`)
```
Leave requests     ← branch ရဲ့ pending ပြ + approve/reject
OT requests        ← branch ရဲ့ pending ပြ + approve/reject
Salary requests    ← branch ရဲ့ pending ပြ + approve/reject
Other expenses     ← branch ရဲ့ pending ပြ + approve/reject
Scope             : users.branch_id = VP's branch_id
```

### Director Dashboard (`/dashboard/director`)
```
Leave requests     ← assigned countries ရဲ့ branches ပြ + approve/reject
OT requests        ← assigned countries ရဲ့ branches ပြ + approve/reject
Salary requests    ← assigned countries ရဲ့ branches ပြ + approve/reject
Other expenses     ← assigned countries ရဲ့ branches ပြ + approve/reject
Scope             : director_countries table → branch_id list
```

### Boss/CEO Dashboard (`/dashboard/boss`)
```
Salary requests    ← company-wide pending ပြ + approve/reject
Other expenses     ← company-wide pending ပြ + approve/reject
Leave/OT           ← view only (approve မလုပ်)
Scope             : all branches
```

### Admin (HR) Dashboard (`/dashboard/admin`)
```
Leave requests     ← own branch ပြ + approve/reject
OT requests        ← own branch ပြ + approve/reject
Salary/Expense     ← create + submit (approve မလုပ်)
Scope             : users.branch_id = Admin's branch_id
```

---

## 🗄️ DB TABLES

### ot_requests
```sql
id, user_id FK, branch_id FK,
work_date DATE, ot_hours DECIMAL(4,2),
day_type VARCHAR(20),     -- WEEKDAY | WEEKEND | HOLIDAY
ot_rate DECIMAL(4,2),
project_id FK (nullable),
reason TEXT,
status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING | APPROVED | REJECTED
approved_by FK users (nullable),
approved_at DATETIME (nullable),
created_at DATETIME
```

### leave_requests
```sql
id, user_id FK, branch_id FK,
leave_type VARCHAR(20),   -- ANNUAL | SICK | UNPAID
start_date DATE, end_date DATE,
total_days INT,
reason TEXT,
status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING | APPROVED | REJECTED
approved_by FK users (nullable),
approved_at DATETIME (nullable),
created_at DATETIME
```

### branch_expenses (Finance)
```sql
id, branch_id FK, category_id FK,
amount DECIMAL(15,2), currency VARCHAR(10),
description TEXT,
expense_type VARCHAR(20),  -- SALARY | EXPENSE
receipt_url VARCHAR(500),
date DATE,
status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING | APPROVED | REJECTED
approved_by FK users (nullable),
approved_at DATETIME (nullable),
created_by FK users,
created_at DATETIME
```

### branch_income
```sql
id, branch_id FK, category_id FK,
amount DECIMAL(15,2), currency VARCHAR(10),
description TEXT,
reference_no VARCHAR(100),
date DATE,
created_by FK users,
created_at DATETIME
```

### finance_categories
```sql
id, name VARCHAR(100),
icon VARCHAR(10),          -- emoji
type VARCHAR(10),          -- EXPENSE | INCOME
scope VARCHAR(10),         -- GLOBAL | BRANCH
branch_id FK (NULL = global),
is_active TINYINT(1) DEFAULT 1,
created_by FK users,
created_at DATETIME
```

---

## 🌐 API ENDPOINTS

### OT Requests
```
GET    /api/ot-requests?status=PENDING&branchId=   ← role-based filter
POST   /api/ot-requests                            ← staff submit
PUT    /api/ot-requests/{id}/approve               ← VP/HR/Director
PUT    /api/ot-requests/{id}/reject                ← VP/HR/Director
```

### Leave Requests
```
GET    /api/leave-requests?status=PENDING&branchId=
POST   /api/leave-requests
PUT    /api/leave-requests/{id}/approve
PUT    /api/leave-requests/{id}/reject
```

### Branch Expenses
```
GET    /api/branch-expenses?status=PENDING&branchId=
POST   /api/branch-expenses
PUT    /api/branch-expenses/{id}/approve           ← VP/Director/Boss
PUT    /api/branch-expenses/{id}/reject
```

### Finance Categories
```
GET    /api/finance-categories?type=EXPENSE
GET    /api/finance-categories?type=INCOME
POST   /api/finance-categories                     ← HR create
PUT    /api/finance-categories/{id}
DELETE /api/finance-categories/{id}
```

---

## 🔄 ROUTES

```
/dashboard/vp          ← VICE_PRESIDENT
/dashboard/director    ← COUNTRY_DIRECTOR
/dashboard/boss        ← BOSS (CEO)
/dashboard/admin       ← ADMIN (HR)
/dashboard/member      ← PROJECT_MANAGER, LEADER, DEVELOPER, UI_UX, QA
```

---

## 📌 SIDEBAR NAV BY ROLE

### VP (`/dashboard/vp`)
```
Overview | Projects | Members | Finance | Announcements
(Chat မပါ)
```

### Director (`/dashboard/director`)
```
Overview | Projects | Members | Finance | Announcements | Chat
Branch tabs: KH | MM | VN (assigned)
```

### Boss/CEO (`/dashboard/boss`)
```
Overview | Finance | Operations | People | Reports | Announcements
Country list: JP | MM | KH | VN | KR | US
```

### Admin/HR (`/dashboard/admin`)
```
Overview | Staff List | Add Staff | Finance | Announcements
```

---

## ✅ CONFIRMED — 2026-04-12
# Do NOT re-discuss these decisions in future sessions

## 🔐 Project Edit / Delete Permissions (CONFIRMED 2026-04-13)

| Role | Edit Project | Delete Project |
|---|---|---|
| PROJECT_MANAGER | ✅ own projects only | ✅ own projects (tasks မရှိမှ) |
| VICE_PRESIDENT | ✅ all projects | ✅ all projects |
| COUNTRY_DIRECTOR | ✅ all projects | ✅ all projects |
| BOSS | ✅ all projects | ❌ cannot delete |
| ADMIN (HR) | ❌ | ❌ |

### Delete Rules
- Tasks ရှိနေပြီဆိုရင် PM delete မလုပ်နိုင် (VP/Director/Boss မူတည်)
- Boss — read + edit ✅ | delete ❌ (read-only on destructive actions)

### Edit Unlock Rules  
- Tasks မစရသေးရင် — title အပါအဝင် အကုန် edit လုပ်လို့ရတယ်
- Tasks ရှိပြီးဆိုရင် — title, description, dates, budget, status, priority edit ရတယ်

## 🔐 HR Approval Flow (CONFIRMED 2026-04-13)

| Request Type | Approvers |
|---|---|
| Leave | VP / HR(Admin) / Director (any one) |
| OT | VP / HR(Admin) / Director (any one) |
| Salary | VP / Director / Boss (any one) |
| Other Expenses | VP / Director / Boss (any one) |

Status flow: PENDING → APPROVED / REJECTED (one approval = done)




