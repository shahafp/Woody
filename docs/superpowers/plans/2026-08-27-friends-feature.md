# Friends — Product and Implementation Plan

Date: 2026-08-27
Status: proposed

## Summary

Friends is a private training-coordination board for Woody's existing group of
roughly 20–30 CrossFit athletes. A member can publish when they plan to train
over the next few days, see when other members are going, join an existing
session, and email a workout invitation to another registered member.

The feature is deliberately not a social network, class-booking system, or
chat product. Its purpose is to answer one question quickly:

> Who can I train with today?

## Decisions already made

- The feature is named **Friends**.
- Friends is private and requires a Supabase account.
- The personal timer, WOD, lift, and log features remain usable without an
  account.
- The visible planning horizon is today plus the next two days. The data model
  supports a longer horizon later.
- Only registered members of the same private group can be invited.
- Workout invitations are delivered by email, not WhatsApp.
- Clicking an invitation email opens an app invitation page; it does not
  automatically join the recipient.
- V1 uses Google OAuth for sign-in so registration does not depend on outbound
  application email. Email magic-link or OTP sign-in can return later as a
  fallback when production SMTP is available.
- Invitation deep links use the existing production URL
  `https://woody-wod.vercel.app`; a custom application domain is not required.
- V1 invitation email is sent from a dedicated Gmail account through a small
  Google Apps Script MailApp endpoint. A custom sending domain is not required.
- Shared Friends data uses Supabase as its source of truth. It does not enter
  the existing owner-only Dexie sync engine.

## Assumptions

- The initial release serves one private training group, but the schema uses
  group ids so more groups can be added without redesigning it.
- The group's initial timezone is `Asia/Jerusalem`.
- Most sessions last about 60 minutes.
- Members already know one another; no friend-request graph is needed.
- The existing production URL is `https://woody-wod.vercel.app`.
- A dedicated Gmail account can be created for Friends invitations and kept
  separate from any developer's personal mailbox.
- The group is comfortable sharing intended workout times with other members.

## Problem statement

Members currently coordinate workout times through ad hoc messages. This makes
it difficult to see the whole day's plan, creates repeated questions, and means
people miss chances to train together. A small shared board can make intended
times visible without turning coordination into a conversation that every
member has to follow.

The riskiest product assumption is participation: the board has little value
if only one or two people publish their plans. The rollout therefore needs to
measure contribution and coordinated sessions, not just screen views.

## Goals

1. Let a member discover who is training today in under 10 seconds.
2. Let a member publish a training time in under 30 seconds.
3. Let a member join an existing session with one confirmation.
4. Let a member email a registered friend an invitation without seeing or
   entering that person's email address.
5. Increase the number of workouts where at least two group members
   intentionally coordinate through Woody.

## Non-goals

- **No chat or comments.** Existing communication channels remain better for
  conversation; adding chat would substantially increase moderation and
  notification scope.
- **No friend requests.** Group membership is the social boundary.
- **No public discovery.** Profiles, sessions, and member lists are visible
  only inside the private group.
- **No class booking or capacity management.** A Friends session signals
  intent; it does not reserve a gym class.
- **No recurring schedules in v1.** Recurrence creates cancellation and
  exception complexity before daily posting behavior is proven.
- **No push notifications in v1.** Email is the explicit invitation channel.
- **No sharing of personal performance data.** Workout logs, lifts, maxes,
  scores, and timer history remain private.
- **No arbitrary email invitations.** The inviter selects a registered group
  member, never types an email address.

## Personas

### Member deciding when to train

Wants to see today's likely attendance before choosing a time.

### Member with a planned time

Wants to publish their plan and make it easy for others to join.

### Invited member

Wants to understand who invited them, when the workout is, and accept or
decline without searching through the app.

### Group administrator

Wants membership to remain private and manageable without administering every
workout.

## Core user stories

- As a member, I want to see sessions for today and the next two days so I can
  choose when to train.
- As a member, I want to publish my intended workout time so friends can find
  and join me.
- As a member, I want to join an existing session so my intention is visible
  to everyone in the group.
- As a member, I want to leave a session or change my plan without asking an
  administrator.
- As a session creator, I want to edit or cancel the session when my plan
  changes.
