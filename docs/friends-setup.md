# Friends production setup

The app URL is `https://woody-wod.vercel.app`. The Friends UI works after the
Supabase migration and Google authentication are configured. Email delivery is
optional: invitations are stored in-app first, so a mail outage does not lose an
invitation.

## 1. Apply and deploy

```sh
supabase db push
supabase functions deploy send-workout-invite
```

Set these Vercel variables for Production and Preview:

```text
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

## 2. Enable Google sign-in

In Google Cloud, create a Web OAuth client and add Supabase's callback URL as an
authorized redirect URI:

```text
https://PROJECT_REF.supabase.co/auth/v1/callback
```

Add that client ID and secret to Supabase Auth > Providers > Google. In Supabase
Auth > URL Configuration, set the Site URL to
`https://woody-wod.vercel.app` and allow these redirects:

```text
https://woody-wod.vercel.app/**
http://localhost:5173/**
```

The localhost entry is for development only and can be removed later.

## 3. Create the first private group

The first admin signs in once, opens Friends, and submits their display name.
The group-code attempt can fail at this point; their profile has still been
created. In the Supabase SQL editor, replace the values below and run the block:

```sql
do $$
declare
  admin_id uuid := 'REPLACE_WITH_AUTH_USER_ID';
  new_group_id uuid;
begin
  insert into public.friend_groups (name, created_by)
  values ('Woody CrossFit', admin_id)
  returning id into new_group_id;

  insert into public.group_members (group_id, user_id, role)
  values (new_group_id, admin_id, 'admin');

  insert into public.group_join_codes (group_id, code_hash, created_by)
  values (
    new_group_id,
    extensions.digest(lower(trim('REPLACE_WITH_PRIVATE_CODE')), 'sha256'),
    admin_id
  );
end $$;
```

Share the private code with the 20–30 group members. Store the code in a
password manager; it is hashed in the database and cannot be read back.

## 4. Enable email invitations without a custom domain

Use a dedicated Gmail account and follow
[`supabase/functions/send-workout-invite/README.md`](../supabase/functions/send-workout-invite/README.md).
The sender uses Google Apps Script's `MailApp`, authenticated by an HMAC secret.
Then set these Edge Function secrets:

```text
APP_URL=https://woody-wod.vercel.app
GOOGLE_MAIL_WEBHOOK_URL=...
GOOGLE_MAIL_WEBHOOK_SECRET=...
```

If these secrets are absent or Gmail rejects a message, the recipient still sees
the pending invitation in Friends.
