begin;

create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000001', 'alex@example.com'),
  ('00000000-0000-4000-8000-000000000002', 'sam@example.com'),
  ('00000000-0000-4000-8000-000000000003', 'outsider@example.com');

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000001', 'Alex'),
  ('00000000-0000-4000-8000-000000000002', 'Sam'),
  ('00000000-0000-4000-8000-000000000003', 'Outsider');

insert into public.friend_groups (id, name, created_by)
values (
  '10000000-0000-4000-8000-000000000001',
  'Woody CrossFit',
  '00000000-0000-4000-8000-000000000001'
);

insert into public.group_join_codes (group_id, code_hash, created_by)
values (
  '10000000-0000-4000-8000-000000000001',
  extensions.digest('woody-crew', 'sha256'),
  '00000000-0000-4000-8000-000000000001'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  public.join_friend_group('WOODY-CREW'),
  '10000000-0000-4000-8000-000000000001'::uuid,
  'join codes are case insensitive'
);
select ok(
  public.is_friend_group_member('10000000-0000-4000-8000-000000000001'),
  'first athlete becomes a group member'
);

select lives_ok(
  $$select public.create_friend_session(
    '10000000-0000-4000-8000-000000000001',
    now() + interval '1 hour',
    60,
    'crossfit',
    '17:00 class'
  )$$,
  'a member can create a session through the RPC'
);
select is(
  (select count(*) from public.workout_sessions),
  1::bigint,
  'the session is visible to its group'
);
select is(
  (select count(*) from public.session_participants),
  1::bigint,
  'the creator is joined automatically'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select is(
  public.join_friend_group('woody-crew'),
  '10000000-0000-4000-8000-000000000001'::uuid,
  'a second athlete can join with the same code'
);
select lives_ok(
  $$select public.join_friend_session((select id from public.workout_sessions limit 1))$$,
  'the second athlete can join the session'
);
select is(
  (select count(*) from public.session_participants),
  2::bigint,
  'both athletes appear as participants'
);
select throws_ok(
  $$select public.update_friend_session(
    (select id from public.workout_sessions limit 1),
    now() + interval '2 hours',
    60,
    'crossfit',
    null
  )$$,
  'P0001',
  'Only the workout creator can edit it',
  'a non-creator cannot edit the session'
);
select throws_ok(
  $$insert into public.workout_sessions (
    group_id, creator_id, starts_at, duration_minutes, kind
  ) values (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    now() + interval '30 days',
    60,
    'crossfit'
  )$$,
  '42501',
  null,
  'direct session writes are blocked'
);

set local role postgres;
insert into public.session_invitations (
  id, session_id, inviter_id, invitee_id
) values (
  '20000000-0000-4000-8000-000000000001',
  (select id from public.workout_sessions limit 1),
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select is(
  (select count(*) from public.session_invitations),
  1::bigint,
  'the invitee can read their invitation'
);
select lives_ok(
  $$select public.respond_to_friend_invitation(
    '20000000-0000-4000-8000-000000000001',
    'accepted'
  )$$,
  'the invitee can accept'
);
select lives_ok(
  $$select public.respond_to_friend_invitation(
    '20000000-0000-4000-8000-000000000001',
    'accepted'
  )$$,
  'acceptance is idempotent'
);
select is(
  (select count(*) from public.session_participants),
  2::bigint,
  'repeated acceptance does not duplicate participants'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
select is(
  (select count(*) from public.workout_sessions),
  0::bigint,
  'an athlete outside the group cannot see its sessions'
);
select throws_ok(
  $$select * from public.group_join_codes$$,
  '42501',
  null,
  'join-code hashes cannot be selected by app users'
);

select * from finish();
rollback;
