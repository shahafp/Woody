import { supabase } from '@/lib/sync/supabase'
import { addDays, zonedDateTimeToIso } from './friendsLogic'
import type {
  FriendBootstrap,
  FriendGroup,
  FriendInvitation,
  FriendParticipant,
  FriendProfile,
  FriendSession,
  InvitationStatus,
  SessionDraft,
} from './friendsTypes'

type Row = Record<string, unknown>

function client() {
  if (!supabase) throw new Error('Friends is not configured')
  return supabase
}

function profileFrom(row: Row): FriendProfile {
  return {
    id: String(row.id),
    displayName: String(row.display_name ?? 'Friend'),
    avatarUrl: typeof row.avatar_url === 'string' ? row.avatar_url : null,
    emailInvitesEnabled: row.email_invites_enabled !== false,
  }
}

function participantFrom(row: Row): FriendParticipant {
  const profile = (row.profiles ?? {}) as Row
  return {
    userId: String(row.user_id),
    displayName: String(profile.display_name ?? 'Friend'),
    avatarUrl: typeof profile.avatar_url === 'string' ? profile.avatar_url : null,
    joinedAt: String(row.joined_at),
  }
}

function sessionFrom(row: Row): FriendSession {
  const participants = Array.isArray(row.session_participants)
    ? row.session_participants.map((item) => participantFrom(item as Row))
    : []
  return {
    id: String(row.id),
    groupId: String(row.group_id),
    creatorId: String(row.creator_id),
    startsAt: String(row.starts_at),
    durationMinutes: Number(row.duration_minutes),
    kind: row.kind as FriendSession['kind'],
    note: typeof row.note === 'string' ? row.note : null,
    status: row.status as FriendSession['status'],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    participants,
  }
}

const sessionSelect = `
  id, group_id, creator_id, starts_at, duration_minutes, kind, note, status,
  created_at, updated_at,
  session_participants(user_id, joined_at, profiles(display_name, avatar_url))
`

export async function getFriendBootstrap(): Promise<FriendBootstrap> {
  const db = client()
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) return { profile: null, group: null }

  const [profileResult, memberResult] = await Promise.all([
    db.from('profiles').select('id, display_name, avatar_url, email_invites_enabled').eq('id', auth.user.id).maybeSingle(),
    db.from('group_members').select('role, friend_groups(id, name, timezone)').eq('user_id', auth.user.id).is('removed_at', null).limit(1).maybeSingle(),
  ])
  if (profileResult.error) throw profileResult.error
  if (memberResult.error) throw memberResult.error

  const profile = profileResult.data ? profileFrom(profileResult.data as Row) : null
  const membership = memberResult.data as Row | null
  const groupRow = membership?.friend_groups as Row | undefined
  const group: FriendGroup | null = groupRow
    ? {
        id: String(groupRow.id),
        name: String(groupRow.name),
        timezone: String(groupRow.timezone),
        role: membership?.role === 'admin' ? 'admin' : 'member',
      }
    : null
  return { profile, group }
}

export async function saveFriendProfile(
  displayName: string,
  avatarUrl?: string | null,
): Promise<void> {
  const db = client()
  const { data: auth, error: authError } = await db.auth.getUser()
  if (authError || !auth.user) throw authError ?? new Error('Sign in first')
  const { error } = await db.from('profiles').upsert({
    id: auth.user.id,
    display_name: displayName.trim(),
    avatar_url: avatarUrl ?? auth.user.user_metadata.avatar_url ?? null,
  })
  if (error) throw error
}

export async function updateFriendEmailPreference(enabled: boolean): Promise<void> {
  const db = client()
  const { data: auth, error: authError } = await db.auth.getUser()
  if (authError || !auth.user) throw authError ?? new Error('Sign in first')
  const { error } = await db
    .from('profiles')
    .update({ email_invites_enabled: enabled })
    .eq('id', auth.user.id)
  if (error) throw error
}

export async function joinFriendGroup(code: string): Promise<void> {
  const { error } = await client().rpc('join_friend_group', { p_code: code.trim() })
  if (error) throw error
}

