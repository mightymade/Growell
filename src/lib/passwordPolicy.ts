export const PASSWORD_MIN_LENGTH = 8;

export type PasswordCheck = {
  minLength: boolean;
  upper: boolean;
  lower: boolean;
  number: boolean;
  symbol: boolean;
};

/** Checks a password against each rule independently, so the UI can show
 *  exactly which ones are met instead of one pass/fail message. */
export function checkPassword(pw: string): PasswordCheck {
  return {
    minLength: pw.length >= PASSWORD_MIN_LENGTH,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
    symbol: /[^A-Za-z0-9]/.test(pw),
  };
}

export function isPasswordValid(pw: string): boolean {
  const c = checkPassword(pw);
  return c.minLength && c.upper && c.lower && c.number && c.symbol;
}

export const PASSWORD_RULES: Array<{ key: keyof PasswordCheck; label: string }> = [
  { key: "minLength", label: `${PASSWORD_MIN_LENGTH} or more characters` },
  { key: "upper", label: "A capital letter" },
  { key: "lower", label: "A small letter" },
  { key: "number", label: "A number" },
  { key: "symbol", label: "A symbol, like ! or #" },
];
