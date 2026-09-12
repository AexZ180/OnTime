# OnTime backend handoff

The Node backend implements independent accounts, profiles, friend requests, member-only scheduling polls, ranked overlap, confirmation into a shared calendar event, and RSVP. The existing calendar CRUD/import endpoints now use these accounts. Frontend components have not been modified: the frontend teammate must replace the ChatGPT sign-in link and connect the account, friend, and poll screens below.

## Start on your machine

Use Node 22.13+ and run from the repository root:

```sh
npm install
npm run dev
```

This starts the API on `http://127.0.0.1:3001` and the existing frontend on `http://localhost:5173`. The frontend forwards `/api/*` to Node, so browser cookies work on the frontend origin. `npm run dev:api` and `npm run dev:frontend` start them separately. `npm run start:api` runs the API without the frontend. The existing `npm start` still starts the built frontend and needs the API running separately.

No database URL is currently configured in this checkout. With no URL, development uses PGlite (embedded PostgreSQL) persisted under `.ontime/data`, ignored by Git. Accounts, sessions, profiles, friendships, calendars, and polls survive an API restart. Keep that directory to retain local data; do not run multiple API processes against it. It is a development database, not a hosted Tiger Data service or a backup.

`GET /api/health` reports `storage: "local"` or `"tiger"`. There are no seeded accounts: register through the API or your teammate's form. The old UI's demo data remains separate from saved account data.

Configuration loads from process environment, then `.env.local`, `.env`, and `.dev.vars` (existing variables win). Optional `.env.example` documents settings. Default origins are localhost and 127.0.0.1 on port 5173. If the frontend uses another port, configure `APP_ORIGIN`. If API port changes, configure `API_PORT` for Node and `API_BASE_URL` in the frontend's `.dev.vars`.

## Switch to Tiger Data

1. Obtain your service's PostgreSQL connection URL from the teammate/Tiger Data dashboard. The code alone does not create or provision a Tiger Data account.
2. In ignored `.env.local`, set `DATABASE_MODE=tiger` and `DATABASE_URL` to that URL with the provider's TLS settings. Remove an explicit `DATABASE_MODE=local` if you copied the example. Never paste credentials into source code or chat.
3. Restart the API. It applies the existing Drizzle migrations followed by `0002_fixed_gambit.sql` and reports `storage: tiger` after migration succeeds. Missing or failing Tiger configuration stops startup; it does not silently fall back to local storage.

The new migration adds tables/columns and preserves the original calendar/event/profile data. Existing migrations must be reflected in Drizzle's migration journal on an existing service; do not run them again manually against already-created tables. Local and Tiger Data use the same SQL schema. **Switching the URL selects another database; it does not copy local rows to the hosted database.** For the hackathon, create demo accounts in the selected database. A migration of existing local or ChatGPT-owned accounts would be a separate data-transfer operation. Legacy ChatGPT owner IDs are not automatically claimed by a matching email.

Profiles and event records remain stored until explicitly changed/deleted or the database is removed. Sessions expire after seven days and logout revokes the session in SQL. Hosted backup retention depends on your Tiger Data service settings; this code does not configure provider backups. Email verification, password reset, account deletion/export, automatic expiration cleanup, and production abuse monitoring are not implemented in this hackathon backend.

Production requires `NODE_ENV=production`, a working database URL, and HTTPS `APP_ORIGIN`. Cookies then use Secure. The Node listener binds to loopback; put it behind your deployment's reverse proxy. The frontend Worker needs an explicit reachable `API_BASE_URL` outside local development. Do not assume the old private Sites deployment runs this separate Node process. IP limits use the actual socket address, not untrusted forwarded headers; behind the frontend proxy that becomes a shared IP limit (10 registrations/15 minutes and 50 logins/15 minutes), plus 15 login attempts per identifier/15 minutes.

## Frontend API contract

Requests with bodies use JSON. Success returns JSON; failures return `{ "error": "message" }` with 400 validation, 401 signed out, 403 forbidden, 404 inaccessible/missing, 409 conflict, 429 rate limit, or 503 storage error. Send cookies (`credentials: "include"` when calling a separate allowed origin). Browser mutations must use an allowed origin. No ChatGPT headers or client-supplied user ID can select the acting account.

```ts
async function api(path: string, method = 'GET', data?: unknown) {
  const response = await fetch('/api' + path, {
    method, credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}
```

### 1. Accounts and profiles

| Method / path | Body / result |
| --- | --- |
| POST `/auth/register` | `{email, username, password, name, timeZone?}` → `{user}` plus session cookie, 201 |
| POST `/auth/login` | `{identifier, password}`; identifier is email or username → `{user}` plus session cookie |
| POST `/auth/logout` | `{}` → `{ok:true}`, revokes cookie/session |
| GET `/auth/me` | `{user: {id,email,username} \| null}` |
| GET `/profile` | `{profile}` with own settings and username |
| PATCH `/profile` | Any of `{name,username,birthday,homeCity,timeZone,locationSharing,bio,visibility}` → `{profile}` |

Usernames normalize to lowercase and contain 3–30 letters, digits, or underscores. Passwords are 15–128 characters, stored as Argon2id hashes, never plaintext. Session tokens are random, stored hashed in SQL, sent only through HttpOnly/SameSite=Lax cookies. Email and username uniqueness are enforced by SQL. Birthday is blank or a real `YYYY-MM-DD` date; timezone must be IANA, e.g. `America/Chicago`. `locationSharing` accepts `never`, `while_using`, `always` as a stored preference; no live geolocation is implemented.

