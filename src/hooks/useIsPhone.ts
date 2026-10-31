import { useEffect, useState } from "react";

const QUERY = "(max-width: 767px)";

/** True below 768px wide, where the app uses its phone layout (no sidebar). */
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(() => typeof window !== "undefined" && window.matchMedia(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}

/**
 * True while the on-screen keyboard is probably open on a phone: a text
 * input has focus. The tab bar hides then, so it never floats over a form.
 */
export function useTypingOnPhone(): boolean {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const isText = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.isContentEditable || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
      if (el.tagName !== "INPUT") return false;
      const type = (el as HTMLInputElement).type;
      return !["checkbox", "radio", "button", "submit", "range", "file", "color"].includes(type);
    };
    const onIn = (e: FocusEvent) => setTyping(isText(e.target) && window.matchMedia(QUERY).matches);
    const onOut = () => setTimeout(() => setTyping(isText(document.activeElement) && window.matchMedia(QUERY).matches), 0);
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);
  return typing;
}
