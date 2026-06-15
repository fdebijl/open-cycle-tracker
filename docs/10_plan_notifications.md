# Implementation plan: reminders & notifications (#10)

## Context

Roadmap item #10 ("No reminders/notifications") is flagged in
[`roadmap.md`](./roadmap.md) as fighting the privacy model. Two hard constraints
shape every option:

1. **The server is cryptographically blind.** It never sees cycle dates, period
   onset, or predictions — all are computed client-side in
   `ui/src/data/prediction.ts` and never persisted. The server therefore *cannot
   know when to fire a reminder* unless the client leaks the schedule to it.
2. **The app is not a PWA and the DEK is wiped on background.** No manifest, no
   service worker (`ui/` is a React 19 + Vite SPA served by nginx). The
   in-memory DEK is zeroed on `visibilitychange→hidden` and after 5 min idle
   (`ui/src/stores/vault.ts`, `AUTO_LOCK_MS` in `ui/src/config/env.ts`). A
   backgrounded service worker has **no key** to decrypt anything.

A reminder needs three things: **(a) timing** (we have it, client-side only),
**(b) a background trigger** (fires when the app is closed), and **(c) content**
(needs the DEK). The web can do (a) and a degraded (b); only native gives all
three privately. So the plan ships value on the web today and treats
full-fidelity reminders as a native deliverable.

**Decisions:** content-free web push is acceptable but **must be opt-in and off
by default**; native is the clean long-term answer.

---

## Phase 1 — In-app nudges (ship first, zero new infra)

Fires only while the app is open, but costs nothing in server/third-party/
metadata terms and is immediately useful. This is the baseline that should ship
regardless of whether push is ever added.

**What to build:**
- A pure `ui/src/data/reminders.ts` that, given the decrypted cycle history and
  the existing prediction output (`cycleStats` / `predictNextPeriod` /
  `predictFertileWindow` in `ui/src/data/prediction.ts`), returns the set of due
  nudges for "today": e.g. *period approaching* (within N days of predicted
  onset), *fertile window open*, *log today* (no day logged for today). Keep it
  pure and unit-tested, mirroring `prediction.ts` and its test file.
- A reminders settings block in the existing settings route (alongside the other
  encrypted settings persisted to `encSettings`): per-type on/off toggles +
  lead-time (days before period). Store in `encSettings` so preferences are E2EE
  like everything else — reuse the existing settings read/write path.
- An in-app banner component rendered on the main/cycle screen when nudges are
  due, computed on unlock/open from the decrypted data (no timers needed).
- Optional, gated behind the same toggles: when the document is visible and the
  user has granted permission, also raise a foreground `Notification`. Request
  permission lazily on first enable, never on load.

**Touch points:** `ui/src/data/` (new `reminders.ts` + test), the settings route
under `ui/src/routes/`, a banner component under `ui/src/components/`, and the
`encSettings` shape/typing used by `ui/src/stores/vault.ts` consumers.

---

## Phase 2 — PWA + opt-in content-free push (foundation for real reminders)

Turns the SPA into an installable PWA and adds an **opt-in, off-by-default**
push that wakes the app. The push carries **no payload about the cycle** — the
service worker has no DEK, so it can only show a generic "Open Open Cycle Tracker
to check your cycle." The cycle logic still runs client-side when the user opens
the app (Phase 1).

**What to build:**
- PWA groundwork: a web app manifest (icons, theme color, `display: standalone`)
  and service worker registration. Use `vite-plugin-pwa` (Workbox) to fit the
  existing Vite 8 build rather than hand-rolling. Wire SW registration in the
  app bootstrap; keep `index.html` cache headers as-is (nginx already serves
  `index.html` no-cache, hashed assets immutable).
- Service worker `push` + `notificationclick` handlers that show a fixed generic
  notification and focus/open the app on click. The SW must **never** attempt to
  read user data.
- Opt-in flow in settings: on enable, request notification permission, subscribe
  via `PushManager` using a VAPID public key, and POST the **opaque**
  subscription to the API. Default off; one tap to disable + unsubscribe.
- API: a new `push_subscriptions` table (store the subscription as opaque
  `bytea`/text, keyed by user, nothing else), endpoints to register/unregister,
  and a minimal scheduler that sends payload-free Web Push on a **fuzzed,
  user-chosen cadence** (e.g. a daily window ± jitter). There is **no cron/queue
  in `api/` today** — add the smallest viable scheduler (e.g. an interval worker
  in the existing Node process, or a documented external cron hitting an
  authenticated endpoint). Generate a VAPID keypair as deploy config.

**Privacy notes to honor in code & docs:**
- Cadence is user-set and must **never** be derived from cycle data — that would
  leak the schedule the blind-server design protects.
- Document the residual leak plainly: a stored subscription reveals device
  reachability via FCM/Apple/Mozilla push, online-time, and timezone. Mitigate
  with send-time fuzzing, rate limiting, and opaque storage.
- iOS caveat: web push only works on iOS 16.4+ and only when installed to the
  home screen.

**Touch points:** `ui/vite.config.*`, app bootstrap (SW registration), a new
`sw` source under `ui/`, settings route; API schema migration under
`api/drizzle/` + `api/src/db/schema.ts`, new routes under `api/src/`, scheduler,
VAPID env config.

**Explicitly rejected on web:** meaningful background content ("period in 2
days") — it requires persisting a key or precomputed plaintext to the device,
relaxing the wipe-on-background model. Defer to native; see quick-unlock (#13)
for the only principled at-rest key handling.

---

## Phase 3 — Native app (the clean answer; future, not implemented here)

When a native app exists, reminders become trivial and fully private: OS-level
**local notification scheduling** (`UNUserNotificationCenter` on iOS;
`AlarmManager`/`WorkManager`/notification scheduling on Android) lets the client
schedule the next N reminders locally from its own prediction — firing while the
app is closed, with **full content**, and **no server, no third party, no device
tokens**. The app reschedules on each open/unlock. Secure key storage (Keychain
/ Android Keystore / StrongBox, biometric-gated) additionally lets the auto-lock
model relax safely — the same enabler as quick-unlock (#13). Bundle this work
with that security track.

---

## Recommendation & sequencing

1. **Ship Phase 1 now** — useful, zero risk, no new infra.
2. **Phase 2 only if wanted** — strictly opt-in, off by default, behind the PWA
   groundwork. It buys "tap to open" nudges while closed, nothing richer.
3. **Full-fidelity reminders are a native deliverable** (Phase 3).

A legitimate alternative to Phase 2 is to **declare background web reminders a
non-goal** and stand on Phase 1 — the roadmap already lists that as an acceptable
outcome. Decide before building the push infra.

Also add a cross-link from `roadmap.md` item #10 to this plan (and to a future
`docs/notifications.md` if one is written), matching the existing
`architecture.md` / `encryption.md` cross-links.

## Verification

- **Phase 1:** unit tests for `reminders.ts` (mirror `prediction.test`); manually
  confirm banners/foreground notifications appear for each due type and respect
  the `encSettings` toggles; confirm nothing is written to the server.
- **Phase 2:** install the PWA, enable push, confirm an opaque subscription is
  stored and a payload-free wake-up fires on the fuzzed cadence and opens the
  app; confirm the SW never touches user data; verify disable unsubscribes.
  Test iOS only as installed-to-home-screen on 16.4+.
