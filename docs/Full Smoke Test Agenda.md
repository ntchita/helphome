# CareWork — Smoke Test Agenda
Date: ____  Tester: ____  Build: feature/multitenant

## Setup
- [ ] Backend running: `node server.js`
- [ ] Frontend running: `npx vite`
- [ ] DB terminal ready (Ctrl+C to stop backend before DB checks)

---

## T1 — Client  (jane.doe@client.com / test)
- [ ] Login → lands on /dashboard
- [ ] Workers load, match % visible
- [ ] Filter 50%+ / 75% / interest chips work
- [ ] Book Now Mia Chen → green flash
- [ ] Wellness → submit (score 8) → Thank-you
- [ ] Logout → Home
DB: shift offered to Mia | client wellness log +1

## T2 — Independent Worker  (mia.chen@worker.com / test)
- [ ] Login → /my-hub
- [ ] No tabs (single marketplace view)
- [ ] Accept Jane's request → green flash
- [ ] Submit check-in → Today bar → DB log
- [ ] Flag support → error "No coordinator assigned" (correct)
- [ ] Logout
DB: shift accepted | worker wellness log +1

## T3 — Coordinator Worker / Dual  (sarah.johnson@helphome-worker.com / test)
- [ ] Login → /my-hub
- [ ] TWO tabs: Marketplace + HelpHome Roster
- [ ] Marketplace: accept Mark Taylor
- [ ] Roster: 3 shifts (Jane, Priya, Dana)
- [ ] Submit check-in → chart updates → DB log
- [ ] Flag support → success → DB welfare_chat +1
- [ ] Logout
DB: shift accepted | worker log +1 | welfare chat +1

## T4 — Coordinator Admin  (tonia@helphome.au / test)
- [ ] Login → /coordinator
- [ ] 20 workers, filter chips (All/Thriving/Steady/At Risk)
- [ ] Filter At Risk (3) → roster + requests filter
- [ ] Schedule welfare chat → flash → DB +1
- [ ] Client Requests section: 3-4 rows
- [ ] Verification → 20 workers, filters work
- [ ] Toggle Verify/Revoke → persists on refresh
- [ ] Logout

## T5 — CareWork Admin  (admin@carework.au / test)
- [ ] Login → /admin
- [ ] 6 KPIs numeric
- [ ] Trend + donut + revenue render
- [ ] Attention: 3-5 alerts
- [ ] Dismiss alert → returns on refresh (expected)
- [ ] People counts match DB
- [ ] Platform health bars
- [ ] Activity: 10 events
- [ ] Coordinator Hub → 20 workers
- [ ] Verification → 32 profiles (duals twice)
- [ ] Client Requests → 5+ rows
- [ ] Logout

## T6 — Public Flows
- [ ] Home page renders
- [ ] Register → 3 doors
- [ ] Client door → NDIS + PlanCare + Cooking → submit
- [ ] Success → filters work → select Sophia → Confirm → flash
- [ ] Back home → Login same email → fails (correct)
- [ ] Re-register same email → picker skips/returns selection
- [ ] Worker door → submit → success
- [ ] Coordinator door → submit → success
DB: signup_leads rows present

## T7 — Mobile
- [ ] Hamburger ☰ appears
- [ ] Tap ☰ → vertical menu
- [ ] Tap link → navigates + menu closes
- [ ] Single-column layout on all hubs
- [ ] No horizontal overflow

## T8 — Session Handling
- [ ] Change helphome_user_id to bogus → refresh → bounce to /login
- [ ] localStorage.clear() → refresh → login screen
- [ ] No blank screens, no console crash

---

## Final DB Sanity (backend stopped)
Run:
node -e "import('drizzle-orm').then(async () => { const { getDb, schema } = await import('./src/db/connection.ts'); const db = await getDb(); for (const t of ['users','signupLeads','shifts','wellnessLogs','welfareChats']) { const rows = await db.select().from(schema[t]); console.log(t + ':', rows.length); } process.exit(0); })"

Expected:
- users: 41 (admin + coordinator + 10 clients + 10 independents + 14 emp + 6 cont)
- signupLeads: ≥2
- shifts: ≥5
- wellnessLogs: ≥95
- welfareChats: ≥1

---

## Results summary
T1 __  T2 __  T3 __  T4 __  T5 __  T6 __  T7 __  T8 __

Failures / notes:
