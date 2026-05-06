# Parent Portal — Login + Dashboard Enhancements

The parent portal already exists (`ParentDashboard`, `ParentMarks`, `ParentAttendance`, `ParentHomework`, `ParentAnnouncements`, `Messages`, fees) and routes/RLS are wired for `role = parent`. This plan adds the missing pieces: a phone/admission-number login, admin tooling to create parent accounts with an initial password, and three new dashboard widgets.

## 1. Parent login (admission # or mobile + password)

Supabase Auth requires email+password under the hood. We resolve the identifier to the parent's email server-side, then sign in normally.

**New edge function `parent-login`** (`verify_jwt = false`, public):
- Input: `{ identifier: string, password: string }`
- Resolution order:
  1. If identifier is digits → look up `profiles.phone` (parent role) in any school.
  2. Else (admission number) → `students.admission_number` → `parent_student.parent_user_id` → `profiles.email`.
- If found, call `supabase.auth.signInWithPassword({ email, password })` using the **anon** client and return the resulting session JSON. If not found or password wrong, return generic 401.

**Login page changes** (`src/pages/Login.tsx`):
- Add a tabbed switcher: **Staff (email)** | **Parent (mobile / admission no.)**.
- Parent tab posts to `parent-login`, then `supabase.auth.setSession(...)` with the returned tokens. Redirect to `/dashboard`.
- Keep existing email/password tab unchanged.

## 2. Admin creates parent accounts

**New edge function `create-parent-account`** (`verify_jwt = true`):
- Caller must be `school_admin` (verify role server-side via service role + JWT).
- Input: `{ student_id, parent_name, phone, email?, password }`. If email omitted, generate `phone@parents.schoolos.local` so Supabase has something unique.
- Steps: `auth.admin.createUser` (email_confirm true) → insert `profiles` (with `phone`, `school_id`) → insert `user_roles` (parent) → insert `parent_student` link. Idempotent if a parent with same phone already exists for that school — just link to student.

**UI**: New "Manage parent login" button in `StudentDetailDialog` (or row action on `Students.tsx`) — opens a small dialog with name / phone / password fields, submits to the function, shows the credentials in a success toast for the admin to share.

## 3. Dashboard widgets (append to `ParentDashboard.tsx`)

Below the existing announcements card, add:
- **Today's Timetable** — query `timetable` for `section_id = activeChild.section_id` and `day_of_week = today`. Show period, subject, teacher.
- **Upcoming Events** — query `school_events` where `event_date >= today` order asc limit 5.
- **Recent Marks** — query latest published exam's `marks` for `activeChild.id`, show subject + obtained/max with a small bar.

Each uses `BookLoader` + `EmptyState` consistent with the rest of the app.

## Technical notes

- No DB migration needed. RLS for `school_events`, `timetable`, `marks`, `parent_student` already allows the parent to read what they need.
- `profiles.phone` exists; we'll set it on parent creation and index lookups by it (case-insensitive not needed, digits only — we'll strip non-digits client + server side).
- `parent-login` uses anon key only (no service role) — it just translates identifier → email and forwards the password to standard Supabase Auth, so brute-force protection from Auth still applies.
- `create-parent-account` uses `SUPABASE_SERVICE_ROLE_KEY` (already in secrets). We'll verify the caller's JWT and check `has_role('school_admin')` before any write.
- Login page keeps the existing InstallBanner and styling; only the form area becomes tabbed.

## Files

Created:
- `supabase/functions/parent-login/index.ts`
- `supabase/functions/create-parent-account/index.ts`
- `src/components/AddParentLoginDialog.tsx`

Edited:
- `src/pages/Login.tsx` (tabbed login)
- `src/pages/ParentDashboard.tsx` (3 widgets)
- `src/components/StudentDetailDialog.tsx` (entry point for parent-login dialog)
- `supabase/config.toml` (set `verify_jwt = false` for `parent-login`)

After you approve, I'll implement everything in one pass.