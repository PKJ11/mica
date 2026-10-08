import Image from "next/image";
import { redirect } from "next/navigation";
import { hasConsented, requireVnitSession, safeNext } from "@/lib/vnitAuth";
import { vnitAgree, vnitLogout } from "../actions";

export const metadata = { title: "VNIT Nagpur · What we record" };

// First sign-in, and again whenever NOTICE_VERSION changes (LG-11). Nothing is tracked until this is agreed.
export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; missing?: string }>;
}) {
  const { next: rawNext, missing } = await searchParams;
  const next = safeNext(rawNext);
  const { user } = await requireVnitSession(`/vnit/consent?next=${encodeURIComponent(next)}`, { skipConsent: true });
  if (await hasConsented(user.id)) redirect(next);

  return (
    <main className="consent-shell theme-vnit">
      <div className="consent-card">
        <Image src="/home/vnit.png" alt="VNIT Nagpur" width={471} height={522} className="consent-logo" priority />
        <p className="kicker dark">Before you start</p>
        <h1 className="page-title">What we record</h1>
        <p className="muted">Hello {user.name}. Please read this once before using the portal.</p>

        <section>
          <h2>What we record</h2>
          <ul>
            <li>When you sign in and out, and the device and browser you use</li>
            <li>Which modules and chapters you open, and for how long you are active in them</li>
            <li>Your answers to questions and quizzes</li>
            <li>Clicks and controls you use inside activities</li>
          </ul>
        </section>
        <section>
          <h2>What we do not record</h2>
          <ul>
            <li>Your screen, camera or microphone</li>
            <li>Anything you type, other than answers you submit</li>
          </ul>
        </section>
        <section>
          <h2>Why</h2>
          <p>To show you and your instructor how you are learning, and to produce your reports.</p>
          <p className="muted small">
            You are signed out after 7 minutes without activity. Your place in each module is saved to your account, so it
            follows you across devices.
          </p>
        </section>

        <form action={vnitAgree} className="consent-form">
          <input type="hidden" name="next" value={next} />
          <label className="check">
            <input type="checkbox" name="agree" required />
            <span>I have read and agree</span>
          </label>
          {missing && (
            <p className="error" role="alert">
              Please tick the box to continue.
            </p>
          )}
          <div className="consent-actions">
            <button type="submit" className="btn-primary">
              Continue
            </button>
          </div>
        </form>
        <form action={vnitLogout}>
          <button type="submit" className="link-btn">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
