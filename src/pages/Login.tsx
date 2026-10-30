import { useState } from "react";
import { Link } from "react-router-dom";
import { signIn, requestPasswordReset } from "../lib/api/auth";
import { checkLoginLockout, recordLoginFailure, recordLoginSuccess, checkAndStartCooldown } from "../lib/rateLimit";
import AuthLayout from "../components/AuthLayout";
import { BusyLabel } from "../components/Busy";
import { auth } from "../lib/authStyles";
import { MailIcon, LockIcon, EyeIcon, EyeOffIcon } from "../components/icons";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [lockedFor, setLockedFor] = useState(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side only: friction against rapid retries, not real security —
    // see lib/rateLimit.ts. Supabase's own server-side limit is what
    // actually protects this endpoint.
    const lock = checkLoginLockout(email);
    if (lock.locked) {
      setLockedFor(lock.retryInSeconds);
      setError(`Too many attempts. Try again in ${lock.retryInSeconds} seconds.`);
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      recordLoginSuccess(email);
    } catch (err) {
      recordLoginFailure(email);
      setError(err instanceof Error ? err.message : "Couldn't log in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      setError("Enter your email above first, then tap \u201cForgot password\u201d.");
      return;
    }
    const cooldown = checkAndStartCooldown(`reset_${email.trim().toLowerCase()}`, 60 * 1000);
    if (!cooldown.allowed) {
      setError(`A reset email was just sent. You can request another in ${cooldown.retryInSeconds}s.`);
      return;
    }
    setError(null);
    try {
      await requestPasswordReset(email);
      setResetSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the reset email. Please try again.");
    }
  }


  return (
    <AuthLayout>
      <h1 className={auth.heading}>Welcome back</h1>
      <p className={auth.subtitle}>Log in to see what changed in your fields.</p>

      <form onSubmit={handleSubmit} className="mt-7" noValidate>
        <label htmlFor="login-email" className={auth.label}>Email</label>
        <div className="relative mb-4">
          <span className={auth.iconLeft}>
            <MailIcon />
          </span>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={auth.input}
          />
        </div>

        <div className="mb-2 flex items-baseline justify-between">
          <label htmlFor="login-password" className="block text-sm font-medium text-ink/80">Password</label>
          <button type="button" onClick={handleForgotPassword} className="text-sm font-medium text-growth-700 hover:underline">
            Forgot password?
          </button>
        </div>
        <div className="relative">
          <span className={auth.iconLeft}>
            <LockIcon />
          </span>
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${auth.input} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className={auth.iconRight}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>


        {resetSent && (
          <p className="mt-4 rounded-lg bg-sky-100 px-4 py-3 text-sm text-sky-700">
            Check your email for a link to reset your password.
          </p>
        )}
        {error && (
          <p role="alert" className={auth.error}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || lockedFor > 0}
          className={`mt-6 ${auth.primary}`}
        >
          <BusyLabel busy={loading} label="Log in" busyLabel="Logging in…" />
        </button>

        <p className={auth.footer}>
          Don&apos;t have an account?{" "}
          <Link to="/signup" className={auth.link}>
            Sign up
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