- As a member, I want to invite another registered member so they receive a
  clear email with a link to the session.
- As an invited member, I want to accept or decline from the invitation page.
- As a member, I want to mute workout-invitation emails if I do not want them.
- As a signed-out user, I want Friends to explain why sign-in is required
  without blocking the rest of Woody.
- As a member using the app offline, I want a clear offline state rather than
  a schedule that appears current when it is stale.

## Information architecture

The current bottom navigation already contains five destinations. Replace the
Settings tab with Friends and expose Settings from a gear or profile action in
the app header.

Bottom navigation:

1. Timer
2. Friends
3. WOD
4. Log
5. Lifts

Settings remains available at `/settings`.

New routes:

- `/friends` — three-day schedule
- `/friends/sessions/:id` — session detail
- `/friends/invitations/:id` — invitation response
- `/friends/onboarding` — profile and group membership setup

## UX flow

### 1. First entry

When a signed-out user opens Friends:

```text
Friends

See when your training group is working out
and find someone to join.

[ Continue with Google ]

Only members of your private group can see your plans.
```

Google OAuth returns the user to `/friends/onboarding`. The app requests only
basic identity scopes for sign-in; it does not request access to the member's
Gmail, contacts, calendar, or Drive. The dedicated invitation sender is a
separate system account and authorization path.

### 2. Profile and group onboarding

The user supplies only what Friends needs:

1. Display name — required.
2. Profile photo — optional; initials are the fallback.
3. Group invitation code — required unless the user followed a group join
   link.
4. Confirmation that workout times are visible to group members.

The user is then taken to `/friends`.

### 3. Schedule board

The board defaults to Today and provides Tomorrow and the following day as
adjacent date controls. Sessions are ordered chronologically and grouped by
local date in the group's timezone.

```text
Friends                         [gear]

[Today] [Tomorrow] [Friday]

17:00 · CrossFit
Maya, Dan, Or
[Join]

18:30 · Open Gym
Shahaf · Back squat
[Join]

[ + Add my workout ]
```

Empty state:

```text
No one has added a workout yet.
Be the first to share your time.

[ Add my workout ]
```

### 4. Add a workout

The form is a bottom sheet or focused mobile page with:

- Date: today, tomorrow, or the following day.
- Start time: required.
- Expected duration: defaults to 60 minutes; allowed range 15–360 minutes.
- Type: CrossFit, Open Gym, Weightlifting, or Other.
- Note: optional, maximum 240 characters.

Before creation, the client checks for sessions within 15 minutes. If one
exists, show it first:

```text
Maya and Dan are training at 17:00.

[Join them] [Create a separate workout]
```

The server remains authoritative; this suggestion does not prevent separate
sessions.

### 5. Join and leave

Joining inserts the current member into the participant list and changes the
button to `Joined`.

Leaving removes the member from the participant list after confirmation. If
the creator is the last participant, leaving cancels the session. If the
creator leaves while others remain, ownership transfers atomically to the
earliest remaining participant.

### 6. Invite a friend

From a created or joined session, the member taps `Invite a friend`, sees the
registered members of the group, and selects one.

The app sends only `sessionId` and `inviteeUserId` to an authenticated Edge
Function. It never sends or exposes the invitee's email address.

UI states:

- Idle: `Send invitation`
- Sending: spinner and disabled action
- Success: `Invitation sent ✓`
- Existing pending invitation: `Already invited`
- Failure after the invitation row is saved: `Invitation saved, but the email
  could not be sent` and `Try email again`
- Recipient has disabled email invitations: `This friend has muted email
  invitations`

### 7. Invitation email

The invitation is always visible in the recipient's in-app pending-invitation
section. When email delivery succeeds, the recipient also receives:

Subject:

```text
Or invited you to train
```

Body:

```text
Or invited you to a workout.

Today at 17:00
CrossFit
Maya and Dan are also going.

[View invitation]
```

The button links to `/friends/invitations/{invitationId}`. This is an app deep
link, not an authentication magic link. A signed-out recipient authenticates
and returns to the same URL.

The email must not contain private workout results, personal email addresses,
or tracking pixels.

### 8. Respond to an invitation

Pending invitation:

```text
Or invited you to train

Today · 17:00
CrossFit with Or, Maya and Dan

[Join them] [Decline]
```

