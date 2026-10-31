import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signUp } from "../lib/api/auth";
import { updateProfile, changeProfilePhoto } from "../lib/api/account";
import { validateAvatarFile } from "../lib/avatar";
import { isPasswordValid } from "../lib/passwordPolicy";
import { checkAndStartCooldown } from "../lib/rateLimit";
import AuthLayout from "../components/AuthLayout";
import { BusyLabel } from "../components/Busy";
import { auth } from "../lib/authStyles";
import Avatar from "../components/Avatar";
import PasswordRequirements from "../components/PasswordRequirements";
import { MailIcon, LockIcon, EyeIcon, EyeOffIcon, UserIcon } from "../components/icons";

type Step = 1 | 2;

export default function Signup() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  // Which way the step change goes, so it slides in from the matching side.
  const [dir, setDir] = useState<"fwd" | "back" | null>(null);
  const stepAnim = dir === "fwd" ? "m-step-fwd" : dir === "back" ? "m-step-back" : "";

  // Step 1 — account
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  // Step 2 — profile (mirrors the `farmers` table: name, phone_number, location)
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    setPasswordTouched(true);
    setError(null);
    if (!isPasswordValid(password)) {
      setError("Your password doesn't meet all the requirements below yet.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setDir("fwd");
    setStep(2);
  }

  function handlePickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = validateAvatarFile(file);
    if (validationError) {
      setAvatarError(validationError);
      return;
    }
    setAvatarError(null);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (!agreed) {
      setError("Please tick the box to agree to the Terms of Use and Privacy Policy.");
      return;
    }
    // Client-side friction against repeated submissions; Supabase's own
    // sign-up endpoint is rate-limited server-side regardless.
    const cooldown = checkAndStartCooldown(`signup_${email.trim().toLowerCase()}`, 15 * 1000);
    if (!cooldown.allowed) {
      setError(`Please wait ${cooldown.retryInSeconds}s before trying again.`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await signUp({ email, password, name });

      if (result.needsConfirmation) {
        setAwaitingConfirmation(true);
        return;
      }

      // The photo can only upload now — Storage's RLS needs a real
      // authenticated session, which doesn't exist until signUp above
      // actually succeeds. Best-effort: a failed photo upload shouldn't
      // block finishing signup; they can add one later from Settings.
      if (avatarFile) {
        try {
          await changeProfilePhoto(avatarFile, result.userId);
        } catch {
          // Silently skip — profile/phone/location still get saved below.
        }
      }
      await updateProfile(result.userId, { name, phone, location });
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create your account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (awaitingConfirmation) {
    return (
      <AuthLayout>
        <div className="text-center">
          <h1 className={auth.heading}>Check your email</h1>
          <p className={`${auth.subtitle} leading-relaxed`}>
            We sent a confirmation link to {email}. Open it, then come back and log in.
            {avatarFile && " Add your profile photo from Settings once you're in. It couldn't upload before your account was confirmed."}
          </p>
          <Link
            to="/login"
            className={`mt-6 inline-flex items-center justify-center ${auth.primary}`}
          >
            Go to login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className={auth.heading}>Create your account</h1>
      <p className={auth.subtitle}>
        {step === 1 ? "Step 1 of 2: your login details" : "Step 2 of 2: a little about you"}
      </p>
      <div className="mx-auto mt-4 flex w-16 gap-2" aria-hidden>
        <div className={`h-1 flex-1 rounded-full transition-colors duration-panel ${step >= 1 ? "bg-growth-500" : "bg-canopy-900/10"}`} />
        <div className={`h-1 flex-1 rounded-full transition-colors duration-panel ${step >= 2 ? "bg-growth-500" : "bg-canopy-900/10"}`} />
      </div>

      {step === 1 && (
        <form onSubmit={handleContinue} className={`mt-7 ${stepAnim}`} noValidate>
          <label htmlFor="signup-email" className={auth.label}>Email</label>
          <div className="relative mb-4">
            <span className={auth.iconLeft}>
              <MailIcon />
            </span>
            <input
              id="signup-email"
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

          <label htmlFor="signup-password" className={auth.label}>Password</label>
          <div className="relative">
            <span className={auth.iconLeft}>
              <LockIcon />
            </span>
            <input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setPasswordTouched(true)}
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
          {(passwordTouched || password.length > 0) && <PasswordRequirements password={password} onLight />}

          <label htmlFor="signup-confirm" className={`mt-4 ${auth.label}`}>Confirm password</label>
          <div className="relative">
            <span className={auth.iconLeft}>
              <LockIcon />
            </span>
            <input
              id="signup-confirm"
              type={showConfirmPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`${auth.input} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              className={auth.iconRight}
            >
              {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>

          {error && <p role="alert" className={auth.error}>{error}</p>}

          <button
            type="submit"
            className={`mt-6 ${auth.primary}`}
          >
            Continue
          </button>

          <p className={auth.footer}>
            Already have an account?{" "}
            <Link to="/login" className={auth.link}>
              Log in
            </Link>
          </p>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleCreateAccount} className={`mt-7 ${stepAnim}`} noValidate>
          <label htmlFor="signup-name" className={auth.label}>Your name</label>
          <div className="relative mb-4">
            <span className={auth.iconLeft}>
              <UserIcon size={16} />
            </span>
            <input
              id="signup-name"
              type="text"
              required
              autoComplete="name"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={auth.input}
            />
          </div>

          <label htmlFor="signup-phone" className={auth.label}>Phone number <span className="font-normal text-ink/55">(optional)</span></label>
          <input
            id="signup-phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="e.g. 07XX XXX XXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={`mb-4 ${auth.inputPlain}`}
          />

          <label htmlFor="signup-location" className={auth.label}>District / location <span className="font-normal text-ink/55">(optional)</span></label>
          <input
            id="signup-location"
            type="text"
            autoComplete="address-level2"
            placeholder="e.g. Mukono"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className={`mb-4 ${auth.inputPlain}`}
          />

          <p className={auth.label}>Profile picture (optional)</p>
          <div className="flex items-center gap-3">
            <Avatar avatarUrl={avatarPreview} name={name} size={48} />
            <label className="cursor-pointer rounded-lg border border-canopy-900/12 px-3 py-2 text-sm font-medium text-ink hover:bg-parchment">
              {avatarFile ? "Change photo" : "Add photo"}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePickAvatar} className="hidden" />
            </label>
          </div>
          {avatarError && <p className="mt-2 text-xs text-laterite-700">{avatarError}</p>}

          {/* Consent before any data is saved (Data Protection and Privacy Act, s.7). */}
          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-lg bg-parchment p-3 text-sm leading-5 text-ink/80">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[#15884A]"
              aria-describedby="signup-consent-note"
            />
            <span>
              I am 18 or older, and I agree to the{" "}
              <Link to="/terms" target="_blank" className="font-medium text-growth-700 underline">
                Terms of Use
              </Link>{" "}
              and{" "}
              <Link to="/privacy" target="_blank" className="font-medium text-growth-700 underline">
                Privacy Policy
              </Link>
              , including my data being stored by Growell's service providers outside Uganda.
            </span>
          </label>
          <p id="signup-consent-note" className="mt-2 text-xs text-ink/60">
            You can download your data or delete your account at any time.
          </p>

          {error && <p role="alert" className={auth.error}>{error}</p>}

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => {
                setDir("back");
                setStep(1);
              }}
              className={auth.secondary}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 ${auth.primary}`}
            >
              <BusyLabel busy={loading} label="Create account" busyLabel="Creating account…" />
            </button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
