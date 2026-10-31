import { Link } from "react-router-dom";
import LegalPage, { Mail, type Section } from "./LegalPage";
import { OPERATOR, OPERATOR_ROLE } from "../../lib/legal";

const ul = "list-disc space-y-1 pl-6";
const link = "font-medium text-growth-700 underline-offset-2 hover:underline dark:text-growth-500";

const sections: Section[] = [
  {
    id: "about",
    title: "About Growell and these terms",
    body: (
      <>
        <p>
          Growell is a free web app that shows how healthy your crops are, using satellite images and weather data. It is run by {OPERATOR},{" "}
          {OPERATOR_ROLE}, as a final-year project. In these terms, "we" means {OPERATOR} and "you" means the person using Growell.
        </p>
        <p>
          By creating an account, you agree to these Terms of Use and to our{" "}
          <Link to="/privacy" className={link}>
            Privacy Policy
          </Link>
          . If you do not agree, please do not use Growell.
        </p>
      </>
    ),
  },
  {
    id: "who",
    title: "Who can use Growell",
    body: (
      <ul className={ul}>
        <li>You must be 18 or older.</li>
        <li>The details you give us must be true, and you must keep your email address up to date.</li>
        <li>Each account is for one person. Do not share your account.</li>
      </ul>
    ),
  },
  {
    id: "account",
    title: "Your account",
    body: (
      <ul className={ul}>
        <li>Keep your password secret. You are responsible for what happens in your account.</li>
        <li>
          If you think someone else has used your account, change your password and email <Mail /> straight away.
        </li>
        <li>Log out when you use a shared or public computer.</li>
      </ul>
    ),
  },
  {
    id: "fields",
    title: "Your fields and your data",
    body: (
      <>
        <ul className={ul}>
          <li>Only draw fields that you farm, own, or have permission to monitor.</li>
          <li>Your data stays yours. You let us use it only to run Growell, as explained in the Privacy Policy.</li>
          <li>You can download your data, correct it, or delete your account at any time in Settings.</li>
        </ul>
      </>
    ),
  },
  {
    id: "advice",
    title: "Readings and alerts are guidance, not guarantees",
    body: (
      <>
        <p>Please read this part carefully. Growell's readings come from satellites and weather services, and they have limits:</p>
        <ul className={ul}>
          <li>Clouds can block the satellite for days or weeks, so a reading may be old.</li>
          <li>Each satellite pixel covers 10 by 10 metres, so readings for small fields (under about half a hectare) are rough.</li>
          <li>Weather data and forecasts are estimates for your area, not measurements from your field.</li>
          <li>Alerts and their suggested causes are educated guesses, and they can be wrong.</li>
        </ul>
        <p>
          <strong>
            Always walk your field and check before you spend money or make a decision, such as spraying, watering or harvesting.
          </strong>{" "}
          Growell does not replace advice from an agricultural extension officer or agronomist.
        </p>
      </>
    ),
  },
  {
    id: "rules",
    title: "Fair use",
    body: (
      <>
        <p>When using Growell, you must not:</p>
        <ul className={ul}>
          <li>Try to get into other people's accounts or data, or get round Growell's security.</li>
          <li>Use automated tools to copy data from Growell, or overload it with requests.</li>
          <li>Upload anything illegal, harmful or offensive, including as your profile photo or in field names.</li>
          <li>Use Growell to break any law of Uganda.</li>
        </ul>
        <p>If you find a security problem, please tell us at <Mail /> instead of using it.</p>
      </>
    ),
  },
  {
    id: "service",
    title: "Changes to the service",
    body: (
      <p>
        Growell is free and is a student project. We work to keep it running, but we cannot promise it will always be available, error-free, or
        offered forever. We may change, pause or end the service. If we plan to end it, we will try to give you notice so you can download your
        data first.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Our responsibility to you",
    body: (
      <>
        <p>
          Growell is provided "as it is". As far as Ugandan law allows, we are not responsible for crop losses, costs or decisions you make based
          on Growell's readings, alerts or forecasts, or for losses caused by the service being unavailable.
        </p>
        <p>Nothing in these terms takes away rights you have under Ugandan law that cannot legally be taken away.</p>
      </>
    ),
  },
  {
    id: "ending",
    title: "Ending your use",
    body: (
      <ul className={ul}>
        <li>
          You can stop using Growell at any time. To delete your account and all your data, go to Settings, then Account, and choose
          "Delete my account". If you can't log in, email <Mail /> from your account's email address.
        </li>
        <li>
          We may suspend or close an account that breaks these terms or puts other users at risk. Where it is safe to, we will tell you why first.
        </li>
      </ul>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <p>
        If we change these terms, we will update the date at the top. For important changes, we will ask you to read and agree to the new
        version the next time you open Growell.
      </p>
    ),
  },
  {
    id: "law",
    title: "Law",
    body: <p>These terms are governed by the laws of Uganda.</p>,
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Questions about these terms: <Mail />.
      </p>
    ),
  },
];

export default function TermsOfUse() {
  return (
    <LegalPage
      title="Terms of Use"
      other={{ to: "/privacy", label: "Privacy Policy" }}
      summary={
        <ul className="list-disc space-y-1 pl-6">
          <li>Growell is free, for people aged 18 or over, and is run as a student project.</li>
          <li>Readings and alerts help you decide where to look. They can be wrong, so always check your field before acting.</li>
          <li>Keep your password safe, only draw land you farm, and don't misuse the service.</li>
          <li>Your data stays yours, and you can delete it at any time in Settings.</li>
        </ul>
      }
      sections={sections}
    />
  );
}