Accepting atomically marks the invitation accepted and inserts the recipient
as a participant. Declining marks it declined. Repeated requests are
idempotent.

Expired, cancelled, and wrong-account states have explicit messages. The
wrong-account message must not reveal the target email address.

### 9. Edit and cancel

The creator can change the start time, duration, type, or note. Joined members
see the current values the next time the board updates. V1 does not send an
additional email for edits.

Cancelling marks the session cancelled, makes all pending invitations expired,
and removes it from the default board. Existing invitation links show
`This workout was cancelled`.

### 10. Time states

- `Starting soon`: begins within 60 minutes.
- `Training now`: current time is within the planned session interval.
- Past sessions leave the default board after their expected end.
- Historical rows remain for 30 days for aggregate adoption metrics, then can
  be purged by a scheduled job.

## Functional requirements

### P0 — required for launch

- Friends navigation and routes.
- Auth gate using Supabase Google OAuth.
- Required display name and private group membership.
- Three-day board in the group's timezone.
- Create, edit, cancel, join, and leave session flows.
- Participant names and optional avatars.
- Authenticated member picker.
- Email invitation through a Supabase Edge Function and the Gmail/Apps Script
  sender.
- In-app pending-invitation section and Friends badge, so email is a delivery
  channel rather than the only copy of an invitation.
- Invitation accept, decline, expired, cancelled, and wrong-account states.
- Email invitation preference and rate limiting.
- Realtime or visibility-triggered refresh so member changes appear promptly.
- RLS policies and database tests for every shared table.
- Clear loading, empty, error, and offline states.
- Accessible labels, focus management, touch targets, and status
  announcements.

### P1 — fast follow

- Email magic-link or six-digit OTP sign-in as a fallback after reliable SMTP
  is configured.
- Common class-time quick choices.
- `I'm at the gym now` shortcut.
- Richer invitation inbox filtering and history.
- Provider delivery and bounce webhooks.
- Admin member-management screen and join-code rotation.
- Hebrew and RTL support.
- Optional follow-up email when a session time changes materially.

### P2 — future

- Recurring weekly availability.
- Calendar export or calendar integration.
- Multiple Friends groups per user.
- Push notifications.
- Reactions or lightweight comments.
- Attendance confirmation and social streaks.
- Gym class-capacity or booking integrations.

## Data model

All timestamps are `timestamptz`. Start times are converted from the group's
local timezone to UTC before storage and rendered back in the group timezone.

### `profiles`

Extend the existing table:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | References `auth.users` |
| `display_name` | text | Required before joining Friends |
| `avatar_url` | text nullable | Optional |
| `email_invites_enabled` | boolean | Default true |
| `created_at` | timestamptz | Existing |
| `updated_at` | timestamptz | Add |

Email remains in Supabase Auth and is never copied into a group-readable
profile row.

### `friend_groups`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | Client-independent id |
| `name` | text | Group display name |
| `timezone` | text | Initially `Asia/Jerusalem` |
| `created_by` | uuid | References `auth.users` |
| `created_at` | timestamptz | Server default |
| `updated_at` | timestamptz | Server default |

### `group_join_codes`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | Internal id |
| `group_id` | uuid FK | Target group |
| `code_hash` | text | Never store plaintext code |
| `expires_at` | timestamptz nullable | Optional expiration |
| `max_uses` | integer nullable | Optional cap |
| `uses` | integer | Default 0 |
| `active` | boolean | Supports rotation |
| `created_by` | uuid | Group administrator |

Joining occurs through a database function that accepts the plaintext code,
compares its hash, and atomically creates membership. Clients cannot select
join-code rows.

### `group_members`

| Column | Type | Notes |
|---|---|---|
| `group_id` | uuid FK | Composite PK |
| `user_id` | uuid FK | Composite PK |
| `role` | text | `member` or `admin` |
| `joined_at` | timestamptz | Server default |
| `removed_at` | timestamptz nullable | Soft removal |

