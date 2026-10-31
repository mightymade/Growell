import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useIsPhone } from "../hooks/useIsPhone";
import Modal from "../components/Modal";
import { supabase } from "../lib/supabase";
import { useFarmerProfile } from "../hooks/useFarmerProfile";
import { updateProfile, requestEmailChange, changePassword, setAccountActive, changeProfilePhoto } from "../lib/api/account";
import { validateAvatarFile } from "../lib/avatar";
import { isPasswordValid } from "../lib/passwordPolicy";
import { checkAndStartCooldown } from "../lib/rateLimit";
import Avatar from "../components/Avatar";
import PasswordRequirements from "../components/PasswordRequirements";
import { LogoutIcon, CameraIcon, UserIcon, LockIcon, SunIcon, ChevronRightIcon } from "../components/icons";
import { SettingsSkeleton } from "../components/Skeleton";
import ThemeToggle from "../components/ThemeToggle";
import { BusyLabel } from "../components/Busy";

const inputClass =
  "h-10 w-full rounded-lg border border-canopy-900/12 bg-white px-4 text-base text-ink transition-colors placeholder:text-ink/65 hover:border-canopy-900/25 focus:border-growth-500 focus:outline-none focus:ring-[3px] focus:ring-growth-500/15 dark:border-white/15 dark:bg-night-950 dark:text-parchment dark:placeholder:text-parchment/65 dark:hover:border-white/25";
const labelClass = "mb-2 block text-sm font-medium text-ink/80 dark:text-parchment/80";
const primaryButton =
  "h-10 rounded-lg bg-growth-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-growth-700 disabled:opacity-50";

type Section = "profile" | "password" | "appearance" | "account";
const SECTIONS: Array<{ id: Section; label: string; Icon: (p: { size?: number }) => JSX.Element }> = [
  { id: "profile", label: "Profile", Icon: UserIcon },
  { id: "password", label: "Password", Icon: LockIcon },
  { id: "appearance", label: "Appearance", Icon: SunIcon },
  { id: "account", label: "Account", Icon: LogoutIcon },
];

