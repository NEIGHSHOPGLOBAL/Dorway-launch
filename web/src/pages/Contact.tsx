import { trackContact } from "../lib/pixel";

const EMAIL = "hello@dorwayai.com";
const PHONE_DISPLAY = "+91 830702643";
const PHONE_TEL = "+91830702643";
const ADDRESS = "Narela, Delhi 110040";

export function Contact() {
  return (
    <section>
      <div className="container legal-page">
        <h1>Contact us</h1>
        <p>Questions about Dorway, setup, or a payment? Reach us on any of these.</p>
        <p>
          Email:{" "}
          <a href={`mailto:${EMAIL}`} style={{ color: "var(--green)" }} onClick={trackContact}>
            {EMAIL}
          </a>
        </p>
        <p>
          Phone:{" "}
          <a href={`tel:${PHONE_TEL}`} style={{ color: "var(--green)" }} onClick={trackContact}>
            {PHONE_DISPLAY}
          </a>
        </p>
        <p>Address: {ADDRESS}</p>
      </div>
    </section>
  );
}
