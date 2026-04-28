# Fix: Staff "Add" failing with `user_roles_user_id_fkey`

## What's actually happening

When a school admin adds a staff member, the current code generates a random UUID and uses it as `user_id` for `profiles`, `staff_profiles`, and `user_roles`. We previously dropped the foreign keys on `profiles.user_id` and `staff_profiles.user_id` to make those inserts succeed, but `user_roles.user_id` still has a foreign key to `auth.users`, so it rejects the fake UUID.

We should NOT drop the FK on `user_roles` — that table is the source of truth for permissions, and breaking referential integrity there would make role checks unreliable across the app.

## What we'll build instead — invite-based staff creation

Real auth users will be created on the server using the service role key, and an invite email will be sent so the staff member can set their own password. This keeps all foreign keys intact, gives every staff member a real account, and matches your requested flow.

### 1. New edge function: `invite-staff`

A server-side function (uses the service role key, never exposed to the browser) that:
- Verifies the caller is a logged-in `school_admin` of the target school.
- Validates inputs (name, email, role, school_id, optional staff fields, employee_id).
- Re-runs the case-insensitive employee_id duplicate check.
- Calls `supabase.auth.admin.inviteUserByEmail(email, { data: { name, role, school_id } })`.
  - The existing `handle_new_user` trigger already creates the matching `profiles` and `user_roles` rows automatically from `raw_user_meta_data` — no manual insert needed.
- Updates the just-created `profile` with `phone` (and any extra fields not handled by the trigger).
- Inserts the `staff_profiles` row using the real `auth.users.id`.
- Returns `{ user_id, profile_id, status: "invited" }`.

Failure handling: if the email already exists in `auth.users`, return a clear "already a member" error instead of silently creating duplicates.

### 2. Database migration

- Add `invited_at timestamptz` and `invite_status text default 'invited'` (values: `invited`, `active`, `expired`) to `profiles`.
- Add a trigger on `auth.users` (on first sign-in / `last_sign_in_at` set) that flips the matching `profiles.invite_status` to `active`.
- Re-add the foreign keys on `profiles.user_id` and `staff_profiles.user_id` referencing `auth.users(id) ON DELETE CASCADE` — they were dropped earlier and we no longer need them gone, since all inserts now go through the invite flow.
- Clean up any orphan rows created by the previous broken flow before re-adding the FKs (delete `staff_profiles` and `profiles` rows whose `user_id` does not exist in `auth.users`).
- Keep the existing case-insensitive unique index on `staff_profiles (school_id, lower(employee_id))`.

### 3. Frontend changes

**`src/components/StaffFormDialog.tsx` (Add path)**
- Replace the three direct inserts with a single call: `supabase.functions.invoke("invite-staff", { body: {...} })`.
- Show toast: "Invite sent to {email}".
- The Edit path stays as-is (real users already exist for editing).

**`src/components/ImportStaffDialog.tsx` (CSV import)**
- For each parsed row, call the same `invite-staff` function (one per row, sequentially with a small concurrency cap).
- Show per-row success/failure summary at the end ("12 invited, 2 failed: …").

**`src/pages/Staff.tsx` (status display)**
- Fetch `invite_status` and `invited_at` along with the profile.
- Show a status pill next to each staff name:
  - **Invited** (amber) — has `invite_status='invited'` and `invited_at` within last 7 days
  - **Invite expired** (red) — `invite_status='invited'` and `invited_at` older than 7 days
  - **Active** (green) — `invite_status='active'`
- Add a **Resend invite** action on the row menu for invited/expired staff (calls `invite-staff` again with `resend: true`, which uses `auth.admin.generateLink` for a fresh invite).
- Add an **Invite all pending staff** button at the top of the page (visible to admins) that loops through invited+expired rows.

### 4. Email template

The invite email goes through Supabase's built-in invite flow. The default template works out of the box; we can brand it later with the auth email templates flow if you want the email to match your school's look — that's a separate follow-up and not required for this fix.

## Technical notes

- The edge function will be configured with `verify_jwt = true` (default) so we can read the caller's identity from the JWT and check that they are a `school_admin` of `school_id` before doing anything.
- `SUPABASE_SERVICE_ROLE_KEY` is already configured as a secret — no new secrets needed.
- `inviteUserByEmail` automatically sends the email; the staff member clicks the link, sets a password, and on first sign-in the trigger flips their status to `active`.
- The "invite expired after 7 days" badge is purely a UI signal based on `invited_at` — Supabase invite links themselves are valid for 24h by default, so "Resend" generates a fresh one.

## Files that will change

- **New**: `supabase/functions/invite-staff/index.ts`
- **New**: migration adding `invite_status` / `invited_at` columns, the auth.users trigger, orphan cleanup, and re-adding the two FKs
- **Edited**: `src/components/StaffFormDialog.tsx`
- **Edited**: `src/components/ImportStaffDialog.tsx`
- **Edited**: `src/pages/Staff.tsx`
