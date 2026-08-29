import { createClient } from 'npm:@supabase/supabase-js@2'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_INVITES_PER_HOUR = 10

interface InviteRequest {
  sessionId: string
  inviteeUserId: string
}

interface EmailPayload {
  deliveryId: string
  to: string
  subject: string
  textBody: string
  htmlBody: string
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Cache-Control': 'no-store',
    },
  })
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function cleanHeader(value: string | null | undefined, fallback: string): string {
  return value?.replace(/[\r\n]+/g, ' ').trim().slice(0, 80) || fallback
}

function isInviteRequest(value: unknown): value is InviteRequest {
  if (!value || typeof value !== 'object') return false
  const input = value as Record<string, unknown>
  return (
    typeof input.sessionId === 'string' &&
    UUID_RE.test(input.sessionId) &&
    typeof input.inviteeUserId === 'string' &&
    UUID_RE.test(input.inviteeUserId)
  )
}

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function sign(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)))
}

function formatWorkoutTime(startsAt: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en', {
    timeZone,
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(startsAt))
}

function kindLabel(kind: string): string {
  return {
    crossfit: 'CrossFit',
    open_gym: 'Open Gym',
    weightlifting: 'Weightlifting',
    other: 'Workout',
  }[kind] ?? 'Workout'
}