### `workout_sessions`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | Generated client-side or server-side |
| `group_id` | uuid FK | Visibility boundary |
| `creator_id` | uuid FK | Current session owner |
| `starts_at` | timestamptz | Required |
| `duration_minutes` | integer | 15–360, default 60 |
| `kind` | text | `crossfit`, `open_gym`, `weightlifting`, `other` |
| `note` | text nullable | Maximum 240 characters |
| `status` | text | `scheduled` or `cancelled` |
| `created_at` | timestamptz | Server default |
| `updated_at` | timestamptz | Server default/trigger |

Indexes:

- `(group_id, starts_at)`
- `(creator_id, starts_at)`

### `session_participants`

| Column | Type | Notes |
|---|---|---|
| `session_id` | uuid FK | Composite PK |
| `user_id` | uuid FK | Composite PK |
| `source` | text | `creator`, `join`, or `invite` |
| `joined_at` | timestamptz | Server default |

The unique composite key makes join operations idempotent.

### `session_invitations`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | Used in the deep link |
| `session_id` | uuid FK | Target session |
| `inviter_id` | uuid FK | Sending member |
| `invitee_id` | uuid FK | Receiving member |
| `status` | text | `pending`, `accepted`, `declined`, `expired` |
| `email_status` | text | `pending`, `sending`, `sent`, `failed`, `suppressed` |
| `email_delivery_id` | text nullable | Internal attempt/request id |
| `sent_at` | timestamptz nullable | Provider acceptance time |
| `responded_at` | timestamptz nullable | Acceptance/decline time |
| `created_at` | timestamptz | Server default |
| `updated_at` | timestamptz | Server default/trigger |

Add a unique constraint on `(session_id, invitee_id)`. Retrying refreshes the
same row rather than generating multiple invitations.

## Database functions

Use narrowly scoped Postgres functions for multi-row atomic operations:

- `join_friend_group(code text)` — validates the hashed join code and creates
  membership.
- `create_workout_session(...)` — creates the session and creator participant
  atomically.
- `leave_workout_session(session_id uuid)` — removes membership and transfers
  ownership or cancels an empty session.
- `respond_to_workout_invitation(invitation_id uuid, response text)` — verifies
  the invitee, updates status, and inserts participation on acceptance.
- `cancel_workout_session(session_id uuid)` — creator-only cancellation and
  pending-invitation expiration.

Every function must validate `auth.uid()` explicitly and must not trust user ids
supplied by the browser.

## Row-level security

Create a narrowly scoped `security definer` membership helper owned by a
controlled privileged database role, with a fixed empty `search_path`, so its
membership lookup does not recurse through the `group_members` policy. Revoke
unneeded execution privileges and index every column used by RLS.

Required policy behavior:

### Profiles

- A user can insert and update their own profile.
- A member can select the limited profile fields of users who share an active
  group.
- Email is not present in the public profile table.

### Groups and memberships

- Active members can select their own groups and the active membership list.
- Only group administrators can remove members or change roles.
- Group joining is available only through the validated join-code function.

### Sessions

- Active group members can select sessions in their groups.
- Active members can create sessions only with `creator_id = auth.uid()`.
- Only the current creator can edit or cancel a session.
- Removed members lose read access immediately.

### Participants

- Active group members can see participants for visible sessions.
- A member can directly add or remove only themselves.
- Invitation acceptance and creator transfer use the database functions.

### Invitations

- The inviter and invitee can select an invitation.
- Only the invitee can respond.
- Creation and email state changes occur through the Edge Function's server
  client, not arbitrary browser inserts.

Negative RLS tests are mandatory: unauthenticated access, different-group
access, editing another member's session, accepting another person's invite,
and reading member email must all fail.

## Email invitation architecture

### Provider

Use a dedicated Gmail account and Google Apps Script `MailApp` for the initial
20–30-person rollout. Apps Script sends on behalf of that Gmail account and
does not require Woody to own or verify a domain. A consumer account currently
supports up to 100 email recipients per day, which is sufficient for this
group when combined with the invitation rate limits.

Keep provider-specific code behind a small `sendEmail()` interface. A
transactional provider with an authenticated custom domain can replace Apps
Script later without changing the Friends UI or invitation data model.

Production prerequisites without a custom domain:

- A dedicated Gmail account such as `woody.friends.invites@gmail.com`, with
  two-step verification and recovery details owned by the project owner.
- A Google Apps Script project authorized only for `MailApp` send access.
- An Apps Script web-app deployment that accepts signed server-to-server
  requests.
