-- Friends: private group workout coordination.
-- Shared rows are server-authoritative and deliberately separate from the
-- owner-only local-first sync envelope in 0001_init.sql.

create extension if not exists pgcrypto with schema extensions;

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists email_invites_enabled boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

create table public.friend_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  timezone text not null default 'Asia/Jerusalem',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.friend_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'admin')),
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (group_id, user_id)
);

create table public.group_join_codes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.friend_groups(id) on delete cascade,
  code_hash bytea not null,
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  uses integer not null default 0 check (uses >= 0),
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create unique index group_join_codes_active_hash_idx
  on public.group_join_codes (code_hash)
  where active;
create index group_join_codes_group_idx on public.group_join_codes (group_id);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.friend_groups(id) on delete cascade,
  creator_id uuid not null references public.profiles(id),
  starts_at timestamptz not null,
  duration_minutes integer not null default 60
    check (duration_minutes between 15 and 360),
  kind text not null check (kind in ('crossfit', 'open_gym', 'weightlifting', 'other')),
  note text check (note is null or char_length(note) <= 240),
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workout_sessions_group_starts_idx
  on public.workout_sessions (group_id, starts_at)
  where status = 'scheduled';
create index workout_sessions_creator_starts_idx
  on public.workout_sessions (creator_id, starts_at desc);

create table public.session_participants (
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null default 'join' check (source in ('creator', 'join', 'invite')),
  joined_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create index session_participants_user_idx
  on public.session_participants (user_id, joined_at desc);

create table public.session_invitations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id),
  invitee_id uuid not null references public.profiles(id),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'expired')),
  email_status text not null default 'pending'
    check (email_status in ('pending', 'sending', 'sent', 'failed', 'suppressed')),
  email_delivery_id text,
  sent_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_invitations_not_self check (inviter_id <> invitee_id),
  unique (session_id, invitee_id)
);

create index session_invitations_invitee_idx
  on public.session_invitations (invitee_id, status, created_at desc);
create index session_invitations_inviter_rate_idx
  on public.session_invitations (inviter_id, sent_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger friend_groups_touch_updated_at
  before update on public.friend_groups
  for each row execute function public.touch_updated_at();
create trigger workout_sessions_touch_updated_at
  before update on public.workout_sessions
  for each row execute function public.touch_updated_at();
create trigger session_invitations_touch_updated_at
  before update on public.session_invitations
  for each row execute function public.touch_updated_at();

-- SECURITY DEFINER helpers avoid recursive group_members policies. They expose
-- booleans only and have a fixed search path.
create or replace function public.is_friend_group_member(
  target_group_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = target_user_id
      and gm.removed_at is null
  );
$$;

create or replace function public.is_friend_group_admin(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = auth.uid()
      and gm.role = 'admin'
      and gm.removed_at is null
  );
$$;

create or replace function public.shares_friend_group(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = auth.uid()
      and mine.removed_at is null
      and theirs.user_id = target_user_id
      and theirs.removed_at is null
  );
$$;

create or replace function public.can_access_friend_session(target_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workout_sessions ws
    join public.group_members gm on gm.group_id = ws.group_id
    where ws.id = target_session_id
      and gm.user_id = auth.uid()
      and gm.removed_at is null
  );
$$;

revoke all on function public.is_friend_group_member(uuid, uuid) from public;
revoke all on function public.is_friend_group_admin(uuid) from public;
revoke all on function public.shares_friend_group(uuid) from public;
revoke all on function public.can_access_friend_session(uuid) from public;
grant execute on function public.is_friend_group_member(uuid, uuid) to authenticated;
grant execute on function public.is_friend_group_admin(uuid) to authenticated;
grant execute on function public.shares_friend_group(uuid) to authenticated;
grant execute on function public.can_access_friend_session(uuid) to authenticated;

alter table public.friend_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_join_codes enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.session_participants enable row level security;
alter table public.session_invitations enable row level security;

create policy "members view friend groups" on public.friend_groups
  for select to authenticated
  using (public.is_friend_group_member(id));

create policy "members view memberships" on public.group_members
  for select to authenticated
  using (public.is_friend_group_member(group_id));
create policy "admins update memberships" on public.group_members
  for update to authenticated
  using (public.is_friend_group_admin(group_id))
  with check (public.is_friend_group_admin(group_id));

create policy "members view sessions" on public.workout_sessions
  for select to authenticated
  using (public.is_friend_group_member(group_id));
create policy "members create own sessions" on public.workout_sessions
  for insert to authenticated
  with check (
    creator_id = (select auth.uid())
    and public.is_friend_group_member(group_id)
  );
create policy "creators update sessions" on public.workout_sessions
  for update to authenticated
  using (creator_id = (select auth.uid()) and public.is_friend_group_member(group_id))
  with check (creator_id = (select auth.uid()) and public.is_friend_group_member(group_id));

create policy "members view participants" on public.session_participants
  for select to authenticated
  using (public.can_access_friend_session(session_id));
create policy "members join themselves" on public.session_participants
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.can_access_friend_session(session_id)
  );
