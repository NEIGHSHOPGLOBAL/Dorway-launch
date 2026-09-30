import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { INDIAN_STATES } from "../../lib/gstStates";

const CHEV = (
  <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

interface ProfileData {
  waNumber: string | null;
  waOnConsumerApp: boolean | null;
  waCurrentPlatform: string | null;
  waOtpReachable: string | null;
  legalName: string | null;
  registeredAddress: string | null;
  billingStateCode: string | null;
  website: string | null;
  businessEmail: string | null;
  metaBusinessId: string | null;
  facebookPage: string | null;
  waDisplayName: string | null;
  hasExistingWaba: boolean | null;
  existingWabaId: string | null;
  existingPhoneId: string | null;
  existingPlatform: string | null;
  sectionADone: boolean;
  sectionBDone: boolean;
  sectionCDone: boolean;
  submittedAt: string | null;
}
interface DocRow {
  id: string;
  kind: string;
  filename: string;
  sizeBytes: number;
  uploadedAt: string;
}

function useSaveFlash() {
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function flash() {
    setSaved(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaved(false), 2000);
  }
  return { saved, flash };
}

function SectionA({ profile, onSaved }: { profile: ProfileData | null; onSaved: () => void }) {
  const [waNumber, setWaNumber] = useState(profile?.waNumber ?? "");
  const [onConsumerApp, setOnConsumerApp] = useState<boolean | null>(profile?.waOnConsumerApp ?? null);
  const [currentPlatform, setCurrentPlatform] = useState(profile?.waCurrentPlatform ?? "");
  const [otpReachable, setOtpReachable] = useState(profile?.waOtpReachable ?? "");
  const [busy, setBusy] = useState(false);
  const { saved, flash } = useSaveFlash();

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/onboarding/setup/section-a", {
        waNumber,
        waOnConsumerApp: onConsumerApp ?? false,
        waCurrentPlatform: currentPlatform || undefined,
        waOtpReachable: otpReachable,
      });
      flash();
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save}>
      <div className="field">
        <label>Number to use for Dorway</label>
        <input type="tel" required value={waNumber} onChange={(e) => setWaNumber(e.target.value)} placeholder="98765 43210" />
        <div className="field-hint">This becomes your WhatsApp Business Account.</div>
      </div>
      <div className="field">
        <label>Is it currently on the WhatsApp app?</label>
        <div className="term-pill-row">
          <button type="button" className={`term-pill${onConsumerApp === true ? " active" : ""}`} onClick={() => setOnConsumerApp(true)}>Yes</button>
          <button type="button" className={`term-pill${onConsumerApp === false ? " active" : ""}`} onClick={() => setOnConsumerApp(false)}>No</button>
        </div>
        {onConsumerApp === true && (
          <div className="setup-warning">
            This number is on the WhatsApp app right now. Before it can be used with Dorway, you'll need to delete
            that account — chats and history on it will be gone. Many businesses use a fresh number instead. We'll
            walk you through either.
          </div>
        )}
      </div>
      <div className="field">
        <label>Is it on another platform today? (optional)</label>
        <input type="text" value={currentPlatform} onChange={(e) => setCurrentPlatform(e.target.value)} placeholder="Wati, Interakt, AiSensy…" />
        <div className="field-hint">If yes, it's already a WABA and needs release from the current provider.</div>
      </div>
      <div className="field">
        <label>A number that can receive an OTP</label>
        <input type="tel" required value={otpReachable} onChange={(e) => setOtpReachable(e.target.value)} placeholder="98765 43210" />
        <div className="field-hint">Meta verifies your number by call or SMS.</div>
      </div>
      <button className="btn btn-primary" type="submit" disabled={busy || !waNumber || !otpReachable}>
        {busy ? <span className="spinner" /> : "Save section"}
      </button>
      <div className="setup-save-note">{saved ? "Saved" : ""}</div>
    </form>
  );
}

