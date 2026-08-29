import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarPlus, Check, Clock, Mail, Settings, UserPlus, Users, X } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { AuthSignInOptions } from '@/features/auth/AuthSignInOptions'
import { useAuthStore } from '@/features/auth/authStore'
import {
  dateKey,
  findNearbySessions,
  formatDateTab,
  formatSessionTime,
  groupSessionsByDate,
  planningDates,
  sessionPhase,
  validateSessionDraft,
  zonedDateTimeToIso,
} from './friendsLogic'
import {
  cancelSession,
  createFriendSession,
  getFriendBootstrap,
  joinFriendGroup,
  joinSession,
  leaveSession,
  listFriendInvitations,
  listFriendMembers,
  listFriendSessions,
  respondToInvitation,
  saveFriendProfile,
  sendFriendInvitation,
  subscribeToFriendChanges,
  updateFriendSession,
} from './friendsRepo'
import {
  SESSION_KIND_LABELS,
  type FriendBootstrap,
  type FriendInvitation,
  type FriendProfile,
  type FriendSession,
  type SessionDraft,
  type SessionKind,
} from './friendsTypes'

const inputClass = 'mt-1 w-full rounded-xl border border-edge bg-surface px-3 py-3 text-chalk outline-none focus:border-work focus:ring-2 focus:ring-work/30'
const primaryButton = 'min-h-11 rounded-xl bg-work px-4 py-2.5 font-semibold text-surface disabled:cursor-not-allowed disabled:opacity-50'
const secondaryButton = 'min-h-11 rounded-xl bg-edge px-4 py-2.5 font-semibold text-chalk disabled:opacity-50'

function ErrorMessage({ message }: { message: string | null }) {
  if (!message) return null
  return <p role="alert" className="mt-3 rounded-xl bg-alarm/15 px-3 py-2 text-sm text-alarm">{message}</p>
}

function SignInCard() {
  const status = useAuthStore((state) => state.status)

  if (status === 'loading') return <p className="mt-8 text-chalk-dim">Checking your account…</p>
  if (status === 'unconfigured') {
    return <ErrorMessage message="Friends needs the Supabase environment variables configured." />
  }

  return (
    <section className="mt-8 rounded-2xl bg-raised p-5">
      <Users className="text-work" aria-hidden="true" />
      <h2 className="mt-4 text-xl font-semibold">Train with your crew</h2>
      <p className="mt-2 text-sm leading-6 text-chalk-dim">
        See when friends are training, join their session, or invite someone by email.
      </p>
      <AuthSignInOptions returnTo={window.location.pathname} />
    </section>
  )
}

function Onboarding({ onComplete }: { onComplete: () => Promise<void> }) {
  const email = useAuthStore((state) => state.email)
  const [name, setName] = useState(email?.split('@')[0] ?? '')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (name.trim().length < 2) {
      setError('Enter the name your friends know you by.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await saveFriendProfile(name)
      await joinFriendGroup(code)
      await onComplete()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not join the group')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="mt-7 rounded-2xl bg-raised p-5" onSubmit={submit}>
      <h2 className="text-xl font-semibold">Join your training group</h2>
      <p className="mt-2 text-sm text-chalk-dim">This takes less than a minute.</p>
      <label className="mt-5 block text-sm font-medium" htmlFor="friend-name">Your name</label>
      <input id="friend-name" className={inputClass} value={name} maxLength={60} autoComplete="name" onChange={(event) => setName(event.target.value)} />
      <label className="mt-4 block text-sm font-medium" htmlFor="group-code">Group code</label>
      <input id="group-code" className={`${inputClass} uppercase`} value={code} maxLength={32} autoCapitalize="characters" onChange={(event) => setCode(event.target.value)} />
      <p className="mt-2 text-xs text-chalk-dim">Ask your group admin for the code.</p>
      <ErrorMessage message={error} />
      <button className={`${primaryButton} mt-5 w-full`} disabled={busy || !code.trim()}>
        {busy ? 'Joining…' : 'Join group'}
      </button>
    </form>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', handleKeyDown)
    closeRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus()
    }
  }, [])
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="modal-title" className="mx-auto max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-raised p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        <div className="flex items-center justify-between">
          <h2 id="modal-title" className="text-xl font-semibold">{title}</h2>
          <button ref={closeRef} type="button" aria-label="Close" className="grid min-h-11 min-w-11 place-items-center rounded-full bg-edge" onClick={onClose}><X aria-hidden="true" /></button>
        </div>
        {children}
      </section>
    </div>
  )
}