- `GOOGLE_MAIL_WEBHOOK_URL` and `GOOGLE_MAIL_WEBHOOK_SECRET` stored in Supabase
  Edge Function secrets.
- `APP_URL=https://woody-wod.vercel.app` stored in Supabase Edge Function
  secrets.
- No Gmail, Google, Supabase, or webhook secrets in Vite environment variables,
  browser bundles, or Git.

The Apps Script endpoint may be reachable on the internet, but it must reject
requests without a valid timestamped HMAC signature. The signed request body
contains a short-lived timestamp and nonce; processed nonces are retained long
enough to prevent replay. Only the Supabase Edge Function possesses the signing
secret.

### Edge Function

Create:

```text
supabase/functions/send-workout-invite/index.ts
```

Request:

```json
{
  "sessionId": "uuid",
  "inviteeUserId": "uuid"
}
```

Processing sequence:

1. Validate the caller's Supabase JWT.
2. Validate the input as UUIDs.
3. Load the session and verify it is scheduled and in the future.
4. Verify caller and invitee are active members of the session's group.
5. Verify the caller is a participant or creator.
6. Check the invitee's email preference.
7. Enforce rate limits, initially 10 successful sends per inviter per hour and
   3 sends per session/invitee per 24 hours.
8. Upsert the pending invitation idempotently.
9. Retrieve the invitee email using the server-side Supabase Auth admin client.
10. Render the email with escaped session and profile values.
11. Sign a minimal email payload with the shared HMAC secret and send it to the
    Apps Script endpoint. The script verifies the signature and timestamp,
    checks `MailApp.getRemainingDailyQuota()`, escapes all user content, and
    sends through `MailApp.sendEmail()`.
12. Mark `email_status = sent` when Apps Script returns success. The Edge
    Function's invitation/attempt id provides idempotency because MailApp does
    not expose a transactional provider id.
13. On failure, mark `email_status = failed`, log a sanitized error, and return
    a retryable response.

`Invitation sent` means the Apps Script send call completed without an error;
it does not claim that the recipient received, opened, or read it.

### Delivery callbacks

Apps Script does not provide transactional delivery or bounce webhooks. V1
records request success/failure and sanitized execution logs. Delivery events
become available only after a future move to a transactional provider. Do not
use open tracking pixels.

## Frontend architecture

Create:

```text
src/features/friends/
  FriendsScreen.tsx
  FriendsOnboardingScreen.tsx
  SessionDetailScreen.tsx
  InvitationScreen.tsx
  AddSessionSheet.tsx
  InviteFriendSheet.tsx
  SessionCard.tsx
  friendsStore.ts
  friendsRepo.ts
  friendsTypes.ts
  friendsLogic.ts
  friendsLogic.test.ts
```

Modify:

```text
src/app/App.tsx
src/app/AppShell.tsx
src/app/TabBar.tsx
src/features/auth/authStore.ts
src/features/settings/SettingsScreen.tsx
src/lib/i18n/en.ts
src/lib/i18n/t.ts
```

### Repository boundary

`friendsRepo.ts` owns Supabase queries, RPCs, the Edge Function invocation, and
Realtime subscriptions. Components do not call Supabase directly.

### State

`friendsStore.ts` manages:

- Current profile and group.
- Selected date.
- Three-day session window.
- Loading, refreshing, offline, and error states.
- Pending invitations for the current user.
- Subscription lifecycle.

Keep pure grouping, overlap, date-window, and validation logic in
`friendsLogic.ts` so it is unit-testable without React or Supabase.

### Shared data and offline behavior

Friends is network-authoritative. Do not add these tables to
`src/lib/sync/engine.ts`, whose LWW model assumes owner-only records.

V1 behavior offline:

- Show a clear `You're offline` state.
- Do not allow create, join, leave, invite, accept, decline, edit, or cancel.
- If an in-memory schedule exists, it may remain visible with `Last updated`
  and an explicit stale indicator.
- Retry automatically on browser `online` and visibility changes.

### Realtime

For this group size, use filtered Supabase Postgres Changes subscriptions for
sessions, participants, invitations, and relevant profile changes. Treat a
change event as an invalidation signal and refetch the visible window instead
of hand-merging payloads.