`visibility` is `public`, `friends` (default), or `private`. Search exposes ID, username, display name, and bio for public/friends profiles. Detailed profiles (including city/timezone) are visible to the owner, public viewers if public, or accepted friends if friends. Private profiles are hidden from search and other users. Email, birthday, and location-sharing settings are not exposed through discovery.

### 2. Friends

| Method / path | Body / result |
| --- | --- |
| GET `/users?q=al` | Username prefix, 2–30 characters → `{users:[{id,username,name,bio}]}` |
| GET `/users/:userId` | Visible `{profile}`; inaccessible profiles return 404 |
| GET `/friends` | `{friends:[{id,status,direction,user}]}`; direction incoming/outgoing |
| POST `/friends/requests` | `{userId}` → `{id,status:"pending"}`, 201 |
| PATCH `/friends/:requestId` | `{action:"accept"\|"decline"\|"cancel"\|"remove"\|"block"\|"unblock"}` |

Only the recipient accepts/declines; only the sender cancels. Blocking an existing request/connection hides discovery and prevents new invitations. Only the blocker can unblock. Removing/unblocking deletes the relationship. Existing shared polls/events remain visible to their members after a friendship changes; blocking does not retroactively cancel plans.

### 3. Availability polls

```ts
const {id} = await api('/polls', 'POST', {
  title: 'Post-hackathon dinner', description: 'Celebrate together', location: 'Downtown',
  timeZone: 'America/Chicago', durationMinutes: 60, minParticipants: 2,
  windows: [{start: '2030-10-01T18:00:00-05:00', end: '2030-10-01T21:00:00-05:00'}],
  invitees: [{userId: friendId, required: true}],
});
await api(`/polls/${id}/availability`, 'PUT', {
  blocks: [{start: '2030-10-01T18:00:00-05:00', end: '2030-10-01T20:00:00-05:00', status: 'preferred'}],
});
const {slots} = await api(`/polls/${id}/slots`);
// Each member submits using their own account. Organizer confirms a qualified slot.
const {eventId} = await api(`/polls/${id}/confirm`, 'POST', {start: slots.find(s => s.qualified).start});
```

| Method / path | Behavior |
| --- | --- |
| GET `/polls` | Member's `{polls:[{poll,required,submittedAt}]}` |
| POST `/polls` | Create using above shape → `{id}`, 201 |
| GET `/polls/:id` | `{poll,members,availability}`; availability contains only caller's blocks |
| PUT `/polls/:id/availability` | `{blocks:[{start,end,status}]}` replaces caller's availability; empty array clears it |
| GET `/polls/:id/slots` | `{slots,computedAt}` ranked best first; each slot has start/end, qualified, available/preferred/maybe counts and participant status |
| POST `/polls/:id/confirm` | `{start}` → `{eventId}`; organizer only, recomputes against current data |
| POST `/polls/:id/cancel` | `{}` cancels an open poll; organizer only |

Invite accepted friends only. Organizer is automatically required. Maximum 20 members, 31 nonoverlapping windows within a 31-day range, and 500 availability blocks per member. Duration is 15–240 minutes in 15-minute increments. Slots advance every 15 minutes from each window's start. Dates need explicit UTC `Z` or offsets; IANA timezone is for display, not a substitute for date-specific DST offsets.

Availability statuses: `preferred`, `available`, `maybe`, `unavailable`. Uncovered time is **unknown**. The whole meeting must be covered. Existing owned calendar events and shared plans marked Invited/Going/Maybe count as busy; declining a shared plan removes that participant's reservation. Private event titles and notes are never included in ranking responses. Poll members can see each other's availability status for candidates.

Ranking prioritizes qualified slots, attendee count, preferred count, maybe count, then earliest time. Required attendees must be available/preferred; maybe does not qualify them. The minimum counts available/preferred attendees. Confirmation locks the poll and participant accounts and rechecks conflicts before writing. Repeating the same confirmation returns the same event; choosing another time returns 409. Closed polls reject edits. Confirmed plan time changes require a new poll; organizer may still edit its title/details or delete the shared event.

### 4. Calendar and RSVP compatibility

`GET /state` returns `{user,profile,calendars,events}`. Own events include `canEdit:true` and an invitation token. Shared events appear under a virtual `Shared plans` calendar with the same event ID, `canEdit:false`, and `attendance`. The frontend should disable event editing when `canEdit === false`, and show RSVP instead. Do not insert copies of shared events.

`POST /action` retains `calendar`, `profile`, `save`, `import`, and `delete` actions from the existing frontend. Save/import return `{ok,count,ids}`; calendars and edits are checked against the session owner. Import is limited to 500 events per request. Existing calendar event date parsing remains compatible with the original frontend; send explicit offsets for portable times. Deleting a confirmed event removes memberships/RSVPs and marks its poll cancelled.

`GET /events/:eventId/rsvp` returns `{event,responses,mine}` for organizer/members. `POST /events/:eventId/rsvp` with `{status:"Going"|"Maybe"|"Not going"}` changes only the caller's RSVP. Only the organizer sees all response names. Legacy `GET /rsvp?token=...` and `POST /rsvp` with `{token,status}` still work: possession of this unguessable invitation token grants event access and allows a signed-in user to join. Treat tokens as shareable invitation links, not public event IDs.

## Verification

```sh
npm run test:backend
npx tsc --noEmit
npm run build
```

Backend tests apply every SQL migration to an isolated on-disk PostgreSQL-compatible database, create fictional accounts, exercise authorization/privacy and the full planning lifecycle, close and reopen storage, and verify account/session/event retention. They never connect to a configured Tiger Data service. A real Tiger Data connection and provider backup policy still require separate verification once credentials exist.
