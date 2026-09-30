export function TermsPage() {
  return (
    <section>
      <div className="container legal-page">
        <h1>Terms of Service</h1>
        <p><strong>Draft — replace with counsel-reviewed terms before accepting real payment.</strong></p>
        <p>Effective date: to be set at launch.</p>

        <h2>1. What Dorway is</h2>
        <p>
          Dorway is a WhatsApp CRM: a shared inbox, lead pipeline, and automation layer built on top of your own
          WhatsApp Business Account. This site sells early-bird prepaid access ahead of the product's public launch.
        </p>

        <h2>2. Early-bird pricing</h2>
        <p>
          The early-bird rate is locked for the full prepaid term you purchase, and renews at the same rate for as
          long as your subscription stays active without a break.
        </p>

        <h2>3. Billing and access</h2>
        <p>
          Access begins on the product's actual launch date, not your payment date. If launch is delayed, your
          term moves with it — you never lose paid days to a slipped date.
        </p>

        <h2>4. Meta / WhatsApp charges</h2>
        <p>
          WhatsApp conversation charges are billed by Meta directly to the payment method you attach to your own
          WhatsApp Business Account. Dorway does not mark these up or collect them on Meta's behalf.
        </p>

        <h2>5. Cancellation</h2>
        <p>See our <a href="/legal/refund" style={{ color: "var(--green)" }}>refund policy</a> for cancellation terms.</p>

        <h2>Not affiliated with Meta</h2>
        <p>Dorway is not affiliated with or endorsed by Meta Platforms, Inc. WhatsApp is a trademark of Meta Platforms, Inc.</p>
      </div>
    </section>
  );
}

export function PrivacyPage() {
  return (
    <section>
      <div className="container legal-page">
        <h1>Privacy Policy</h1>
        <p><strong>Draft — replace with counsel-reviewed policy before accepting real payment.</strong></p>

        <h2>What we collect</h2>
        <ul>
          <li>Account details: email, phone, business name, city, GSTIN (optional)</li>
          <li>Order and payment records, processed via Cashfree — we never see or store your card details</li>
          <li>Basic usage analytics on this marketing site</li>
        </ul>

        <h2>How we use it</h2>
        <p>To create your account, process payment, issue receipts, and email you about your order and launch status.</p>

        <h2>Data isolation</h2>
        <p>Every business's data is isolated at the database level. Your leads and conversations are visible only to users you invite once the CRM is live.</p>

        <h2>Retention</h2>
        <p>Account and order records are retained for as long as your subscription is active, plus applicable tax record-keeping requirements.</p>
      </div>
    </section>
  );
}

export function RefundPage() {
  return (
    <section>
      <div className="container legal-page">
        <h1>Refund &amp; Cancellation Policy</h1>
        <p><strong>Draft — replace with counsel-reviewed policy before accepting real payment.</strong></p>

        <h2>The promise</h2>
        <p>
          Full refund, no questions asked, any time before launch and up to 7 days after launch. Request it by
          emailing support with your order ID.
        </p>

        <h2>How refunds are processed</h2>
        <p>Refunds are issued to the original payment method via Cashfree, typically within 5–7 business days of approval.</p>

        <h2>After the refund window</h2>
        <p>Once the 7-day post-launch window closes, subscriptions can be cancelled for the following term but the current prepaid term is non-refundable.</p>
      </div>
    </section>
  );
}