function SectionB({ profile, onSaved }: { profile: ProfileData | null; onSaved: () => void }) {
  const [legalName, setLegalName] = useState(profile?.legalName ?? "");
  const [address, setAddress] = useState(profile?.registeredAddress ?? "");
  const [stateCode, setStateCode] = useState(profile?.billingStateCode ?? "");
  const [website, setWebsite] = useState(profile?.website ?? "");
  const [businessEmail, setBusinessEmail] = useState(profile?.businessEmail ?? "");
  const [metaBusinessId, setMetaBusinessId] = useState(profile?.metaBusinessId ?? "");
  const [facebookPage, setFacebookPage] = useState(profile?.facebookPage ?? "");
  const [displayName, setDisplayName] = useState(profile?.waDisplayName ?? "");
  const [busy, setBusy] = useState(false);
  const { saved, flash } = useSaveFlash();

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/onboarding/setup/section-b", {
        legalName,
        registeredAddress: address,
        billingStateCode: stateCode,
        website: website || undefined,
        businessEmail: businessEmail || undefined,
        metaBusinessId: metaBusinessId || undefined,
        facebookPage: facebookPage || undefined,
        waDisplayName: displayName,
      });
      flash();
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save}>
      <div className="field">
        <label>Legal business name</label>
        <input type="text" required value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Sunstone Interiors Pvt Ltd" />
        <div className="field-hint">Exactly as it appears on your GST certificate.</div>
      </div>
      <div className="field">
        <label>Registered address</label>
        <input type="text" required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Must match your documents" />
      </div>
      <div className="field">
        <label>Billing state</label>
        <select value={stateCode} onChange={(e) => setStateCode(e.target.value)} required
          style={{ width: "100%", height: 48, borderRadius: "var(--radius-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)", padding: "0 16px", fontSize: 16 }}>
          <option value="">Select a state</option>
          {INDIAN_STATES.map((s) => (
            <option key={s.code} value={s.code}>{s.name}</option>
          ))}
        </select>
        <div className="field-hint">Sets the GST that applies to your invoice.</div>
      </div>
      <div className="field">
        <label>Business website (optional)</label>
        <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
        <div className="field-hint">Meta checks it — a live site materially helps verification.</div>
      </div>
      <div className="field">
        <label>Business email on your domain (optional)</label>
        <input type="email" value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} placeholder="hello@yourbusiness.com" />
      </div>
      <div className="field">
        <label>Meta Business Portfolio ID (optional)</label>
        <input type="text" value={metaBusinessId} onChange={(e) => setMetaBusinessId(e.target.value)} placeholder="If you have one" />
      </div>
      <div className="field">
        <label>Facebook Page (optional)</label>
        <input type="text" value={facebookPage} onChange={(e) => setFacebookPage(e.target.value)} placeholder="Required for a WABA — leave blank if you need help creating one" />
      </div>
      <div className="field">
        <label>WhatsApp display name</label>
        <input type="text" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="What customers see" />
      </div>
      <button className="btn btn-primary" type="submit" disabled={busy || !legalName || !address || !stateCode || !displayName}>
        {busy ? <span className="spinner" /> : "Save section"}
      </button>
      <div className="setup-save-note">{saved ? "Saved" : ""}</div>
    </form>
  );
}

const DOC_KINDS: { kind: string; label: string; hint: string }[] = [
  { kind: "incorporation", label: "Incorporation / GST certificate", hint: "Or a Shop & Establishment licence" },
  { kind: "address_proof", label: "Address proof", hint: "Recent utility bill or bank statement" },
  { kind: "pan", label: "Business PAN", hint: "For Meta's business verification" },
];

function SectionC({ documents, onUploaded }: { documents: DocRow[]; onUploaded: () => void }) {
  const [uploading, setUploading] = useState<string | null>(null);

  async function upload(kind: string, file: File) {
    setUploading(kind);
    try {
      const form = new FormData();
      form.append("kind", kind);
      form.append("file", file);
      await fetch("/api/onboarding/documents", { method: "POST", credentials: "include", body: form });
      onUploaded();
    } finally {
      setUploading(null);
    }
  }

  async function remove(id: string) {
    await api.del(`/onboarding/documents/${id}`);
    onUploaded();
  }

  return (
    <div>
      {DOC_KINDS.map((d) => {
        const existing = documents.filter((doc) => doc.kind === d.kind);
        return (
          <div className="field" key={d.kind}>
            <label>{d.label}</label>
            <div className="field-hint" style={{ marginBottom: 8 }}>{d.hint}</div>
            {existing.map((doc) => (
              <div className="setup-doc-row" key={doc.id}>
                <span>{doc.filename} · {(doc.sizeBytes / 1024).toFixed(0)}KB</span>
                <button type="button" onClick={() => remove(doc.id)}>Remove</button>
              </div>
            ))}
            <label className="setup-upload-btn">
              {uploading === d.kind ? <span className="spinner" /> : "Upload file (PDF, JPG, PNG — 10MB max)"}
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload(d.kind, file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        );
      })}
    </div>
  );
}

function SectionD({ profile, onSaved }: { profile: ProfileData | null; onSaved: () => void }) {
  const [has, setHas] = useState(profile?.hasExistingWaba ?? false);
  const [wabaId, setWabaId] = useState(profile?.existingWabaId ?? "");
  const [phoneId, setPhoneId] = useState(profile?.existingPhoneId ?? "");
  const [platform, setPlatform] = useState(profile?.existingPlatform ?? "");
  const [busy, setBusy] = useState(false);
  const { saved, flash } = useSaveFlash();

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/onboarding/setup/section-d", {
        hasExistingWaba: has,
        existingWabaId: wabaId || undefined,
        existingPhoneId: phoneId || undefined,
        existingPlatform: platform || undefined,
      });
      flash();
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save}>
      <p className="field-hint" style={{ marginBottom: 16 }}>
        Most businesses skip this. Only fill it in if you already run WhatsApp Business API through another platform
        and want to bring that account across.
      </p>
      <div className="setup-toggle-row">
        <input type="checkbox" checked={has} onChange={(e) => setHas(e.target.checked)} id="has-existing" />
        <label htmlFor="has-existing" style={{ marginBottom: 0 }}>I already have a WhatsApp Business API account</label>
      </div>
      {has && (
        <>
          <div className="field">
            <label>WABA ID</label>
            <input type="text" value={wabaId} onChange={(e) => setWabaId(e.target.value)} />
          </div>
          <div className="field">
            <label>Phone Number ID</label>
            <input type="text" value={phoneId} onChange={(e) => setPhoneId(e.target.value)} />
          </div>
          <div className="field">
            <label>Current BSP / platform</label>
            <input type="text" value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="Wati, Interakt, AiSensy…" />
          </div>
          <p className="field-hint">
            We'll follow up by email for the access token — that's a secret and doesn't belong in a web form.
          </p>
        </>
      )}
      <button className="btn btn-secondary" type="submit" disabled={busy}>
        {busy ? <span className="spinner" /> : "Save section"}
      </button>
      <div className="setup-save-note">{saved ? "Saved" : ""}</div>
    </form>
  );
}