async function callMailEndpoint(email: EmailPayload): Promise<void> {
  const url = Deno.env.get('GOOGLE_MAIL_WEBHOOK_URL')
  const secret = Deno.env.get('GOOGLE_MAIL_WEBHOOK_SECRET')
  if (!url || !secret) throw new Error('Mail delivery is not configured')
  const timestamp = Date.now().toString()
  const nonce = crypto.randomUUID()
  const payload = JSON.stringify(email)
  const signature = await sign(`${timestamp}.${nonce}.${payload}`, secret)
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timestamp, nonce, payload, signature }),
  })
  if (!response.ok) throw new Error(`Mail endpoint returned ${response.status}`)
  const result = (await response.json()) as { ok?: boolean; error?: string }
  if (!result.ok) throw new Error(result.error ?? 'Mail endpoint rejected the request')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return json({ ok: true })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401)

  let input: unknown
  try {
    input = await request.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }
  if (!isInviteRequest(input)) return json({ error: 'Invalid invitation request' }, 400)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const appUrl = Deno.env.get('APP_URL') ?? 'https://woody-wod.vercel.app'
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: 'Server configuration is incomplete' }, 500)
  }

  const token = authHeader.slice('Bearer '.length)
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userError } = await authClient.auth.getUser(token)
  if (userError || !userData.user) return json({ error: 'Invalid session' }, 401)
  const callerId = userData.user.id
  if (callerId === input.inviteeUserId) return json({ error: 'You cannot invite yourself' }, 400)

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: session, error: sessionError } = await admin
    .from('workout_sessions')
    .select('id, group_id, creator_id, starts_at, duration_minutes, kind, note, status')
    .eq('id', input.sessionId)
    .maybeSingle()
  if (sessionError) return json({ error: 'Could not load the workout' }, 500)
  if (!session || session.status !== 'scheduled') return json({ error: 'Workout is not available' }, 404)
  const endAt = new Date(session.starts_at).getTime() + session.duration_minutes * 60_000
  if (endAt <= Date.now()) return json({ error: 'Workout has ended' }, 409)

  const { data: memberships, error: membershipError } = await admin
    .from('group_members')
    .select('user_id')
    .eq('group_id', session.group_id)
    .is('removed_at', null)
    .in('user_id', [callerId, input.inviteeUserId])
  if (membershipError) return json({ error: 'Could not verify group membership' }, 500)
  const memberIds = new Set((memberships ?? []).map((row) => row.user_id as string))
  if (!memberIds.has(callerId) || !memberIds.has(input.inviteeUserId)) {
    return json({ error: 'Both people must belong to the same Friends group' }, 403)
  }

  const { data: callerParticipation } = await admin
    .from('session_participants')
    .select('user_id')
    .eq('session_id', input.sessionId)
    .eq('user_id', callerId)
    .maybeSingle()
  if (!callerParticipation && session.creator_id !== callerId) {
    return json({ error: 'Join the workout before inviting a friend' }, 403)
  }

  const { data: inviteeProfile, error: profileError } = await admin
    .from('profiles')
    .select('id, display_name, email_invites_enabled')
    .eq('id', input.inviteeUserId)
    .maybeSingle()
  if (profileError || !inviteeProfile) return json({ error: 'Friend profile not found' }, 404)

  const { data: existing } = await admin
    .from('session_invitations')
    .select('id, status, email_status, updated_at')
    .eq('session_id', input.sessionId)
    .eq('invitee_id', input.inviteeUserId)
    .maybeSingle()
  if (existing?.status === 'accepted') return json({ error: 'This friend already joined' }, 409)
  if (existing?.status === 'pending' && existing.email_status === 'sent') {
    return json({ invitationId: existing.id, sent: true, emailStatus: 'sent', alreadySent: true })
  }
  const sendingRecently = existing?.email_status === 'sending' &&
    Date.now() - new Date(existing.updated_at).getTime() < 2 * 60_000
  if (sendingRecently) {
    return json({ invitationId: existing.id, sent: false, emailStatus: 'sending', alreadySending: true })
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60_000).toISOString()
  const { count, error: countError } = await admin
    .from('session_invitations')
    .select('id', { count: 'exact', head: true })
    .eq('inviter_id', callerId)
    .gte('sent_at', oneHourAgo)
  if (countError) return json({ error: 'Could not check invitation limit' }, 500)
  if ((count ?? 0) >= MAX_INVITES_PER_HOUR) {
    return json({ error: 'Too many invitations. Try again later.' }, 429)
  }

  const deliveryId = crypto.randomUUID()
  const invitationValues = {
    session_id: input.sessionId,
    inviter_id: callerId,
    invitee_id: input.inviteeUserId,
    status: 'pending',
    email_status: inviteeProfile.email_invites_enabled ? 'sending' : 'suppressed',
    email_delivery_id: deliveryId,
    responded_at: null,
  }
  const claim = existing
    ? await admin
        .from('session_invitations')
        .update(invitationValues)
        .eq('id', existing.id)
        .eq('updated_at', existing.updated_at)
        .select('id')
        .maybeSingle()
    : await admin
        .from('session_invitations')
        .insert(invitationValues)
        .select('id')
        .maybeSingle()
  if (claim.error?.code === '23505' || (!claim.error && !claim.data)) {
    return json({ sent: false, emailStatus: 'sending', alreadySending: true })
  }
  if (claim.error) return json({ error: 'Could not save the invitation' }, 500)
  const invitation = claim.data
  if (!invitation) return json({ error: 'Could not claim the invitation' }, 500)
  if (!inviteeProfile.email_invites_enabled) {
    return json({ invitationId: invitation.id, sent: false, emailStatus: 'suppressed', suppressed: true })
  }

  const [inviteeAuth, inviterProfileResult, groupResult, participantsResult] = await Promise.all([
    admin.auth.admin.getUserById(input.inviteeUserId),
    admin.from('profiles').select('display_name').eq('id', callerId).single(),
    admin.from('friend_groups').select('name, timezone').eq('id', session.group_id).single(),
    admin
      .from('session_participants')
      .select('profiles(display_name)')
      .eq('session_id', input.sessionId),
  ])
  const recipientEmail = inviteeAuth.data.user?.email
  const inviterName = cleanHeader(inviterProfileResult.data?.display_name, 'A friend')
  const groupName = cleanHeader(groupResult.data?.name, 'Friends')
  const timeZone = groupResult.data?.timezone || 'Asia/Jerusalem'
  if (!recipientEmail) return json({ error: 'Friend email is unavailable' }, 409)

  const otherNames = (participantsResult.data ?? [])
    .map((row) => {
      const profile = row.profiles as unknown as { display_name?: string } | null
      return profile?.display_name?.trim()
    })
    .filter((name): name is string => Boolean(name) && name !== inviterName)
    .slice(0, 5)
  const when = formatWorkoutTime(session.starts_at, timeZone)
  const workout = kindLabel(session.kind)
  const invitationUrl = `${appUrl}/friends/invitations/${invitation.id}`
  const companionText = otherNames.length > 0 ? `\nAlso going: ${otherNames.join(', ')}` : ''
  const textBody = `${inviterName} invited you to train with ${groupName}.\n\n${when}\n${workout}${companionText}\n\nView invitation: ${invitationUrl}`
  const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#17171a">
      <h1 style="font-size:24px">${escapeHtml(inviterName)} invited you to train</h1>
      <p>${escapeHtml(when)}<br><strong>${escapeHtml(workout)}</strong></p>
      ${otherNames.length > 0 ? `<p>Also going: ${escapeHtml(otherNames.join(', '))}</p>` : ''}
      <p><a href="${escapeHtml(invitationUrl)}" style="display:inline-block;padding:12px 18px;background:#17171a;color:#fff;text-decoration:none;border-radius:10px">View invitation</a></p>
      <p style="font-size:12px;color:#666">This invitation was sent by a member of ${escapeHtml(groupName)}.</p>
    </div>`

  try {
    await callMailEndpoint({
      deliveryId,
      to: recipientEmail,
      subject: `${inviterName} invited you to train`,
      textBody,
      htmlBody,
    })
    await admin
      .from('session_invitations')
      .update({ email_status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', invitation.id)
    return json({ invitationId: invitation.id, sent: true, emailStatus: 'sent' })
  } catch (error) {
    console.error('Workout invitation email failed', {
      invitationId: invitation.id,
      message: error instanceof Error ? error.message : 'Unknown error',
    })
    await admin.from('session_invitations').update({ email_status: 'failed' }).eq('id', invitation.id)
    return json({
      invitationId: invitation.id,
      sent: false,
      emailStatus: 'failed',
      warning: 'Invitation saved, but the email could not be sent',
    })
  }
})