Also refetch when:

- The tab becomes visible.
- The browser reconnects.
- The selected date changes.
- A create/join/leave/invite/respond mutation completes.

Debounce event-driven refetches to avoid bursts.

## Validation rules

- Start time must be within the visible planning horizon for v1.
- New sessions cannot begin more than 15 minutes in the past.
- Duration must be 15–360 minutes.
- Note is trimmed and limited to 240 Unicode characters.
- Display name is trimmed, required, and limited to 50 characters.
- Kind must be one of the four supported values.
- Cancelled or ended sessions cannot be joined or invited to.
- A user cannot invite themselves.
- The invitee must be an active member of the same group.
- All important rules are repeated on the server; client validation is only
  for faster feedback.

## Accessibility requirements

- All icon-only actions have accessible names.
- Date controls expose selected state.
- Session cards have a logical heading and reading order.
- Success and error messages use an ARIA live region.
- Bottom sheets trap focus, restore focus on close, and close with Escape.
- Touch targets are at least 44 by 44 CSS pixels.
- Status is not communicated by color alone.
- Avatars always have initials or meaningful alt text.
- Reduced-motion preferences disable nonessential transitions.

## Analytics and success metrics

Do not add invasive third-party analytics for the initial private rollout.
Aggregate the operational tables or record minimal first-party events.

### Primary metric

**Coordinated workouts per week:** scheduled sessions with at least two active
participants.

### Leading indicators

- 70% of eligible group members complete Friends onboarding within 14 days.
- 50% of onboarded members publish or join at least one session per week.
- At least 30% of published sessions gain a second participant within the
  first month.
- At least 20% of delivered invitations are accepted within the first month.
- 95% or more of valid invite attempts are accepted by the email provider.
- Fewer than 2% of mutations end in an unhandled error.

These are initial hypotheses, not industry benchmarks. Revisit them after two
weeks of actual group behavior.

### Qualitative check

After two weeks, ask five members:

- Did Friends change when you trained at least once?
- Was publishing a time easier than writing to the group chat?
- Did you trust that the board was current?
- Were invitation emails useful or noisy?

## Test strategy

### Pure Vitest tests

Add tests for:

- Three-day window in `Asia/Jerusalem`.
- DST and local-midnight boundaries.
- Chronological grouping.
- `Starting soon`, `Training now`, and past-state calculations.
- 15-minute overlap suggestions.
- Duration, note, and display-name validation.
- Invite and session view-state derivation.

### Database tests

Add Supabase/pgTAP tests covering:

- Same-group read access.
- Different-group denial.
- Unauthenticated denial.
- Creator-only session edits and cancellation.
- Self-only direct participation changes.
- Invitation response restricted to invitee.
- Atomic acceptance inserts exactly one participant.
- Repeated join/accept calls are idempotent.
- Group join codes are not selectable and respect expiration/use limits.
- Removed members immediately lose access.

### Edge Function tests

- Missing or invalid JWT returns 401.
- Invalid ids return 400.
- Nonmember, different-group, self-invite, past-session, and cancelled-session
  requests are rejected.
- Muted recipients produce a suppressed result without sending email.
- Duplicate taps do not send duplicate messages.
- Mail endpoint success updates `email_status` and the internal delivery
  attempt id.
- Provider failure records failure and supports a safe retry.
- User-controlled text is escaped in HTML output.
- Rate limits are enforced.

### Manual mobile/PWA verification

- Fresh Google sign-in returns to Friends onboarding.
- Deep invitation link survives sign-in redirect.
- Installable PWA and ordinary mobile browser both open the invitation route.
- Create, join, leave, edit, cancel, invite, accept, and decline work across
  two accounts.
- Realtime changes appear across two devices.
- Offline state is unmistakable and mutations are disabled.
- Settings remains reachable after leaving the bottom bar.
- Invitation email renders in Gmail mobile, Gmail web, and Apple Mail.

### Full regression

Run:

```bash
npm test
npm run build
```

Verify timer restore, personal sync, WOD sheets, logs, lifts, and PWA update
behavior remain unchanged.

## Acceptance criteria

### Authentication and onboarding

- Given a signed-out user opens Friends, when they complete Google sign-in,
  then successful authentication returns them to Friends onboarding.
