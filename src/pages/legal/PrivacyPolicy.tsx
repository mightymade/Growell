import { Link } from "react-router-dom";
import LegalPage, { LegalTable, Mail, type Section } from "./LegalPage";
import { OPERATOR, OPERATOR_ROLE, PDPO_URL } from "../../lib/legal";

const ul = "list-disc space-y-1 pl-6";
const link = "font-medium text-growth-700 underline-offset-2 hover:underline dark:text-growth-500";

const sections: Section[] = [
  {
    id: "who",
    title: "Who we are",
    body: (
      <>
        <p>
          Growell is a free web app that uses satellite images and weather data to show farmers how healthy their crops are. It is run by{" "}
          {OPERATOR}, {OPERATOR_ROLE}, as a final-year project.
        </p>
        <p>
          For your personal data, {OPERATOR} is the <strong>data controller</strong>: the person who decides why and how it is used, and who
          answers to you for it. You can reach us at <Mail />.
        </p>
        <p>
          This policy follows Uganda's Data Protection and Privacy Act, 2019 (Cap. 97) and the Data Protection and Privacy Regulations, 2021.
        </p>
      </>
    ),
  },
  {
    id: "collect",
    title: "What we collect, and why",
    body: (
      <>
        <p>We only collect what Growell needs to work. We collect it from you directly, when you sign up and use the app.</p>
        <LegalTable
          head={["What", "Why we need it", "Do you have to give it?"]}
          rows={[
            ["Email address", "To log you in, confirm your account and reset your password.", "Yes, the account needs it."],
            ["Password", "To log you in. It is stored scrambled (hashed), so nobody can read it, including us.", "Yes."],
            ["Your name", "To greet you and label your account.", "Yes."],
            ["Phone number", "To help us contact you about your account if needed. We do not send you marketing messages.", "No, it is optional."],
            ["District or location", "To understand where Growell is used.", "No, it is optional."],
            ["Profile photo", "To show on your account.", "No, it is optional."],
            [
              "Your fields: the outline you draw, name, crop, size and planting date",
              "To fetch satellite and weather readings for that land and work out your crop's growth stage.",
              "The outline, name and crop are needed to monitor a field. The planting date is optional.",
            ],
            [
              "Readings about your fields: crop health, rain, temperature, humidity",
              "To show your charts and spot drops in crop health.",
              "Made by Growell from the field outline.",
            ],
            ["Alerts and your answers to them", "To warn you about problems, and to check how often our alerts are right.", "Answering is optional."],
            [
              "An activity record: account created, logged in and out, fields added, edited or deleted, alerts answered, profile changes",
              "To keep the service secure, find faults, and show what happened if something goes wrong.",
              "Recorded automatically while you use Growell.",
            ],
            [
              "Your record of agreeing to these terms: which version and when",
              "To show that you agreed, as the law requires.",
              "Recorded when you agree.",
            ],
          ]}
        />
        <p>
          We do <strong>not</strong> collect special personal data, such as health, religion, political opinions or financial details. Please do
          not type any of these into field names or alert answers.
        </p>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use it",
    body: (
      <>
        <ul className={ul}>
          <li>To run your account and show you your fields, charts, alerts and weather.</li>
          <li>To check your fields every day for new satellite images and alert you to problems.</li>
          <li>To keep Growell secure and working, for example by spotting failed checks or misuse.</li>
          <li>
            To measure how well Growell works, for the final-year project report. Any results we publish are totals, such as "70% of alerts were
            confirmed", never information that identifies you.
          </li>
        </ul>
        <p>
          We do <strong>not</strong> sell your data, show you adverts, or use your data for marketing. We do not make decisions about you that
          have legal or similar effects using automated tools. Alerts are suggestions for you to check, not decisions.
        </p>
      </>
    ),
  },
  {
    id: "basis",
    title: "Your consent",
    body: (
      <>
        <p>
          We collect and use your personal data because you agree to it when you create your account (section 7 of the Act). You tick a box to
          say so, and we keep a record of which version of this policy you agreed to, and when.
        </p>
        <p>
          You can withdraw your consent at any time by deleting your account (see{" "}
          <a href="#rights" className={link}>
            Your rights
          </a>
          ). Withdrawing does not make what we did before unlawful, but we will stop and delete your data as described below.
        </p>
      </>
    ),
  },
  {
    id: "share",
    title: "Who receives your data",
    body: (
      <>
        <p>Growell uses these services to work. Each one only gets what it needs:</p>
        <LegalTable
          head={["Service", "What it gets", "Why"]}
          rows={[
            ["Supabase", "Everything in your account: login details, profile, fields, readings, alerts and the activity record.", "It stores Growell's database, handles logging in and sends account emails."],
            ["Vercel", "Your internet (IP) address and the pages you load.", "It hosts the Growell website."],
            ["Copernicus Data Space Ecosystem (European Union)", "The outline of your fields, but not your name or email.", "It provides the Sentinel-2 satellite images."],
            ["Open-Meteo", "The centre point of your fields, but not your name or email.", "It provides weather and forecasts."],
            ["Esri", "Your internet address and the map area you look at.", "It provides the satellite map pictures."],
            ["Google Fonts", "Your internet address.", "It provides the font the app uses."],
          ]}
        />
        <p>
          The person running Growell (the admin) can see account details, fields and the activity record, to run and fix the service. Every admin
          view is read-only.
        </p>
        <p>We will only share your data with anyone else if Ugandan law requires it, for example a valid court order.</p>
      </>
    ),
  },
  {
    id: "abroad",
    title: "Storage outside Uganda",
    body: (
      <>
        <p>
          The services above run on servers outside Uganda, for example in Europe or the United States. Section 19 of the Act allows this when the
          other country protects personal data at least as well as Uganda does, or when you agree to it.
        </p>
        <p>
          When you create your account, you agree that your data may be stored and processed outside Uganda by these services. They use
          encrypted connections and their own security controls, and we choose services that publish their data protection terms.
        </p>
      </>
    ),
  },
  {
    id: "keep",
    title: "How long we keep it",
    body: (
      <>
        <ul className={ul}>
          <li>
            <strong>While your account is open,</strong> we keep your data so Growell can work.
          </li>
          <li>
            <strong>When you delete a field,</strong> it disappears from your account straight away. We keep a copy of that field and its readings
            on record until your account is deleted, so the activity record stays complete.
          </li>
          <li>
            <strong>When your account is deleted,</strong> we immediately delete your profile, photo, fields, readings, alerts and answers. In the activity
            record we remove your name, email and anything you typed, so the entries only say "Deleted user". These entries no longer identify
            you (section 18 of the Act).
          </li>
          <li>
            <strong>Backups:</strong> our providers may keep backup copies for a short time before they are overwritten.
          </li>
        </ul>
        <p>Deactivating your account in Settings only hides it. It does not delete anything. To delete, see the next section.</p>
      </>
    ),
  },
  {
    id: "rights",
    title: "Your rights",
    body: (
      <>
        <p>Under the Act you have the right to:</p>
        <ul className={ul}>
          <li>
            <strong>See your data</strong> (section 24). Download a copy any time from{" "}
            <Link to="/settings/account" className={link}>
              Settings, then Account
            </Link>
            , or email us. We reply within 30 days.
          </li>
          <li>
            <strong>Correct it</strong> (section 16). Change your name, phone, location, photo or email in Settings, or email us.
          </li>
          <li>
            <strong>Delete it</strong> (section 16). In{" "}
            <Link to="/settings/account" className={link}>
              Settings, then Account
            </Link>
            , choose "Delete my account" and enter your password. Your account and data are deleted straight away, and we email you a
            confirmation. If you can't log in, email <Mail /> from your account's email address and we will delete it within 30 days.
          </li>
          <li>
            <strong>Withdraw your consent</strong> at any time, by deleting your account.
          </li>
          <li>
            <strong>Object</strong> to any use of your data (section 25), and we will reply in writing within 14 days.
          </li>
          <li>
            <strong>Complain</strong> to the Personal Data Protection Office (PDPO) (section 31) if you think we have mishandled your data:{" "}
            <a href={PDPO_URL} className={link} target="_blank" rel="noreferrer">
              pdpo.go.ug
            </a>
            . We would like the chance to fix it first, so please email us too.
          </li>
        </ul>
        <p>To protect your account, we may ask you to confirm it is really you before acting on a request.</p>
      </>
    ),
  },
  {
    id: "security",
    title: "How we keep it safe",
    body: (
      <>
        <ul className={ul}>
          <li>All connections to Growell are encrypted (HTTPS).</li>
          <li>Passwords are hashed, and Growell asks for strong passwords.</li>
          <li>Database rules make sure each farmer can only ever see their own data.</li>
          <li>Admin access is limited to the person running Growell, is read-only, and is checked by the database on every request.</li>
          <li>Important actions are written to an activity record that cannot be changed or deleted.</li>
          <li>You are logged out after a period of inactivity, and closing the browser tab logs you out.</li>
        </ul>
        <p>
          No system is perfectly secure. If a data breach puts your personal data at risk, we will tell the PDPO straight away, as section 23
          of the Act requires, and tell you as the PDPO directs.
        </p>
      </>
    ),
  },
  {
    id: "storage",
    title: "Cookies and browser storage",
    body: (
      <>
        <p>Growell does not use advertising or tracking cookies. It stores a few things in your browser so the app works:</p>
        <ul className={ul}>
          <li>Your login, in this browser tab only. It is cleared when you close the tab.</li>
          <li>Your settings, such as light or dark mode and whether the sidebar is open.</li>
          <li>A copy of your recent data so the app opens quickly on a slow connection. It is cleared when you log out.</li>
        </ul>
        <p>You can clear these at any time in your browser settings.</p>
      </>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: <p>Growell is for people aged 18 or over. We do not knowingly collect data about children (section 8 of the Act). If you believe a child has created an account, email us and we will delete it.</p>,
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        If we change this policy, we will update the date at the top. If the change affects how we use your data, we will ask you to read and
        agree to the new version the next time you open Growell.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        For any question or request about your data, email {OPERATOR} at <Mail />.
      </p>
    ),
  },
];

export default function PrivacyPolicy() {
  return (
    <LegalPage
      title="Privacy Policy"
      other={{ to: "/terms", label: "Terms of Use" }}
      summary={
        <ul className="list-disc space-y-1 pl-6">
          <li>We collect your email, name, the fields you draw, and what you do in the app. Phone, location and photo are optional.</li>
          <li>We use it only to run Growell and check how well it works. We never sell it or use it for adverts.</li>
          <li>Some services we use store data outside Uganda. You agree to this when you sign up.</li>
          <li>You can download your data, correct it, or delete your account at any time in Settings.</li>
          <li>
            Questions or requests: <Mail />.
          </li>
        </ul>
      }
      sections={sections}
    />
  );
}