create policy "members leave themselves" on public.session_participants
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    and public.can_access_friend_session(session_id)
  );

create policy "invitation parties view invitations" on public.session_invitations
  for select to authenticated
  using (inviter_id = (select auth.uid()) or invitee_id = (select auth.uid()));

create policy "same group profiles are visible" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_friend_group(id));

revoke all on public.friend_groups from anon, authenticated;
revoke all on public.group_members from anon, authenticated;
revoke all on public.group_join_codes from anon, authenticated;
revoke all on public.workout_sessions from anon, authenticated;
revoke all on public.session_participants from anon, authenticated;
revoke all on public.session_invitations from anon, authenticated;
grant select on public.friend_groups, public.group_members to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.workout_sessions to authenticated;
grant select on public.session_participants to authenticated;
grant select on public.session_invitations to authenticated;

create or replace function public.join_friend_group(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched public.group_join_codes%rowtype;
  current_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  select display_name into current_name from public.profiles where id = auth.uid();
  if current_name is null or char_length(trim(current_name)) = 0 then
    raise exception 'Create your Friends profile first';
  end if;

  select * into matched
  from public.group_join_codes
  where active
    and code_hash = extensions.digest(lower(trim(p_code)), 'sha256')
    and (expires_at is null or expires_at > now())
    and (max_uses is null or uses < max_uses)
  for update
  limit 1;

  if matched.id is null then
    raise exception 'Invalid or expired group code';
  end if;

  insert into public.group_members (group_id, user_id)
  values (matched.group_id, auth.uid())
  on conflict (group_id, user_id)
  do update set removed_at = null;

  update public.group_join_codes set uses = uses + 1 where id = matched.id;
  return matched.group_id;
end;
$$;

create or replace function public.create_friend_session(
  p_group_id uuid,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_kind text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not public.is_friend_group_member(p_group_id) then
    raise exception 'Not a group member';
  end if;
  if p_starts_at < now() - interval '15 minutes'
    or p_starts_at > now() + interval '4 days' then
    raise exception 'Workout time is outside the planning window';
  end if;
  if p_duration_minutes not between 15 and 360 then
    raise exception 'Invalid workout duration';
  end if;
  if p_kind not in ('crossfit', 'open_gym', 'weightlifting', 'other') then
    raise exception 'Invalid workout type';
  end if;
  if p_note is not null and char_length(p_note) > 240 then
    raise exception 'Workout note is too long';
  end if;

  insert into public.workout_sessions (
    group_id, creator_id, starts_at, duration_minutes, kind, note
  ) values (
    p_group_id, auth.uid(), p_starts_at, p_duration_minutes, p_kind,
    nullif(trim(p_note), '')
  ) returning id into new_id;

  insert into public.session_participants (session_id, user_id, source)
  values (new_id, auth.uid(), 'creator');
  return new_id;
end;
$$;

create or replace function public.join_friend_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.workout_sessions%rowtype;
begin
  select * into target from public.workout_sessions where id = p_session_id;
  if target.id is null or target.status <> 'scheduled' then
    raise exception 'Workout is not available';
  end if;
  if not public.is_friend_group_member(target.group_id) then
    raise exception 'Not a group member';
  end if;
  if target.starts_at + make_interval(mins => target.duration_minutes) <= now() then
    raise exception 'Workout has ended';
  end if;
  insert into public.session_participants (session_id, user_id, source)
  values (p_session_id, auth.uid(), 'join')
  on conflict (session_id, user_id) do nothing;
end;
$$;

create or replace function public.update_friend_session(
  p_session_id uuid,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_kind text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_starts_at < now() - interval '15 minutes'
    or p_starts_at > now() + interval '4 days' then
    raise exception 'Workout time is outside the planning window';
  end if;
  if p_duration_minutes not between 15 and 360 then
    raise exception 'Invalid workout duration';
  end if;
  if p_kind not in ('crossfit', 'open_gym', 'weightlifting', 'other') then
    raise exception 'Invalid workout type';
  end if;
  if p_note is not null and char_length(p_note) > 240 then
    raise exception 'Workout note is too long';
  end if;

  update public.workout_sessions
  set starts_at = p_starts_at,
      duration_minutes = p_duration_minutes,
      kind = p_kind,
      note = nullif(trim(p_note), '')
  where id = p_session_id
    and creator_id = auth.uid()
    and public.is_friend_group_member(group_id)
    and status = 'scheduled';
  if not found then
    raise exception 'Only the workout creator can edit it';
  end if;
end;
$$;

create or replace function public.leave_friend_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.workout_sessions%rowtype;
  next_creator uuid;
begin
  select * into target from public.workout_sessions where id = p_session_id for update;
  if target.id is null or not public.is_friend_group_member(target.group_id) then
    raise exception 'Workout is not available';
  end if;
  delete from public.session_participants
  where session_id = p_session_id and user_id = auth.uid();

  if target.creator_id = auth.uid() then
    select user_id into next_creator
    from public.session_participants
    where session_id = p_session_id
    order by joined_at
    limit 1;
    if next_creator is null then
      update public.workout_sessions set status = 'cancelled' where id = p_session_id;
      update public.session_invitations
      set status = 'expired'
      where session_id = p_session_id and status = 'pending';
    else
      update public.workout_sessions set creator_id = next_creator where id = p_session_id;
    end if;
  end if;
end;
$$;

create or replace function public.cancel_friend_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.workout_sessions
  set status = 'cancelled'
  where id = p_session_id
    and creator_id = auth.uid()
    and public.is_friend_group_member(group_id)
    and status = 'scheduled';
  if not found then
    raise exception 'Only the workout creator can cancel it';
  end if;
  update public.session_invitations
  set status = 'expired'
  where session_id = p_session_id and status = 'pending';
end;
$$;

create or replace function public.respond_to_friend_invitation(
  p_invitation_id uuid,
  p_response text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.session_invitations%rowtype;
  target_session public.workout_sessions%rowtype;
begin
  if p_response not in ('accepted', 'declined') then
    raise exception 'Invalid invitation response';
  end if;
  select * into target
  from public.session_invitations
  where id = p_invitation_id
  for update;
  if target.id is null or target.invitee_id <> auth.uid() then
    raise exception 'Invitation is not available';
  end if;
  if target.status = p_response then return; end if;
  if target.status <> 'pending' then
    raise exception 'Invitation has already been answered';
  end if;
  select * into target_session from public.workout_sessions where id = target.session_id;
  if not public.is_friend_group_member(target_session.group_id) then
    raise exception 'You are no longer a member of this group';
  end if;
  if target_session.status <> 'scheduled'
    or target_session.starts_at + make_interval(mins => target_session.duration_minutes) <= now() then
    update public.session_invitations set status = 'expired' where id = target.id;
    raise exception 'Workout is no longer available';
  end if;
  update public.session_invitations
  set status = p_response, responded_at = now()
  where id = target.id;
  if p_response = 'accepted' then
    insert into public.session_participants (session_id, user_id, source)
    values (target.session_id, auth.uid(), 'invite')
    on conflict (session_id, user_id) do nothing;
  end if;
end;
$$;

revoke all on function public.join_friend_group(text) from public;
revoke all on function public.create_friend_session(uuid, timestamptz, integer, text, text) from public;
revoke all on function public.join_friend_session(uuid) from public;
revoke all on function public.update_friend_session(uuid, timestamptz, integer, text, text) from public;
revoke all on function public.leave_friend_session(uuid) from public;
revoke all on function public.cancel_friend_session(uuid) from public;
revoke all on function public.respond_to_friend_invitation(uuid, text) from public;
grant execute on function public.join_friend_group(text) to authenticated;
grant execute on function public.create_friend_session(uuid, timestamptz, integer, text, text) to authenticated;
grant execute on function public.join_friend_session(uuid) to authenticated;
grant execute on function public.update_friend_session(uuid, timestamptz, integer, text, text) to authenticated;
grant execute on function public.leave_friend_session(uuid) to authenticated;
grant execute on function public.cancel_friend_session(uuid) to authenticated;
grant execute on function public.respond_to_friend_invitation(uuid, text) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.workout_sessions;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.session_participants;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.session_invitations;
exception when duplicate_object then null;
end $$;