- Given a signed-in user lacks a profile or membership, when they open Friends,
  then they cannot see group data until onboarding is complete.
- Given a valid join code, when the user joins, then one active membership is
  created and the board opens.
- Given an invalid, expired, or exhausted join code, then no membership is
  created and a specific error is shown.

### Board and sessions

- Given an active member, when Friends opens online, then sessions for today
  and the next two group-local dates appear chronologically.
- Given valid session data, when the member creates it, then the session and
  creator participation are both saved exactly once.
- Given a nearby session within 15 minutes, when the member submits a new time,
  then the UI offers to join it before creating separately.
- Given an active session, when a member joins or leaves, then all subscribed
  clients update promptly.
- Given a creator cancels, then the session disappears from the board and
  pending invitation pages show cancelled.

### Email invitations

- Given a registered same-group friend with email invitations enabled, when a
  participating member invites them, then exactly one pending invitation is
  stored and one email send is requested.
- The UI shows `Invitation sent` only after Apps Script reports a successful
  MailApp send call.
- If email sending fails after the invitation is stored, the recipient can
  still see and answer it in Friends, and the inviter sees a retryable email
  error rather than a false success.
- The invitation email contains inviter name, current session details, and a
  deep link, but no private email addresses or performance data.
- Given the recipient accepts, then invitation status becomes accepted and
  they become a participant exactly once.
- Given the recipient declines, then they do not become a participant.
- Given a different signed-in account opens the link, then no invitation data
  is revealed.
- Given the recipient has muted invitations, then no email is sent and the
  inviter receives a clear, non-sensitive message.

### Privacy and resilience

- A user cannot read or mutate any Friends data for a group they do not belong
  to.
- Group members cannot view one another's email addresses, logs, lifts,
  maxes, or timer history through Friends.
- Offline users are never shown an apparently live board without a stale
  indicator.
- Retrying a successful mutation does not create duplicates.

## Implementation phases

### Phase 0 — infrastructure and decisions (1–2 days)

- Verify the existing `https://woody-wod.vercel.app` deployment and configure
  it in Supabase Auth redirect settings and Google OAuth.
- Confirm the visible group name and initial administrator.
- Create the dedicated Gmail sender account.
- Create and authorize the Google Apps Script MailApp endpoint.
- Generate and store the Edge Function-to-Apps-Script signing secret.
- Confirm `Asia/Jerusalem` as the group timezone.
- Confirm initial member onboarding through a shared private join code.

Exit: the existing production URL, Google sign-in, Gmail sender, group identity,
and secrets plan are working without a custom domain.

### Phase 1 — database, RLS, and profile foundation (2–3 days)

- Add `0002_friends.sql` with tables, constraints, indexes, triggers, and RPCs.
- Extend profiles and create group membership.
- Add RLS policies and pgTAP tests.
- Seed the initial group and administrator through a controlled migration or
  one-time admin script.
- Implement Google sign-in and preserve Friends/deep-link return paths.

Exit: two test accounts in one group can read only their group, and all
cross-group/unauthenticated security tests pass.

### Phase 2 — schedule board and participation (3–4 days)

- Add routes, navigation, onboarding, repository, store, and pure logic.
- Implement three-day board and session cards.
- Implement create, overlap suggestion, edit, cancel, join, and leave.
- Add offline/loading/error states and visibility refresh.
- Add Realtime invalidation subscriptions.

Exit: two members can coordinate a workout across two devices without email.

### Phase 3 — email invitation flow (2–4 days)

- Add invitation schema behaviors and response route.
- Implement member picker and invitation states.
- Implement the authenticated Edge Function.
- Configure the Apps Script endpoint, HMAC secret, and HTML/plain-text email.
- Implement accept, decline, expiry, cancellation, mute, dedupe, retry, and
  rate limiting.
- Test deep links through signed-in and signed-out states.

Exit: one member can invite another registered member by email and the
recipient can safely join from the link.

### Phase 4 — hardening and controlled rollout (2–3 days)

- Run accessibility pass and mobile/PWA manual matrix.
- Run full automated regression and production build.
- Review Edge Function logs and sanitize error output.
- Verify Gmail sender security, Apps Script quota reporting, and email
  rendering.
