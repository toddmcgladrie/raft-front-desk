# RAFT Front Desk

A four-screen staff website for the Richmond Area Family Therapy sample database. The site uses Supabase Auth for sign-in and reads and writes the existing `raft` schema through the Data API.

## Assignment notes

- **AI tool.** OpenAI Codex.
- **First prompt.** Use the [First Four Screens assignment brief](https://byu.instructure.com/courses/36313/assignments/1520478) to build the full site from the RAFT 3 implementation solution and publish it through GitHub. The user supplied the existing Supabase project separately.
- **What needed fixing.** Codex initially expected the project to contain the course schema. The audit found an earlier four-table version. Its records were preserved in `raft_before_first_four_screens` before installing the 12-table course schema. The lookup and record picker show saved appointment dates, including the course's 2024 sample appointments.
- **Step 7.** The follow-up change and live verification are pending the first deployment.

## Local run

Use Node.js 24. Copy `.env.example` to `.env.local` and fill in the Supabase project URL and publishable key. A legacy `anon` key also works. Only these browser-safe connection values belong in the frontend. Staff passwords go in the private assignment submission.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. `npm run build` creates the deployable site in `dist/`.

## Supabase setup

1. In the course Supabase project, install the [RAFT 3 Implementation Solution](https://byu.instructure.com/courses/36313/pages/raft-3-implementation-solution). The SQL on that page drops and rebuilds `raft`. Preserve any existing data before installing it. The RAFT course schema is already installed for this project's first setup.
2. Run [`supabase/staff-access.sql`](supabase/staff-access.sql) in the SQL Editor. It sets the database roles and grants and installs `public.raft_access_token_hook`.
3. In **Authentication → Users**, choose **Add user → Create new user**, enable **Auto Confirm**, and create `admin@raft.example`, `scheduler@raft.example`, and `counselor@raft.example` with separate passwords. Run [`supabase/assign-demo-roles.sql`](supabase/assign-demo-roles.sql), editing the addresses if needed. Verify that the query returns all three role assignments.
4. In **Authentication → Auth Hooks**, enable the **Customize Access Token (JWT) Claims hook** with hook type **Postgres**, schema `public`, and function `raft_access_token_hook`.
5. In **Integrations → Data API → Settings**, add `raft` to **Exposed schemas**. The database grants govern access and keep anonymous and unassigned accounts out of `raft`.

## GitHub Pages

Set the Pages source to **GitHub Actions**. Under **Settings → Secrets and variables → Actions → Variables**, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The included workflow deploys on each push to `main` and can also be run manually. Anyone can open the site URL and reach staff sign-in.

## Verify

- Open the site signed out, then try a wrong password. Sign in with each demo account, reload, navigate through all four screens, and sign out.
- Look up a client with family roles and past appointments. Confirm the dashboard totals against the sample tables.
- As Scheduler, add an appointment and then add a scheduled client. Confirm the appointment appears in Dashboard and Client lookup. The scheduler sees scheduling fields and attendance.
- As Counselor, open the same appointment and update its notes, assignment, or attendance. As Admin, confirm the same details and check the employee wages. Use the app with the course's sample data when testing changes for grading.
