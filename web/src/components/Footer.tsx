import { Link } from "react-router-dom";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer>
      <div className="container">
        <div className="footer-grid">
          <div>
            <Logo />
            <p className="footer-brand-desc">
              WhatsApp CRM for teams that sell through conversations. Your number, your data, your customers.
            </p>
            <p className="footer-brand-desc">
              <a href="mailto:hello@dorwayai.com">hello@dorwayai.com</a><br />
              <a href="tel:+91830702643">+91 830702643</a><br />
              Narela, Delhi 110040
            </p>
            <div className="footer-socials">
              <a href="#" aria-label="LinkedIn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                  <rect x="2" y="9" width="4" height="12" />
                  <circle cx="4" cy="4" r="2" />
                </svg>
              </a>
              <a href="#" aria-label="Twitter">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />
                </svg>
              </a>
              <a href="#" aria-label="Instagram">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
            </div>
          </div>

          <div className="footer-col">
            <h4>Product</h4>
            <ul>
              <li><Link to="/#features">Features</Link></li>
              <li><Link to="/pricing">Pricing</Link></li>
              <li><Link to="/#">Integrations</Link></li>
              <li><Link to="/#">Changelog</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Resources</h4>
            <ul>
              <li><Link to="/#">Help centre</Link></li>
              <li><Link to="/#">Setting up WhatsApp</Link></li>
              <li><Link to="/#">Message templates</Link></li>
              <li><Link to="/contact">Contact support</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Company</h4>
            <ul>
              <li><Link to="/#">About</Link></li>
              <li><Link to="/#">Careers</Link></li>
              <li><Link to="/legal/privacy">Privacy policy</Link></li>
              <li><Link to="/legal/terms">Terms of service</Link></li>
              <li><Link to="/legal/refund">Refund policy</Link></li>
            </ul>
          </div>
        </div>

        <div className="legal-bar">
          <span>© 2026 Dorway. All rights reserved.</span>
          <em>Not affiliated with or endorsed by Meta Platforms, Inc. WhatsApp is a trademark of Meta Platforms, Inc.</em>
        </div>
      </div>
    </footer>
  );
}
