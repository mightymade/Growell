import Modal from "./Modal";

type Props = {
  secondsLeft: number;
  onStaySignedIn: () => void;
};

/** Shown 60 seconds before an inactivity logout, so it never happens
 *  silently mid-task. Escape, the backdrop and the button all keep the
 *  farmer signed in. Screen readers hear the message once when it opens. */
export default function IdleWarningModal({ secondsLeft, onStaySignedIn }: Props) {
  return (
    <Modal
      open
      onClose={onStaySignedIn}
      role="alertdialog"
      title="Still there?"
      description={
        <>
          For your security, you'll be signed out in{" "}
          <span className="font-semibold tabular-nums text-ink dark:text-parchment">{secondsLeft} seconds</span>. Your data
          is safe either way.
        </>
      }
      footer={
        <button
          onClick={onStaySignedIn}
          data-autofocus
          className="h-10 w-full rounded-lg bg-growth-600 px-4 text-sm font-semibold text-white hover:bg-growth-700 sm:w-auto"
        >
          Stay signed in
        </button>
      }
    />
  );
}
