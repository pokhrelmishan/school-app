# Architecture Decisions

This document records key technology and design choices. Update it when making decisions that affect the project's direction.

---

## ADR-001: Mobile-first with Expo

**Date:** 2026-07-24  
**Status:** Accepted

### Context

The school needs a mobile app for teachers (mark attendance in class) and families (check grades on the go). A web-only solution would work on phones but lacks native feel and future push notification support.

### Decision

Use **Expo (React Native + TypeScript)** for a single codebase targeting iOS and Android.

### Alternatives considered

| Option | Why not |
|--------|---------|
| React web (PWA) | Existing Vite prototype is web-only; user chose mobile platform |
| Flutter | Team has React experience; Expo ecosystem is strong for MVPs |
| Native iOS + Android | Two codebases; too slow for MVP |

### Consequences

- Fast iteration with Expo Go during development
- Can eject or use development builds later if native modules are needed
- Original Vite prototype becomes a design reference, not the production app

---

## ADR-002: Supabase as backend

**Date:** 2026-07-24  
**Status:** Accepted

### Context

The app needs auth, a relational database (classes, enrollments, attendance, grades), and role-based access control. Building a custom backend adds significant time.

### Decision

Use **Supabase** for Auth, PostgreSQL, and Row Level Security.

### Alternatives considered

| Option | Why not |
|--------|---------|
| Firebase | Better for document data; relational grades/attendance fit SQL better |
| Custom Node.js + PostgreSQL | More control but slower to ship MVP |
| PocketBase | Less mature ecosystem for RLS and mobile auth patterns |

### Consequences

- RLS enforces permissions at the database level (defense in depth)
- Free tier handles ~350 users easily
- Vendor dependency on Supabase; migration path exists via standard PostgreSQL

---

## ADR-003: Defer entity management to v2

**Date:** 2026-07-24  
**Status:** Accepted

### Context

The school has ~350 students and staff in Easy accounting software and Excel. Building CRUD screens for every person before attendance works would delay the MVP.

### Decision

MVP uses **demo seed data** (~10–15 users). Real onboarding comes in v2 via **bulk CSV import**.

### Consequences

- MVP can be tested end-to-end without real school data
- Schema includes all relationship tables from day one (no rewrite later)
- Import pipeline design depends on discovery with the school owner

---

## ADR-004: Public GitHub repo with demo data only

**Date:** 2026-07-24  
**Status:** Accepted

### Context

The developer wants to document skills and track progress publicly. The school has real student/staff data that must not be exposed.

### Decision

Use a **public GitHub repository** with:

- Demo/fake data in seed scripts (`@elmwood.demo` emails)
- `.env` and real import CSVs in `.gitignore`
- Portfolio-quality README and docs

### Consequences

- Good visibility for portfolio and learning
- Can switch to private repo later if school name or details need protection
- Strict discipline required: never commit secrets or real rosters

---

## ADR-005: Expo Router for navigation

**Date:** 2026-07-24  
**Status:** Accepted

### Context

The app has distinct areas per role (auth, teacher, student/parent) with nested screens.

### Decision

Use **Expo Router** (file-based routing) with route groups: `(auth)`, `(teacher)`, `(student)`.

### Alternatives considered

| Option | Why not |
|--------|---------|
| React Navigation alone | More boilerplate; Expo Router integrates file structure with routes |
| Tab-only navigation | Roles need separate stacks, not just tabs |

### Consequences

- Auth redirect logic lives in layout files per group
- Deep linking supported out of the box for future features

---

## ADR-006: React Context for state (MVP)

**Date:** 2026-07-24  
**Status:** Accepted

### Context

MVP state needs are simple: auth session, user profile/role, and Supabase query results per screen.

### Decision

Use **React Context** for auth state. No global state library for MVP.

### Alternatives considered

| Option | Why not |
|--------|---------|
| Redux / Zustand | Overkill for MVP scope |
| TanStack Query | Good option for server state; may add later if caching needs grow |

### Consequences

- Revisit if offline sync or complex caching is needed in later phases

---

## Template for new decisions

```markdown
## ADR-NNN: Title

**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Superseded

### Context
Why this decision is needed.

### Decision
What we chose.

### Alternatives considered
What else we looked at.

### Consequences
What follows from this choice.
```
