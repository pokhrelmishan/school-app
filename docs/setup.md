# Setup Guide

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20+ | Runtime and package management |
| npm | 10+ | Install dependencies |
| Git | 2.x | Version control |
| Expo Go | Latest | Test on a physical device |
| Supabase account | Free tier | Backend auth and database |

Optional:

- **Android Studio** — Android emulator
- **Xcode** (macOS only) — iOS simulator
- **Supabase CLI** — run migrations locally

## Clone and Install

```bash
git clone git@github.com:YOUR_USERNAME/school-app.git
cd school-app
npm install
```

## Environment Variables

1. Copy the example file:

   ```bash
   cp .env.example .env
   ```

2. Create a Supabase project at [supabase.com](https://supabase.com)

3. From **Project Settings → API**, copy:

   - Project URL → `EXPO_PUBLIC_SUPABASE_URL`
   - `anon` public key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

4. Never commit `.env` — it is listed in `.gitignore`

## Supabase Setup

### 1. Run migrations

Once migration files exist in `supabase/migrations/`:

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Apply migrations
supabase db push
```

Alternatively, paste migration SQL into the Supabase SQL Editor in the dashboard.

### 2. Seed demo data

```bash
# Via CLI (when configured)
supabase db execute -f supabase/seed.sql
```

Or run `supabase/seed.sql` in the SQL Editor.

Demo seed includes ~10–15 users across all roles for Elmwood Academy.

## Run the App

```bash
npx expo start
```

Then:

- Scan the QR code with **Expo Go** (Android) or the Camera app (iOS)
- Press `a` for Android emulator
- Press `i` for iOS simulator (macOS only)

## Demo Accounts

After seeding, use these test accounts (passwords defined in seed data):

| Role | Email | Notes |
|------|-------|-------|
| Admin | admin@elmwood.demo | Dashboard access |
| Teacher | teacher@elmwood.demo | Mark attendance, enter grades |
| Student | student@elmwood.demo | View own data |
| Parent | parent@elmwood.demo | View linked child |

> Update this table once seed data is finalized.

## Troubleshooting

### Expo Go won't connect

- Ensure phone and computer are on the same Wi-Fi network
- Try `npx expo start --tunnel` if LAN connection fails

### Supabase auth errors

- Verify `.env` values match your Supabase project
- Restart the Expo dev server after changing `.env`
- Check that email auth is enabled in Supabase → Authentication → Providers

### RLS permission denied

- Confirm the user's profile row exists in `profiles`
- Check RLS policies match the user's role and class assignments
- See [database.md](database.md) for policy details

## Development Workflow

1. Pull latest from `main`
2. Create a feature branch (optional): `git checkout -b feature/attendance`
3. Make changes and test in Expo Go
4. Update [CHANGELOG.md](../CHANGELOG.md) with what you built
5. Commit with a clear message and push