- Pilot with 5–8 members for three days.
- Fix blockers, then enable for the full group.

Exit: no critical security, delivery, or coordination blockers remain.

### Overall estimate

Approximately **10–15 focused engineering days** for a production-ready v1.
This includes Google OAuth and the no-domain Gmail/Apps Script sender. Custom
domains, push notifications, email OTP fallback, and Hebrew/RTL are not
included.

## Detailed engineering checklist

### Database

- [ ] Create `supabase/migrations/0002_friends.sql`.
- [ ] Extend `profiles` safely for existing users.
- [ ] Create group, join-code, membership, session, participant, and
      invitation tables.
- [ ] Add checks, foreign keys, unique constraints, and indexes.
- [ ] Add `updated_at` trigger.
- [ ] Add membership helper and RLS policies.
- [ ] Add atomic RPC functions.
- [ ] Add RLS and RPC tests.

### Authentication and onboarding

- [ ] Add Google OAuth and preserve Friends/deep-link return paths.
- [ ] Add display-name/profile bootstrap.
- [ ] Add group-code onboarding.
- [ ] Add invitation-email preference.
- [ ] Ensure personal offline features remain available when signed out.

### Friends frontend

- [ ] Add Friends routes and replace Settings bottom tab.
- [ ] Add settings/profile header action.
- [ ] Add repository and Zustand store.
- [ ] Add pure date/grouping/validation logic and tests.
- [ ] Add three-day board, cards, empty state, and time states.
- [ ] Add create/edit/cancel and join/leave flows.
- [ ] Add overlap suggestion.
- [ ] Add Realtime invalidation and reconnect refresh.
- [ ] Add explicit offline state.
- [ ] Route strings through the existing i18n layer.

### Email invitations

- [ ] Create `send-workout-invite` Edge Function.
- [ ] Validate JWT, membership, session, invitee, preference, and limits.
- [ ] Retrieve recipient email server-side.
- [ ] Add provider abstraction and Gmail/Apps Script implementation.
- [ ] Add timestamped HMAC verification and replay protection.
- [ ] Add HTML and plain-text templates.
- [ ] Add secret configuration documentation.
- [ ] Add idempotency, status tracking, sanitized logs, and retry.
- [ ] Add member picker and success/failure states.
- [ ] Add pending-invitation section and Friends badge as the delivery
      fallback.
- [ ] Add invitation page and atomic response flow.
- [ ] Test wrong-account, expired, cancelled, duplicate, and muted states.

### Quality and rollout

- [ ] Complete automated test plan.
- [ ] Complete two-account/two-device manual pass.
- [ ] Complete accessibility review.
- [ ] Verify Gmail and Apple Mail rendering.
- [ ] Pilot with 5–8 members.
- [ ] Measure onboarding, publishing, joining, and invitation acceptance.
- [ ] Review after two weeks and choose P1 work from evidence.

## Rollback strategy

- Protect the Friends navigation with a remotely configurable group/feature
  flag or a server-readable availability check.
- If email delivery fails, disable only email sending. Invitation rows, the
  in-app pending-invitation section, schedule viewing, publishing, and joining
  continue to work.
- If shared data has a security issue, remove the Friends navigation and revoke
  authenticated grants on the new tables while leaving personal features
  intact.
- Migrations are additive. Do not remove or rewrite the existing personal-data
  tables or sync envelope.

## Open questions

### Blocking before implementation

1. What dedicated Gmail address should send invitation emails?
2. Who controls and recovers that Gmail account?
3. Who is the initial group administrator?
4. What exact group name should appear in onboarding and emails?

### Non-blocking

1. What are the group's most common class times? Use this to prioritize quick
   time choices in P1.
2. Should an email show all current participant names or only the inviter and
   participant count?
3. Should invitation emails be English-only at launch or should Hebrew/RTL be
   pulled forward?
4. After the first month, is email sufficient or are invitations being missed
   often enough to justify push notifications?

## Definition of done

Friends is done for v1 when a registered group member can publish a workout,
another member can discover and join it, a participating member can email a
registered friend an invitation without seeing their email address, and the
recipient can securely accept from the link. The feature must preserve the
privacy and offline behavior of the rest of Woody, pass automated and manual
security tests, and operate successfully during a controlled group pilot.
