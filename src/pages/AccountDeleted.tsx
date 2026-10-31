import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { auth } from "../lib/authStyles";
import { CONTACT_EMAIL, DELETED_KEY } from "../lib/legal";

/** Shown once an account has been deleted, as an on-screen confirmation. */
export default function AccountDeleted() {
  const [info, setInfo] = useState<{ email: string; emailed: boolean; at: string } | null>(null);
  useEffect(() => {
    document.title = "Account deleted | Growell";
    try {
      const raw = sessionStorage.getItem(DELETED_KEY);
      if (raw) setInfo(JSON.parse(raw));
    } catch {
      // nothing saved: show the general message
    }
  }, []);

  return (
    <AuthLayout>
      <div className="text-center">
        <span aria-hidden className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-growth-50 text-growth-700">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="m5 11.5 4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <h1 className={`${auth.heading} mt-4`}>Your account has been deleted</h1>
        <p className="mt-3 text-sm leading-6 text-ink/75">
          {info?.email ? <>The account for <strong className="text-ink">{info.email}</strong> and </> : "Your account and "}
          all its data are gone: your profile and photo, fields, satellite readings, weather records, alerts and answers. Our
          activity record no longer contains your name or email.
        </p>
        <p className="mt-3 text-sm leading-6 text-ink/75">
          {info?.emailed
            ? "We have sent a confirmation to your email address."
            : "Please keep this page or take a screenshot as your confirmation."}
          {info?.at && <> Deleted on {new Date(info.at).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })}.</>}
        </p>
        <p className="mt-3 text-xs leading-5 text-ink/60">
          Questions? Email <a className="font-medium text-growth-700 underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
        <Link to="/" className={`${auth.primary} mt-6 inline-flex items-center justify-center`}>
          Back to Growell
        </Link>
      </div>
    </AuthLayout>
  );
}