export function OnboardingSetup() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [open, setOpen] = useState<"a" | "b" | "c" | "d" | null>("a");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login?next=/onboarding/setup", { replace: true });
  }, [authLoading, user, navigate]);

  async function load() {
    const r = await api.get<{ profile: ProfileData | null; documents: DocRow[] }>("/onboarding/setup");
    setProfile(r.profile);
    setDocuments(r.documents);
  }

  useEffect(() => {
    if (user) load();
  }, [user]);

  async function submit() {
    await api.post("/onboarding/setup/submit");
    setSubmitted(true);
  }

  if (!user) return null;

  if (submitted) {
    return (
      <section className="page-hero">
        <div className="container">
          <div className="card checkout-summary" style={{ maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
            <h2 style={{ color: "var(--green-deep)" }}>Setup submitted</h2>
            <p className="lead" style={{ fontSize: 15, marginTop: 8 }}>
              We've got what we need to start. Meta reviews these on their own schedule — we'll tell you the moment
              it moves.
            </p>
            <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={() => navigate("/dashboard")}>
              Back to dashboard
            </button>
          </div>
        </div>
      </section>
    );
  }

  const sections: { key: "a" | "b" | "c" | "d"; title: string; done: boolean; body: React.ReactNode }[] = [
    { key: "a", title: "Your WhatsApp number", done: profile?.sectionADone ?? false, body: <SectionA profile={profile} onSaved={load} /> },
    { key: "b", title: "Your business details", done: profile?.sectionBDone ?? false, body: <SectionB profile={profile} onSaved={load} /> },
    { key: "c", title: "Documents", done: documents.length > 0, body: <SectionC documents={documents} onUploaded={load} /> },
    { key: "d", title: "Existing account (most people skip this)", done: profile?.hasExistingWaba ?? false, body: <SectionD profile={profile} onSaved={load} /> },
  ];

  return (
    <section style={{ paddingTop: 64, paddingBottom: 96 }}>
      <div className="container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", maxWidth: 640, margin: "0 auto 32px" }}>
          <h1 style={{ fontFamily: "Comfortaa, cursive", fontSize: 28 }}>Set up WhatsApp</h1>
          <span className="caption">Saves as you go</span>
        </div>

        <div className="setup-accordion">
          {sections.map((s) => (
            <div className={`setup-section${open === s.key ? " open" : ""}`} key={s.key}>
              <button className="setup-section-head" onClick={() => setOpen(open === s.key ? null : s.key)} type="button">
                <span className={`checklist-icon ${s.done ? "done" : "locked"}`}>
                  {s.done ? CHECK : <span className="hollow-dot" />}
                </span>
                {s.title}
                {CHEV}
              </button>
              {open === s.key && <div className="setup-section-body">{s.body}</div>}
            </div>
          ))}
        </div>

        <div style={{ maxWidth: 640, margin: "24px auto 0", textAlign: "right" }}>
          <button className="btn btn-primary" onClick={submit}>Save and continue</button>
        </div>
      </div>
    </section>
  );
}
