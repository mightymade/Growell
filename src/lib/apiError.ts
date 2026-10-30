/**
 * Turns whatever Supabase (or the network) throws into one plain, friendly
 * sentence, and logs the real error to the console for debugging. Every
 * mutation in lib/api throws through this, so error handling looks the
 * same everywhere instead of each component guessing at error.message.
 */
export class AppError extends Error {}

export function toFriendlyError(err: unknown, fallback = "Something went wrong. Please try again."): AppError {
  // eslint-disable-next-line no-console
  console.error(err);

  if (!navigator.onLine) return new AppError("You're offline. Reconnect and try again.");

  const message = (err as { message?: string } | null)?.message ?? "";
  const status = (err as { status?: number } | null)?.status;

  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return new AppError("Couldn't reach the server. Check your connection and try again.");
  }
  if (status === 401 || /jwt|not authenticated|invalid_token/i.test(message)) {
    return new AppError("Your session has expired. Please log in again.");
  }
  if (status === 403 || /permission denied|rls|row-level security/i.test(message)) {
    return new AppError("You don't have permission to do that.");
  }
  if (status === 429 || /rate limit|too many requests/i.test(message)) {
    return new AppError("Too many attempts. Please wait a moment and try again.");
  }
  if (/duplicate key|already registered|already exists/i.test(message)) {
    return new AppError("That email is already registered. Try logging in instead.");
  }
  if (/invalid login credentials/i.test(message)) {
    return new AppError("Incorrect email or password.");
  }
  if (message) return new AppError(message);
  return new AppError(fallback);
}

/** Wraps a Supabase-style {data, error} result: returns data, or throws a friendly error. */
export function unwrap<T>({ data, error }: { data: T; error: unknown }): T {
  if (error) throw toFriendlyError(error);
  return data;
}