export async function listFriendMembers(groupId: string): Promise<FriendProfile[]> {
  const { data, error } = await client()
    .from('group_members')
    .select('profiles(id, display_name, avatar_url, email_invites_enabled)')
    .eq('group_id', groupId)
    .is('removed_at', null)
  if (error) throw error
  return (data ?? [])
    .map((item) => (item as Row).profiles as Row)
    .filter(Boolean)
    .map(profileFrom)
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export async function listFriendSessions(
  groupId: string,
  firstDate: string,
  lastDate: string,
  timeZone: string,
): Promise<FriendSession[]> {
  const start = zonedDateTimeToIso(firstDate, '00:00', timeZone)
  const end = zonedDateTimeToIso(addDays(lastDate, 1), '00:00', timeZone)
  const { data, error } = await client()
    .from('workout_sessions')
    .select(sessionSelect)
    .eq('group_id', groupId)
    .gte('starts_at', start)
    .lt('starts_at', end)
    .order('starts_at')
  if (error) throw error
  return (data ?? []).map((row) => sessionFrom(row as Row))
}

export async function createFriendSession(
  group: FriendGroup,
  draft: SessionDraft,
): Promise<string> {
  const { data, error } = await client().rpc('create_friend_session', {
    p_group_id: group.id,
    p_starts_at: zonedDateTimeToIso(draft.date, draft.time, group.timezone),
    p_duration_minutes: draft.durationMinutes,
    p_kind: draft.kind,
    p_note: draft.note.trim() || null,
  })
  if (error) throw error
  return String(data)
}

export async function updateFriendSession(
  group: FriendGroup,
  sessionId: string,
  draft: SessionDraft,
): Promise<void> {
  const { error } = await client().rpc('update_friend_session', {
    p_session_id: sessionId,
    p_starts_at: zonedDateTimeToIso(draft.date, draft.time, group.timezone),
    p_duration_minutes: draft.durationMinutes,
    p_kind: draft.kind,
    p_note: draft.note.trim() || null,
  })
  if (error) throw error
}

async function callSessionRpc(name: string, sessionId: string): Promise<void> {
  const { error } = await client().rpc(name, { p_session_id: sessionId })
  if (error) throw error
}

export const joinSession = (sessionId: string) => callSessionRpc('join_friend_session', sessionId)
export const leaveSession = (sessionId: string) => callSessionRpc('leave_friend_session', sessionId)
export const cancelSession = (sessionId: string) => callSessionRpc('cancel_friend_session', sessionId)

export async function sendFriendInvitation(
  sessionId: string,
  inviteeId: string,
): Promise<{ emailStatus: string }> {
  const { data, error } = await client().functions.invoke('send-workout-invite', {
    body: { sessionId, inviteeUserId: inviteeId },
  })
  if (error) throw error
  const result = data as Row
  return {
    emailStatus: String(
      result.emailStatus ?? (result.sent === true ? 'sent' : 'failed'),
    ),
  }
}

export async function listFriendInvitations(invitationId?: string): Promise<FriendInvitation[]> {
  const db = client()
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) return []
  let query = db
    .from('session_invitations')
    .select('id, session_id, inviter_id, invitee_id, status, email_status, created_at')
    .eq('invitee_id', auth.user.id)
    .order('created_at', { ascending: false })
  query = invitationId ? query.eq('id', invitationId) : query.eq('status', 'pending')
  const { data, error } = await query
  if (error) throw error
  const rows = (data ?? []) as Row[]
  if (!rows.length) return []

  const sessionIds = rows.map((row) => String(row.session_id))
  const inviterIds = rows.map((row) => String(row.inviter_id))
  const [sessionsResult, profilesResult] = await Promise.all([
    db.from('workout_sessions').select(sessionSelect).in('id', sessionIds),
    db.from('profiles').select('id, display_name, avatar_url, email_invites_enabled').in('id', inviterIds),
  ])
  if (sessionsResult.error) throw sessionsResult.error
  if (profilesResult.error) throw profilesResult.error
  const sessions = new Map((sessionsResult.data ?? []).map((row) => {
    const session = sessionFrom(row as Row)
    return [session.id, session]
  }))
  const profiles = new Map((profilesResult.data ?? []).map((row) => {
    const profile = profileFrom(row as Row)
    return [profile.id, profile]
  }))

  return rows.flatMap((row) => {
    const session = sessions.get(String(row.session_id))
    const inviter = profiles.get(String(row.inviter_id))
    if (!session || !inviter) return []
    return [{
      id: String(row.id),
      sessionId: session.id,
      inviterId: inviter.id,
      inviteeId: String(row.invitee_id),
      status: row.status as FriendInvitation['status'],
      emailStatus: row.email_status as FriendInvitation['emailStatus'],
      createdAt: String(row.created_at),
      inviter,
      session,
    }]
  })
}

export async function respondToInvitation(
  invitationId: string,
  status: Extract<InvitationStatus, 'accepted' | 'declined'>,
): Promise<void> {
  const { error } = await client().rpc('respond_to_friend_invitation', {
    p_invitation_id: invitationId,
    p_response: status,
  })
  if (error) throw error
}

export function subscribeToFriendChanges(onChange: () => void): () => void {
  if (!supabase) return () => undefined
  const channel = supabase
    .channel('friends-board')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'workout_sessions' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'session_participants' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'session_invitations' }, onChange)
    .subscribe()
  return () => {
    void supabase?.removeChannel(channel)
  }
}