function AddSessionModal({ dates, timeZone, sessions, userId, initialDraft, title = 'When are you training?', submitLabel = 'Add my workout', onClose, onCreated, onJoin }: {
  dates: string[]
  timeZone: string
  sessions: FriendSession[]
  userId: string
  initialDraft?: SessionDraft
  title?: string
  submitLabel?: string
  onClose: () => void
  onCreated: (draft: SessionDraft) => Promise<void>
  onJoin: (sessionId: string) => Promise<void>
}) {
  const suggested = new Date(Date.now() + 15 * 60_000)
  const suggestedDate = dateKey(suggested, timeZone)
  const [draft, setDraft] = useState<SessionDraft>(initialDraft ?? {
    date: dates.includes(suggestedDate) ? suggestedDate : dates[0],
    time: formatSessionTime(suggested.toISOString(), timeZone),
    durationMinutes: 60,
    kind: 'crossfit',
    note: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errors = validateSessionDraft(draft, dates)
  const nearby = Object.keys(errors).length
    ? []
    : findNearbySessions(sessions, zonedDateTimeToIso(draft.date, draft.time, timeZone), userId)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (Object.keys(errors).length) return
    setBusy(true)
    try {
      await onCreated(draft)
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add the session')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form className="mt-5" onSubmit={submit}>
        <label className="block text-sm font-medium" htmlFor="session-date">Day</label>
        <select id="session-date" className={inputClass} value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })}>
          {dates.map((date) => <option key={date} value={date}>{formatDateTab(date, dates[0], timeZone)} · {date}</option>)}
        </select>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div><label className="block text-sm font-medium" htmlFor="session-time">Time</label><input id="session-time" type="time" className={inputClass} value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} /></div>
          <div><label className="block text-sm font-medium" htmlFor="session-duration">Minutes</label><input id="session-duration" type="number" min="15" max="360" step="15" className={inputClass} value={draft.durationMinutes} onChange={(event) => setDraft({ ...draft, durationMinutes: Number(event.target.value) })} /></div>
        </div>
        <label className="mt-4 block text-sm font-medium" htmlFor="session-kind">Workout</label>
        <select id="session-kind" className={inputClass} value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as SessionKind })}>
          {Object.entries(SESSION_KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <label className="mt-4 block text-sm font-medium" htmlFor="session-note">Note <span className="text-chalk-dim">(optional)</span></label>
        <textarea id="session-note" className={inputClass} rows={2} maxLength={240} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
        {nearby.length > 0 && <div className="mt-4 rounded-xl border border-work/30 bg-work/10 p-3"><p className="text-sm font-semibold">Someone is already training around then</p>{nearby.map((session) => <button key={session.id} type="button" className="mt-2 w-full rounded-lg bg-work px-3 py-2 text-left font-semibold text-surface" onClick={async () => { await onJoin(session.id); onClose() }}>Join {session.participants.map((person) => person.displayName).join(', ')} at {formatSessionTime(session.startsAt, timeZone)}</button>)}</div>}
        <ErrorMessage message={error ?? Object.values(errors)[0] ?? null} />
        <button className={`${primaryButton} mt-5 w-full`} disabled={busy || Object.keys(errors).length > 0}>{busy ? 'Saving…' : submitLabel}</button>
      </form>
    </Modal>
  )
}

