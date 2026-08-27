export type SessionKind = 'crossfit' | 'open_gym' | 'weightlifting' | 'other'
export type SessionStatus = 'scheduled' | 'cancelled'
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired'
export type EmailStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'suppressed'

export interface FriendProfile {
  id: string
  displayName: string
  avatarUrl: string | null
  emailInvitesEnabled: boolean
}

export interface FriendGroup {
  id: string
  name: string
  timezone: string
  role: 'member' | 'admin'
}

export interface FriendParticipant {
  userId: string
  displayName: string
  avatarUrl: string | null
  joinedAt: string
}

export interface FriendSession {
  id: string
  groupId: string
  creatorId: string
  startsAt: string
  durationMinutes: number
  kind: SessionKind
  note: string | null
  status: SessionStatus
  createdAt: string
  updatedAt: string
  participants: FriendParticipant[]
}

export interface FriendInvitation {
  id: string
  sessionId: string
  inviterId: string
  inviteeId: string
  status: InvitationStatus
  emailStatus: EmailStatus
  createdAt: string
  inviter: FriendProfile
  session: FriendSession
}

export interface SessionDraft {
  date: string
  time: string
  durationMinutes: number
  kind: SessionKind
  note: string
}

export interface FriendBootstrap {
  profile: FriendProfile | null
  group: FriendGroup | null
}

export const SESSION_KIND_LABELS: Record<SessionKind, string> = {
  crossfit: 'CrossFit',
  open_gym: 'Open Gym',
  weightlifting: 'Weightlifting',
  other: 'Other',
}
