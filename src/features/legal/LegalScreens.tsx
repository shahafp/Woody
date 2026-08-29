import { Link } from 'react-router'

const sectionClass = 'mt-7'
const headingClass = 'text-lg font-semibold text-chalk'
const paragraphClass = 'mt-2 text-sm leading-6 text-chalk-dim'

export function AboutScreen() {
  return (
    <div className="pb-6">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-work">Woody WOD</p>
      <h1 className="mt-2 font-display text-4xl tracking-wide text-chalk">TRAIN BETTER, TOGETHER</h1>
      <p className="mt-4 text-base leading-7 text-chalk-dim">
        Woody is a lightweight CrossFit companion for workout timers, daily weights, training logs,
        personal lift records, and coordinating sessions with friends.
      </p>

      <section className={sectionClass}>
        <h2 className={headingClass}>Built for the box</h2>
        <p className={paragraphClass}>
          Run common CrossFit timer formats, calculate barbell loads from your percentages, record
          results, and see when your training group plans to work out over the next few days.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>Your account</h2>
        <p className={paragraphClass}>
          Sign in with Google or a secure email link to sync your training data. Friends groups stay
          private: signing in does not grant access without the group’s join code.
        </p>
      </section>

      <div className="mt-8 flex flex-col gap-3">
        <Link to="/" className="min-h-12 rounded-xl bg-work px-4 py-3 text-center font-semibold text-surface">
          Open Woody
        </Link>
        <Link to="/privacy" className="min-h-11 rounded-xl bg-raised px-4 py-3 text-center text-sm font-semibold text-chalk">
          Privacy policy
        </Link>
      </div>
      <p className="mt-7 text-center text-xs text-chalk-dim">
        Support: <a className="underline" href="mailto:woodywodrx@gmail.com">woodywodrx@gmail.com</a>
      </p>
    </div>
  )
}

export function PrivacyScreen() {
  return (
    <article className="pb-6">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-work">Woody WOD</p>
      <h1 className="mt-2 font-display text-4xl tracking-wide text-chalk">PRIVACY POLICY</h1>
      <p className={paragraphClass}>Last updated: August 29, 2026</p>

      <section className={sectionClass}>
        <h2 className={headingClass}>Information Woody uses</h2>
        <p className={paragraphClass}>
          If you use Google sign-in, Woody receives your Google account identifier, email address,
          display name, and profile photo. Woody does not request access to Gmail, Google Drive,
          contacts, calendars, or your Google password.
        </p>
        <p className={paragraphClass}>
          Woody stores the training information you choose to enter, such as timers, lift records,
          workout logs, settings, planned training sessions, group membership, and invitations.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>How information is used</h2>
        <p className={paragraphClass}>
          Information is used to provide the app, sync your data across devices, show planned
          sessions to members of your private training group, and deliver workout invitations.
          Woody does not sell personal information or use it for advertising.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>Who can see information</h2>
        <p className={paragraphClass}>
          Members of the same Friends group can see your display name, profile photo, and the
          training sessions you schedule or join. Invitation recipients receive the workout details
          necessary to respond. Private workout logs and lift records are not shared with the group.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>Storage and service providers</h2>
        <p className={paragraphClass}>
          Woody keeps offline data in your browser and uses Supabase for authentication, database,
          and synchronization services. The app is hosted by Vercel. Google provides Google sign-in
          and may deliver invitation or authentication emails. These providers process information
          only as needed to operate those services.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>Retention and deletion</h2>
        <p className={paragraphClass}>
          Account data is retained while you use Woody. To request account and cloud-data deletion,
          email <a className="text-chalk underline" href="mailto:woodywodrx@gmail.com">woodywodrx@gmail.com</a> from
          your account address. Data stored only on a device can be removed by clearing Woody’s site
          data in that browser.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>Changes and contact</h2>
        <p className={paragraphClass}>
          This policy may be updated as Woody changes. The latest version will remain on this page.
          Questions can be sent to <a className="text-chalk underline" href="mailto:woodywodrx@gmail.com">woodywodrx@gmail.com</a>.
        </p>
      </section>

      <div className="mt-8 flex gap-3">
        <Link to="/about" className="min-h-11 flex-1 rounded-xl bg-raised px-4 py-3 text-center text-sm font-semibold text-chalk">
          About Woody
        </Link>
        <Link to="/" className="min-h-11 flex-1 rounded-xl bg-work px-4 py-3 text-center text-sm font-semibold text-surface">
          Open app
        </Link>
      </div>
    </article>
  )
}