function InviteModal({ session, members, userId, onClose }: { session: FriendSession; members: FriendProfile[]; userId: string; onClose: () => void }) {
  const joined = new Set(session.participants.map((person) => person.userId))
  const choices = members.filter((member) => member.id !== userId && !joined.has(member.id))
  const [delivery, setDelivery] = useState<Map<string, string>>(new Map())
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const invite = async (friend: FriendProfile) => {
    setBusy(friend.id)
    setError(null)
    try {
      const result = await sendFriendInvitation(session.id, friend.id)
      setDelivery((current) => new Map(current).set(friend.id, result.emailStatus))
      if (result.emailStatus === 'failed') {
        setError('Invitation saved in Woody, but the email failed. You can retry it.')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Invitation could not be sent')
    } finally {
      setBusy(null)
    }
  }
  return (
    <Modal title="Invite a friend" onClose={onClose}>
      <p className="mt-3 text-sm text-chalk-dim">They’ll see it in Woody and receive an email if email invitations are enabled.</p>
      <div className="mt-4 space-y-2">
        {choices.length === 0 && <p className="rounded-xl bg-surface p-4 text-sm text-chalk-dim">Everyone is already joining this session.</p>}
        {choices.map((friend) => {
          const status = delivery.get(friend.id)
          const completed = status === 'sent' || status === 'suppressed' || status === 'sending'
          return <div key={friend.id} className="flex min-h-14 items-center justify-between rounded-xl bg-surface px-4"><span className="flex items-center gap-2 font-medium">{friend.avatarUrl && <img src={friend.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" referrerPolicy="no-referrer" />}{friend.displayName}</span><button type="button" className={completed ? 'flex items-center gap-1 text-work' : 'min-h-11 rounded-lg bg-edge px-3 font-semibold'} disabled={busy === friend.id || completed} onClick={() => void invite(friend)}>{completed ? <><Check size={18} /> {status === 'sent' ? 'Sent' : status === 'sending' ? 'Sending' : 'In app'}</> : busy === friend.id ? 'Sending…' : status === 'failed' ? 'Retry email' : 'Invite'}</button></div>
        })}
      </div>
      <ErrorMessage message={error} />
    </Modal>
  )
}

function InvitationBanner({ invitation, timeZone, onRespond }: { invitation: FriendInvitation; timeZone: string; onRespond: (id: string, response: 'accepted' | 'declined') => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  return (
    <article className="mt-4 rounded-2xl border border-work/40 bg-work/10 p-4">
      <p className="font-semibold">{invitation.inviter.displayName} invited you</p>
      <p className="mt-1 text-sm text-chalk-dim">{SESSION_KIND_LABELS[invitation.session.kind]} · {formatSessionTime(invitation.session.startsAt, timeZone)}</p>
      <div className="mt-3 flex gap-2"><button className={`${primaryButton} flex-1`} disabled={busy} onClick={async () => { setBusy(true); await onRespond(invitation.id, 'accepted'); setBusy(false) }}>Join</button><button className={`${secondaryButton} flex-1`} disabled={busy} onClick={async () => { setBusy(true); await onRespond(invitation.id, 'declined'); setBusy(false) }}>Decline</button></div>
    </article>
  )
}

function SessionCard({ session, userId, timeZone, offline, onJoin, onLeave, onCancel, onEdit, onInvite }: {
  session: FriendSession
  userId: string
  timeZone: string
  offline: boolean
  onJoin: () => Promise<void>
  onLeave: () => Promise<void>
  onCancel: () => Promise<void>
  onEdit: () => void
  onInvite: () => void
}) {
  const joined = session.participants.some((person) => person.userId === userId)
  const creator = session.creatorId === userId
  const phase = sessionPhase(session)
  const [busy, setBusy] = useState(false)
  const action = async (callback: () => Promise<void>) => { setBusy(true); try { await callback() } finally { setBusy(false) } }
  return (
    <article className={`rounded-2xl bg-raised p-4 ${session.status === 'cancelled' ? 'opacity-55' : ''}`}>
      <div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-xl font-semibold"><Clock size={19} className="text-work" aria-hidden="true" />{formatSessionTime(session.startsAt, timeZone)}</p><p className="mt-1 text-sm text-chalk-dim">{SESSION_KIND_LABELS[session.kind]} · {session.durationMinutes} min</p></div>{phase !== 'upcoming' && session.status === 'scheduled' && <span className="rounded-full bg-edge px-2 py-1 text-xs font-semibold text-work">{phase === 'training_now' ? 'Training now' : phase === 'starting_soon' ? 'Starting soon' : 'Finished'}</span>}</div>
      {session.note && <p className="mt-3 text-sm">{session.note}</p>}
      <div className="mt-3 flex flex-wrap gap-1.5" aria-label="People joining">{session.participants.map((person) => <span key={person.userId} className="flex items-center gap-1.5 rounded-full bg-edge px-2.5 py-1 text-xs">{person.avatarUrl && <img src={person.avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover" referrerPolicy="no-referrer" />}{person.displayName}</span>)}</div>
      {session.status === 'cancelled' ? <p className="mt-3 text-sm font-semibold text-alarm">Cancelled</p> : <div className="mt-4 flex gap-2">{joined ? <><button type="button" className={`${secondaryButton} flex-1`} disabled={busy || offline} onClick={() => void action(onLeave)}>Leave</button><button type="button" className={`${primaryButton} flex-1`} disabled={offline} onClick={onInvite}><Mail size={17} className="mr-1 inline" /> Invite</button></> : <button type="button" className={`${primaryButton} w-full`} disabled={busy || offline || phase === 'past'} onClick={() => void action(onJoin)}><UserPlus size={18} className="mr-1 inline" /> Join</button>}</div>}
      {creator && session.status === 'scheduled' && <div className="mt-2 flex gap-2"><button type="button" disabled={offline} className="min-h-11 flex-1 text-sm text-chalk-dim underline disabled:opacity-50" onClick={onEdit}>Edit</button><button type="button" disabled={offline} className="min-h-11 flex-1 text-sm text-chalk-dim underline disabled:opacity-50" onClick={() => window.confirm('Cancel this workout for everyone?') && void action(onCancel)}>Cancel</button></div>}
    </article>
  )
}

export function FriendsScreen() {
  const { invitationId } = useParams<{ invitationId: string }>()
  const authStatus = useAuthStore((state) => state.status)
  const userId = useAuthStore((state) => state.userId)
  const [bootstrap, setBootstrap] = useState<FriendBootstrap | null>(null)
  const [sessions, setSessions] = useState<FriendSession[]>([])
  const [members, setMembers] = useState<FriendProfile[]>([])
  const [invitations, setInvitations] = useState<FriendInvitation[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [inviteSession, setInviteSession] = useState<FriendSession | null>(null)
  const [editSession, setEditSession] = useState<FriendSession | null>(null)
  const [linkedInvitation, setLinkedInvitation] = useState<FriendInvitation | null>(null)
  const [linkChecked, setLinkChecked] = useState(false)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const timeZone = bootstrap?.group?.timezone ?? 'Asia/Jerusalem'
  const dates = useMemo(() => planningDates(new Date(), timeZone), [timeZone])
  const activeDate = selectedDate && dates.includes(selectedDate) ? selectedDate : dates[0]
  const boardSessions = useMemo(
    () => sessions.filter((session) => session.status === 'scheduled' && sessionPhase(session) !== 'past'),
    [sessions],
  )
  const grouped = useMemo(() => groupSessionsByDate(boardSessions, timeZone), [boardSessions, timeZone])
  const linkedInvitationExpired = Boolean(
    linkedInvitation && (
      linkedInvitation.status === 'expired' ||
      linkedInvitation.session.status === 'cancelled' ||
      sessionPhase(linkedInvitation.session) === 'past'
    ),
  )

  const refresh = useCallback(async () => {
    if (authStatus !== 'signedIn') return
    setError(null)
    try {
      const next = await getFriendBootstrap()
      setBootstrap(next)
      if (!next.group) { setSessions([]); setMembers([]); setInvitations([]); return }
      const range = planningDates(new Date(), next.group.timezone)
      const [nextSessions, nextMembers, nextInvitations, linkedInvitations] = await Promise.all([
        listFriendSessions(next.group.id, range[0], range.at(-1)!, next.group.timezone),
        listFriendMembers(next.group.id),
        listFriendInvitations(),
        invitationId ? listFriendInvitations(invitationId) : Promise.resolve([]),
      ])
      setSessions(nextSessions)
      setMembers(nextMembers)
      setInvitations(nextInvitations)
      setLinkedInvitation(linkedInvitations[0] ?? null)
      setLinkChecked(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Friends could not be loaded')
    } finally {
      setLoading(false)
    }
  }, [authStatus, invitationId])

  useEffect(() => { if (authStatus === 'signedIn') { setLoading(true); void refresh() } else { setLoading(false); setBootstrap(null) } }, [authStatus, refresh])
  useEffect(() => subscribeToFriendChanges(() => void refresh()), [refresh])
  useEffect(() => {
    const handleOnline = () => { setOnline(true); void refresh() }
    const handleOffline = () => setOnline(false)
    const handleVisibility = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [refresh])

  const run = async (action: () => Promise<unknown>, propagate = false) => {
    setError(null)
    try {
      if (!navigator.onLine) throw new Error('You’re offline. Reconnect to change Friends plans.')
      await action()
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong')
      if (propagate) throw caught
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-start justify-between"><div><h1 className="font-display text-3xl tracking-wide">FRIENDS</h1><p className="mt-1 text-sm text-chalk-dim">{bootstrap?.group?.name ?? 'Find a training partner'}</p></div><Link to="/settings" aria-label="Settings" className="grid min-h-11 min-w-11 place-items-center rounded-full bg-raised"><Settings aria-hidden="true" /></Link></header>
      {authStatus !== 'signedIn' ? <SignInCard /> : loading ? <p className="mt-8 text-chalk-dim">Loading your crew…</p> : !bootstrap?.profile || !bootstrap.group ? <Onboarding onComplete={refresh} /> : <>
        {!online && <p role="status" className="mt-4 rounded-xl bg-rest/15 px-3 py-2 text-sm text-rest">Offline — viewing the last loaded plans. Reconnect to make changes.</p>}
        {invitationId && linkChecked && !linkedInvitation && <p role="status" className="mt-4 rounded-xl bg-raised p-4 text-sm">This invitation is unavailable or belongs to another account.</p>}
        {linkedInvitation?.status === 'pending' && !linkedInvitationExpired && <InvitationBanner invitation={linkedInvitation} timeZone={timeZone} onRespond={(id, response) => run(() => respondToInvitation(id, response))} />}
        {linkedInvitation && (linkedInvitation.status !== 'pending' || linkedInvitationExpired) && <p role="status" className="mt-4 rounded-xl bg-raised p-4 text-sm">{linkedInvitationExpired ? 'This invitation has expired.' : `This invitation was ${linkedInvitation.status}.`}</p>}
        {invitations.filter((invitation) => invitation.id !== invitationId && invitation.session.status === 'scheduled' && sessionPhase(invitation.session) !== 'past').map((invitation) => <InvitationBanner key={invitation.id} invitation={invitation} timeZone={timeZone} onRespond={(id, response) => run(() => respondToInvitation(id, response))} />)}
        <div className="mt-6 grid grid-cols-3 rounded-xl bg-raised p-1" role="tablist" aria-label="Workout day">{dates.map((date) => <button key={date} type="button" role="tab" aria-selected={activeDate === date} className={`min-h-11 rounded-lg px-2 text-sm font-semibold ${activeDate === date ? 'bg-work text-surface' : 'text-chalk-dim'}`} onClick={() => setSelectedDate(date)}>{formatDateTab(date, dates[0], timeZone)}</button>)}</div>
        <section className="mt-5 space-y-3" aria-live="polite">{(grouped.get(activeDate) ?? []).map((session) => <SessionCard key={session.id} session={session} userId={userId!} timeZone={timeZone} offline={!online} onJoin={() => run(() => joinSession(session.id))} onLeave={() => run(() => leaveSession(session.id))} onCancel={() => run(() => cancelSession(session.id))} onEdit={() => setEditSession(session)} onInvite={() => setInviteSession(session)} />)}{(grouped.get(activeDate) ?? []).length === 0 && <div className="rounded-2xl border border-dashed border-edge px-5 py-10 text-center"><Users className="mx-auto text-chalk-dim" aria-hidden="true" /><p className="mt-3 font-semibold">No plans yet</p><p className="mt-1 text-sm text-chalk-dim">Be the first to say when you’re training.</p></div>}</section>
        <button type="button" disabled={!online} className={`${primaryButton} sticky bottom-20 mt-5 flex w-full items-center justify-center gap-2 shadow-xl`} onClick={() => setAddOpen(true)}><CalendarPlus aria-hidden="true" /> Add my workout</button>
      </>}
      <ErrorMessage message={error} />
      {addOpen && bootstrap?.group && userId && <AddSessionModal dates={dates} timeZone={timeZone} sessions={sessions} userId={userId} onClose={() => setAddOpen(false)} onCreated={(draft) => run(() => createFriendSession(bootstrap.group!, draft), true)} onJoin={(id) => run(() => joinSession(id), true)} />}
      {editSession && bootstrap?.group && userId && <AddSessionModal dates={dates} timeZone={timeZone} sessions={sessions} userId={userId} title="Edit workout" submitLabel="Save changes" initialDraft={{ date: dateKey(new Date(editSession.startsAt), timeZone), time: formatSessionTime(editSession.startsAt, timeZone), durationMinutes: editSession.durationMinutes, kind: editSession.kind, note: editSession.note ?? '' }} onClose={() => setEditSession(null)} onCreated={(draft) => run(() => updateFriendSession(bootstrap.group!, editSession.id, draft), true)} onJoin={(id) => run(() => joinSession(id), true)} />}
      {inviteSession && userId && <InviteModal session={inviteSession} members={members} userId={userId} onClose={() => setInviteSession(null)} />}
    </div>
  )
}
