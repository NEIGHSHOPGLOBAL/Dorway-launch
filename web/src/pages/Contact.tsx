import { trackContact } from "../lib/pixel";

export function Contact() {
  return (
    <section>
      <div className="container legal-page">
        <h1>Contact us</h1>
        <div className="alert info">
          Placeholder — Cashfree's activation review requires a real registered business address and phone number
          here. Replace before going live (architecture.md §9.1, §L8).
        </div>
        <p>Email: <a href="mailto:hello@dorway.app" style={{ color: "var(--green)" }} onClick={trackContact}>hello@dorway.app</a></p>
        <p>Phone: [add registered business phone]</p>
        <p>Address: [add registered business address]</p>
      </div>
    </section>
  );
}
