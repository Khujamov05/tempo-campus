# Tempo: accounts and shared schedule

The published application uses Supabase Auth and PostgreSQL. The schema in
`migrations/202610300001_accounts.sql` has been applied to the Tempo project.

## Roles

- Student: reads the entire schedule of a selected group.
- Teacher: initially sees their own lessons across all groups; can switch to a group.
  Each lesson's assigned teacher determines ownership.
- Administrator: edits and publishes the shared schedule, assigns account roles.

All authenticated accounts can read the shared schedule. Teacher filtering is a
presentation preference, not a restriction on reading other teachers' lessons.
Anonymous reads and direct client writes are denied. Only checked RPC functions
can save the schedule or assign roles. A client cannot promote itself through
profile writes or user metadata. Concurrent saves use a revision to avoid losing
another administrator's changes. Users must sign out and back in after a role change
to refresh the interface; database permissions are checked on every request.

## Adding accounts

The site has a sign-in screen, without public registration. The project owner
creates accounts in Supabase Dashboard → Authentication → Users. New profiles
start as students. Use real, accessible email addresses for real users; configure
SMTP and recovery flows before relying on email invitations or password resets.

An administrator opens **Управление ролями / Rollarni boshqarish**, finds the
account by its UUID (shown in the user's profile), chooses a role and, for a teacher,
links it to an existing teacher. A student can be assigned a default group.
An administrator cannot change their own role through this form.

Three test accounts were provisioned: `admin@tempo-campus.test`,
`teacher@tempo-campus.test` (Xusainov Sh. M.) and `student@tempo-campus.test`
(KIDT-231). These reserved test addresses have no inbox. Passwords are only in the
owner's ignored local file `artifacts/tempo-test-accounts.local`, not in Git or the
published site. Replace these with individual accounts for actual use.

## New project setup

1. Apply the SQL migration to a new Supabase project, once.
2. Set the public URL and publishable key from `.env.example`. Never put a secret
   or service-role key in a `VITE_` variable or frontend source.
3. Create the initial owner account through Supabase Auth; assign its profile the
   `admin` role in the trusted SQL editor by exact UUID.
4. Seed `campus_schedule` with a validated Tempo version-1 JSON backup. The existing
   deployed project has already been seeded with the demonstration timetable.
5. Test permissions and publish a fresh frontend build.

`scripts/provision-test-accounts.mjs` is an optional one-time owner setup and API
verification script for this project. It reads `.supabase-admin.local` and stores
generated credentials in the ignored local file. It needs Node 24+, the schema,
an `artifacts` directory, and temporary `service_role` privileges: SELECT/INSERT on
`campus_schedule`, SELECT/UPDATE on `profiles`. It creates missing test accounts,
sets their roles, and seeds only an absent schedule. Run only for authorized setup;
remove those temporary privileges and delete the key file immediately afterwards.
The deployed app never uses this script or the secret key. Setup has been completed;
the temporary grants were revoked and the key file deleted.

## Verification

Unit tests cover teacher/student defaults and filtering. Actual hosted API checks
verified login/profile/read for all three roles, rejection of anonymous reads,
rejection of teacher/student saves and self-promotion, administrator saves, and
stale-revision conflicts. These checks complement the browser UI checks.
