import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { acceptTerms, acceptedTermsVersion } from "../lib/api/legal";
import { signOutAndLog } from "../lib/api/audit";
import { TERMS_VERSION } from "../lib/legal";
import Modal from "./Modal";
import { BusyLabel } from "./Busy";

/**
 * Makes sure every signed-in farmer has agreed to the current Terms of Use
 * and Privacy Policy. Someone who ticked the box at sign-up is recorded
 * quietly; anyone else (accounts made before the policy, or after it
 * changes) is asked once, and can't use the app until they agree or log out.
 */
export default function ConsentGate() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [signupConsent, setSignupConsent] = useState<{ version?: string; at?: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (!u) return;
      setUserId(u.id);
      const meta = (u.user_metadata ?? {}) as { terms_version?: string; terms_accepted_at?: string };
      setSignupConsent({ version: meta.terms_version, at: meta.terms_accepted_at });
    });
  }, []);

  const q = useQuery({
    queryKey: ["terms", userId],
    queryFn: () => acceptedTermsVersion(userId!),
    enabled: !!userId,
    staleTime: Infinity,
  });
  const needed = !!userId && q.isSuccess && q.data !== TERMS_VERSION;

  // Ticked the box at sign-up but confirmed by email first: record it now.
  const fromSignup = needed && signupConsent?.version === TERMS_VERSION;
  useEffect(() => {
    if (!fromSignup) return;
    acceptTerms(signupConsent?.at)
      .catch(() => {})
      .finally(() => qc.invalidateQueries({ queryKey: ["terms", userId] }));
  }, [fromSignup, signupConsent?.at, qc, userId]);

  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setSaving(true);
    setError(null);
    try {
      await acceptTerms();
      qc.setQueryData(["terms", userId], TERMS_VERSION);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your agreement. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={needed && !fromSignup}
      onClose={() => {}}
      dismissible={false}
      role="alertdialog"
      size="md"
      title="Please review our Terms and Privacy Policy"
      description="Growell now has a Privacy Policy and Terms of Use. Please read and agree to keep using the app."
      footer={
        <>
          <button
            type="button"
            onClick={() => signOutAndLog("button")}
            className="h-10 rounded-lg border border-canopy-900/15 px-4 text-sm font-medium text-ink hover:bg-parchment dark:border-white/15 dark:text-parchment dark:hover:bg-white/5"
          >
            Log out
          </button>
          <button
            type="button"
            onClick={accept}
            disabled={!agreed || saving}
            data-autofocus
            className="h-10 rounded-lg bg-growth-600 px-4 text-sm font-semibold text-white hover:bg-growth-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <BusyLabel busy={saving} label="Agree and continue" busyLabel="Saving…" />
          </button>
        </>
      }
    >
      <ul className="list-disc space-y-1 pl-5 text-sm text-ink/80 dark:text-parchment/80">
        <li>We use your data only to run Growell and to check how well it works. We never sell it.</li>
        <li>Some services we use store data outside Uganda.</li>
        <li>Readings and alerts are guidance. Always check your field before acting.</li>
        <li>You can download your data, or delete your account, at any time in Settings.</li>
      </ul>
      <p className="mt-3 text-sm">
        Read the full{" "}
        <Link to="/privacy" target="_blank" className="font-medium text-growth-700 underline dark:text-growth-500">
          Privacy Policy
        </Link>{" "}
        and{" "}
        <Link to="/terms" target="_blank" className="font-medium text-growth-700 underline dark:text-growth-500">
          Terms of Use
        </Link>
        .
      </p>
      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg bg-parchment p-3 text-sm leading-5 text-ink/85 dark:bg-white/5 dark:text-parchment/85">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#15884A]" />
        <span>I am 18 or older, and I agree to the Terms of Use and Privacy Policy, including my data being stored outside Uganda.</span>
      </label>
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-laterite-50 px-3 py-2 text-sm text-laterite-700">
          {error}
        </p>
      )}
    </Modal>
  );
}