export default function Account() {
  const { profile, loading, refetch } = useFarmerProfile();
  // The open section lives in the URL (?section=password), so a refresh or
  // a shared link lands on the same section.
  // Phones: each section is its own screen at /settings/<section>, and
  // /settings itself is the list of sections.
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const isPhone = useIsPhone();
  const fromRoute = SECTIONS.find((x) => x.id === useParams().section)?.id;
  const fromQuery = SECTIONS.find((x) => x.id === params.get("section"))?.id;
  const section: Section | null = isPhone ? fromRoute ?? null : fromRoute ?? fromQuery ?? "profile";
  const openSection = (id: Section) =>
    isPhone ? navigate(`/settings/${id}`) : setParams(id === "profile" ? {} : { section: id }, { replace: true });
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [emailChangePending, setEmailChangePending] = useState(false);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const profileDirty =
    !!profile &&
    (name !== profile.name || email !== profile.email || phone !== (profile.phone_number ?? "") || location !== (profile.location ?? ""));

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setEmail(profile.email);
      setPhone(profile.phone_number ?? "");
      setLocation(profile.location ?? "");
    }
  }, [profile]);

  async function handleSignOut() {
    setSignOutError(null);
    const { error } = await supabase.auth.signOut();
    if (error) setSignOutError("Couldn't sign out. Please check your connection and try again.");
  }

  // Changing your photo saves immediately, the moment you pick a file —
  // it's a distinct action, not one more field waiting on "Save changes".
  async function handlePickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !profile) return;

    const validationError = validateAvatarFile(file);
    if (validationError) {
      setAvatarError(validationError);
      return;
    }
    // Friction against accidental repeated uploads (e.g. a slow tap
    // registering twice) — not a real security limit, see lib/rateLimit.ts.
    const cooldown = checkAndStartCooldown(`avatar_${profile.id}`, 5 * 1000);
    if (!cooldown.allowed) return;

    setAvatarError(null);
    setUploadingAvatar(true);
    try {
      await changeProfilePhoto(file, profile.id);
      await refetch();
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Couldn't upload that photo.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSavingProfile(true);
    setProfileError(null);
    setProfileSaved(false);
    setEmailChangePending(false);

    try {
      // Email lives in Supabase Auth, not the farmers table — changing it
      // goes through its own confirmation flow, separate from the rest.
      if (email.trim() !== profile.email) {
        await requestEmailChange(email.trim());
        setEmailChangePending(true);
      }
      await updateProfile(profile.id, { name, phone, location });
      setProfileSaved(true);
      refetch();
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Couldn't save your profile. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordTouched(true);
    setPasswordError(null);
    setPasswordSaved(false);
    if (!isPasswordValid(newPassword)) {
      setPasswordError("Your new password doesn't meet all the requirements below yet.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match.");
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(newPassword);
      setPasswordSaved(true);
      setNewPassword("");
      setConfirmPassword("");
      setPasswordTouched(false);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Couldn't update your password. Please try again.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleDeactivate() {
    if (!profile) return;
    setDeactivating(true);
    setDeactivateError(null);
    try {
      await setAccountActive(profile.id, false);
      await supabase.auth.signOut();
    } catch (err) {
      setDeactivateError(err instanceof Error ? err.message : "Couldn't deactivate your account. Please try again.");
      setDeactivating(false);
    }
  }

  if (loading) return <SettingsSkeleton />;
  if (!profile) return null;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-5 hidden font-display text-2xl font-semibold tracking-tight text-ink dark:text-parchment md:block">Settings</h1>

      {/* Phones: the Settings screen is a list; each row opens its section. */}
      {isPhone && !section && (
        <div className="space-y-6">
          <button
            onClick={() => openSection("profile")}
            className="flex w-full items-center gap-4 rounded-xl bg-white p-4 text-left shadow-e1 transition-colors active:bg-parchment dark:bg-night-900 dark:active:bg-white/5"
          >
            <Avatar avatarUrl={profile.avatar_url} name={profile.name} size={56} className="text-xl" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-semibold text-ink dark:text-parchment">{profile.name}</span>
              <span className="block truncate text-sm text-ink/70 dark:text-parchment/70">{profile.email}</span>
            </span>
            <span className="text-ink/40 dark:text-parchment/40" aria-hidden>
              <ChevronRightIcon />
            </span>
          </button>
          <nav aria-label="Settings sections" className="divide-y divide-canopy-900/5 overflow-hidden rounded-xl bg-white shadow-e1 dark:divide-white/5 dark:bg-night-900">
            {SECTIONS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => openSection(id)}
                className="flex h-14 w-full items-center gap-3 px-4 text-left text-base text-ink transition-colors active:bg-parchment dark:text-parchment dark:active:bg-white/5"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-parchment text-ink/70 dark:bg-white/5 dark:text-parchment/70" aria-hidden>
                  <Icon size={16} />
                </span>
                <span className="flex-1">{label}</span>
                <span className="text-ink/40 dark:text-parchment/40" aria-hidden>
                  <ChevronRightIcon />
                </span>
              </button>
            ))}
          </nav>
        </div>
      )}

      {section && (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[220px_1fr] md:items-start">
        {/* Section menu: a column on computers. Phones use the list above. */}
        <nav
          aria-label="Settings sections"
          className="hidden md:sticky md:top-4 md:flex md:flex-col md:gap-1 md:rounded-xl md:bg-white md:p-2 md:shadow-e1 md:dark:bg-night-900"
        >
          {SECTIONS.map(({ id, label, Icon }) => {
            const active = section === id;
            return (
              <button
                key={id}
                onClick={() => openSection(id)}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-growth-50 text-growth-700 dark:bg-growth-700/20 dark:text-growth-500"
                    : "text-ink/70 hover:bg-parchment hover:text-ink dark:text-parchment/70 dark:hover:bg-white/5 dark:hover:text-parchment"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            );
          })}
        </nav>

        {/* Keyed by section so switching sections cross-fades the panel. */}
        <div key={section} className="m-page rounded-xl bg-white p-4 shadow-e1 dark:bg-night-900 sm:p-7">
          {section === "profile" && (
            <form id="settings-profile-form" onSubmit={handleSaveProfile} noValidate className={isPhone && profileDirty ? "pb-24" : undefined}>
              <PanelHeading title="Profile" note="Your name and how Growell can reach you." />

              <div className="mb-7 flex flex-col items-center gap-4 text-center md:flex-row md:flex-wrap md:gap-5 md:text-left">
                <div className="relative">
                  <Avatar avatarUrl={profile.avatar_url} name={profile.name} size={88} className="text-3xl" />
                  <label
                    className={`absolute bottom-0 right-0 hidden h-8 w-8 items-center justify-center rounded-full bg-growth-600 text-white shadow ring-[3px] ring-white dark:ring-night-900 md:flex ${
                      uploadingAvatar ? "opacity-50" : "cursor-pointer hover:bg-growth-700"
                    }`}
                    title="Change photo"
                  >
                    <CameraIcon size={15} />
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePickAvatar} disabled={uploadingAvatar} className="hidden" />
                  </label>
                </div>
                <div>
                  <label
                    className={`inline-flex h-11 items-center gap-2 rounded-lg border border-canopy-900/12 px-4 text-sm font-medium text-ink transition-colors active:bg-parchment dark:border-white/15 dark:text-parchment md:h-10 ${
                      uploadingAvatar ? "opacity-50" : "cursor-pointer hover:bg-parchment dark:hover:bg-white/5"
                    }`}
                  >
                    <span className="md:hidden" aria-hidden>
                      <CameraIcon size={15} />
                    </span>
                    <BusyLabel busy={uploadingAvatar} label={isPhone ? "Change photo" : "Upload new photo"} busyLabel="Uploading…" />
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePickAvatar} disabled={uploadingAvatar} className="hidden" />
                  </label>
                  {avatarError ? (
                    <p className="mt-2 text-xs text-laterite-700">{avatarError}</p>
                  ) : (
                    <p className="mt-2 text-xs text-ink/65 dark:text-parchment/65">JPG, PNG or WEBP, up to 2 MB.</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                <Field id="settings-name" label="Name">
                  <input id="settings-name" type="text" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
                </Field>
                <Field id="settings-phone" label="Phone number">
                  <input
                    id="settings-phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 07XX XXX XXX"
                    className={inputClass}
                  />
                </Field>
                <Field id="settings-email" label="Email">
                  <input
                    id="settings-email"
                    type="email"
                    required
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field id="settings-location" label="District / location">
                  <input
                    id="settings-location"
                    type="text"
                    autoComplete="address-level2"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Mukono"
                    className={inputClass}
                  />
                </Field>
              </div>

              {profileError && <Notice tone="error">{profileError}</Notice>}
              {emailChangePending && (
                <Notice tone="info">Confirmation link sent to your new email. The change takes effect once you open it.</Notice>
              )}

              <div className="mt-7 hidden items-center gap-3 border-t border-canopy-900/5 pt-5 dark:border-white/5 md:flex">
                <button type="submit" disabled={savingProfile} className={primaryButton}>
                  <BusyLabel busy={savingProfile} label="Save changes" busyLabel="Saving…" />
                </button>
                {profileSaved && !emailChangePending && <span role="status" className="m-in text-sm text-growth-700 dark:text-growth-500">Saved</span>}
              </div>

              {/* Phones: a Save bar floats above the tab bar once something has
                  changed. It is rendered on the page body (outside the animated
                  page wrapper, which would otherwise pin it to the card) and
                  submits this form through its id. */}
              {isPhone &&
                (profileDirty || savingProfile) &&
                createPortal(
                  <div className="m-in phone-above-tabbar fixed inset-x-4 z-30 rounded-xl bg-white p-3 shadow-e3 dark:bg-night-900">
                    <button type="submit" form="settings-profile-form" disabled={savingProfile} className={`${primaryButton} h-12 w-full text-base`}>
                      <BusyLabel busy={savingProfile} label="Save changes" busyLabel="Saving…" />
                    </button>
                  </div>,
                  document.body,
                )}
              {isPhone &&
                profileSaved &&
                !emailChangePending &&
                createPortal(
                  <span
                    role="status"
                    className="m-in fixed inset-x-0 top-[calc(var(--mtop)+var(--safe-top)+12px)] z-30 mx-auto w-fit rounded-full bg-growth-600 px-4 py-2 text-sm font-medium text-white shadow-e2"
                  >
                    Saved
                  </span>,
                  document.body,
                )}
            </form>
          )}

          {section === "password" && (
            <form onSubmit={handleChangePassword} noValidate className="max-w-md">
              <PanelHeading title="Password" note="Choose a new password you don't use anywhere else." />

              <Field id="settings-new-password" label="New password">
                <input
                  id="settings-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onBlur={() => setPasswordTouched(true)}
                  placeholder="Enter a new password"
                  className={inputClass}
                />
              </Field>
              {(passwordTouched || newPassword.length > 0) && <PasswordRequirements password={newPassword} />}

              <div className="mt-4">
                <Field id="settings-confirm-password" label="Confirm new password">
                  <input
                    id="settings-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter the new password"
                    className={inputClass}
                  />
                </Field>
              </div>

              {passwordError && <Notice tone="error">{passwordError}</Notice>}

              <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-canopy-900/5 pt-5 dark:border-white/5">
                <button type="submit" disabled={savingPassword} className={`${primaryButton} max-md:h-12 max-md:w-full max-md:text-base`}>
                  <BusyLabel busy={savingPassword} label="Update password" busyLabel="Updating…" />
                </button>
                {passwordSaved && <span role="status" className="m-in text-sm text-growth-700 dark:text-growth-500">Password updated</span>}
              </div>
            </form>
          )}

          {section === "appearance" && (
            <div>
              <PanelHeading title="Appearance" note="Choose how Growell looks on this device." />
              <ThemeToggle bare />
            </div>
          )}

          {section === "account" && (
            <div>
              <PanelHeading title="Account" note="Sign out, or pause your account." />

              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-canopy-900/5 pb-6 dark:border-white/5">
                <div>
                  <p className="text-sm font-medium text-ink dark:text-parchment">Sign out</p>
                  <p className="mt-1 text-sm text-ink/65 dark:text-parchment/65">Signed in as {profile.email}</p>
                </div>
                <button
                  onClick={() => (isPhone ? setConfirmingSignOut(true) : handleSignOut())}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-canopy-900/12 px-4 text-base font-medium text-ink transition-colors hover:bg-parchment active:bg-parchment dark:border-white/15 dark:text-parchment dark:hover:bg-white/5 md:h-10 md:w-auto md:text-sm"
                >
                  <LogoutIcon size={15} />
                  Sign out
                </button>
                {signOutError && <p role="alert" className="w-full text-xs text-laterite-700">{signOutError}</p>}
              </div>

              <div className="pt-6">
                <p className="text-sm font-medium text-ink dark:text-parchment">Deactivate account</p>
                {!confirmingDeactivate || isPhone ? (
                  <>
                    <p className="mt-1 max-w-lg text-sm text-ink/65 dark:text-parchment/65">
                      Hides your fields and data until you log in again and reactivate. Nothing is deleted.
                    </p>
                    <button
                      onClick={() => setConfirmingDeactivate(true)}
                      className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-lg border border-laterite-700/25 px-4 text-base font-medium text-laterite-700 transition-colors hover:bg-laterite-50 active:bg-laterite-50 md:h-10 md:w-auto md:text-sm"
                    >
                      Deactivate account
                    </button>
                  </>
                ) : (
                  <div className="mt-3 max-w-lg rounded-lg bg-laterite-50 p-4">
                    <p className="text-sm text-laterite-700">
                      You'll be signed out straight away. Log back in any time to reactivate, and your fields and
                      history will be exactly as you left them.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => setConfirmingDeactivate(false)}
                        disabled={deactivating}
                        className="h-9 rounded-lg border border-laterite-700/20 bg-white px-3 text-sm font-medium text-ink hover:bg-parchment disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeactivate}
                        disabled={deactivating}
                        className="h-9 rounded-lg bg-laterite-700 px-3 text-sm font-semibold text-white hover:bg-laterite-700/90 disabled:opacity-50"
                      >
                        <BusyLabel busy={deactivating} label="Yes, deactivate" busyLabel="Deactivating…" />
                      </button>
                    </div>
                    {deactivateError && <p role="alert" className="mt-2 text-xs text-laterite-700">{deactivateError}</p>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Phones: sign out and deactivate are confirmed in bottom sheets. */}
      <Modal
        open={isPhone && confirmingSignOut}
        onClose={() => setConfirmingSignOut(false)}
        role="alertdialog"
        title="Sign out of Growell?"
        description={`You can sign back in any time as ${profile.email}.`}
        footer={
          <>
            <button onClick={() => setConfirmingSignOut(false)} data-autofocus className="rounded-lg border border-canopy-900/15 text-base font-medium text-ink dark:border-white/15 dark:text-parchment">
              Stay signed in
            </button>
            <button onClick={handleSignOut} className="rounded-lg bg-ink text-base font-semibold text-white dark:bg-parchment dark:text-ink">
              Sign out
            </button>
          </>
        }
      />
      <Modal
        open={isPhone && confirmingDeactivate}
        onClose={() => !deactivating && setConfirmingDeactivate(false)}
        role="alertdialog"
        title="Deactivate your account?"
        description="You'll be signed out straight away. Log back in any time to reactivate, and your fields and history will be exactly as you left them."
        footer={
          <>
            <button onClick={() => setConfirmingDeactivate(false)} disabled={deactivating} data-autofocus className="rounded-lg border border-canopy-900/15 text-base font-medium text-ink disabled:opacity-50 dark:border-white/15 dark:text-parchment">
              Keep my account
            </button>
            <button onClick={handleDeactivate} disabled={deactivating} className="rounded-lg bg-laterite-700 text-base font-semibold text-white disabled:opacity-50">
              <BusyLabel busy={deactivating} label="Yes, deactivate" busyLabel="Deactivating…" />
            </button>
          </>
        }
      >
        {deactivateError && <p role="alert" className="pb-2 text-sm text-laterite-700">{deactivateError}</p>}
      </Modal>
    </div>
  );
}

function PanelHeading({ title, note }: { title: string; note: string }) {
  return (
    <div className="mb-5 md:mb-6">
      {/* Phones show the section name in the top bar, so only the note here. */}
      <h2 className="hidden font-display text-lg font-semibold text-ink dark:text-parchment md:block">{title}</h2>
      <p className="text-sm text-ink/65 dark:text-parchment/65 md:mt-1">{note}</p>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Notice({ tone, children }: { tone: "error" | "info"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : undefined}
      className={`mt-5 rounded-lg px-4 py-3 text-sm ${
        tone === "error" ? "bg-laterite-50 text-laterite-700" : "bg-sky-100 text-sky-700"
      }`}
    >
      {children}
    </p>
  );
}
