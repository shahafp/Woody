# Workout invitation email setup

The browser invokes the authenticated `send-workout-invite` Supabase Edge
Function. That function validates the caller, group, workout, recipient,
preference, duplicate state, and rate limit before calling Google Apps Script.

## Google Apps Script

1. Create a dedicated Gmail account for Woody invitations and enable two-step
   verification and recovery options.
2. Create an Apps Script project while signed into that account.
3. Paste `google-apps-script.gs` into the project.
4. Add a Script Property named `WEBHOOK_SECRET` with a random value of at least
   32 bytes.
5. Deploy as a web app, executing as the owner. The endpoint is internet
   reachable because Apps Script does not accept Supabase JWTs; the HMAC,
   timestamp, nonce, Edge Function authorization, and invite rate limits are
   the security boundary.
6. Authorize the script's MailApp permission and copy the deployment URL.

## Supabase secrets

Set the matching values without committing them:

```bash
supabase secrets set APP_URL=https://woody-wod.vercel.app
supabase secrets set GOOGLE_MAIL_WEBHOOK_URL=<apps-script-web-app-url>
supabase secrets set GOOGLE_MAIL_WEBHOOK_SECRET=<same-random-secret>
```

Deploy:

```bash
supabase functions deploy send-workout-invite
```

Invitation rows remain visible in the app when email delivery fails.
