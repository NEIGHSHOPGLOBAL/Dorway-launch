import { useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { trackPageView } from "./lib/pixel";
import { captureReferralFromUrl } from "./lib/referral";
import { AuthProvider } from "./lib/auth";
import { ADMIN_HOST, isAdminHost, isMarketingHost } from "./lib/adminHost";
import { Layout } from "./components/Layout";
import DorwayLanding from "./pages/DorwayLanding.jsx";
import DorwayPartners from "./pages/partners/DorwayPartners.jsx";
import { Login } from "./pages/Login";
import { Welcome } from "./pages/Welcome";
import { Pricing } from "./pages/Pricing";
import { Checkout } from "./pages/Checkout";
import { CheckoutReturn } from "./pages/CheckoutReturn";
import { Dashboard } from "./pages/Dashboard";
import { Billing } from "./pages/Billing";
import { OnboardingSetup } from "./pages/onboarding/Setup";
import { TermsPage, PrivacyPage, RefundPage } from "./pages/Legal";
import { Contact } from "./pages/Contact";
import { AdminLogin } from "./pages/admin/AdminLogin";
import { AdminApp } from "./pages/admin/AdminApp";

function PixelPageView() {
  const location = useLocation();
  const firstLoad = useRef(true);
  useEffect(() => {
    // First paint: wait so Meta Event Setup Tool can attach before PageView.
    // Later SPA navigations fire immediately.
    const delay = firstLoad.current ? 1500 : 0;
    firstLoad.current = false;
    const timer = window.setTimeout(() => trackPageView(), delay);
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.search]);
  return null;
}

function RedirectToAdminHost({ path }: { path: string }) {
  useEffect(() => {
    window.location.replace(`https://${ADMIN_HOST}${path}`);
  }, [path]);
  return null;
}

export function App() {
  useEffect(() => {
    captureReferralFromUrl();
  }, []);

  if (isAdminHost()) {
    return (
      <BrowserRouter>
        <PixelPageView />
        <Routes>
          <Route path="/login" element={<AdminLogin />} />
          <Route path="/*" element={<AdminApp />} />
        </Routes>
      </BrowserRouter>
    );
  }

  const sendAdminToSubdomain = isMarketingHost();

  return (
    <BrowserRouter>
      <PixelPageView />
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route
            path="/admin/login"
            element={sendAdminToSubdomain ? <RedirectToAdminHost path="/login" /> : <AdminLogin />}
          />
          <Route
            path="/admin/*"
            element={sendAdminToSubdomain ? <RedirectToAdminHost path="/" /> : <AdminApp />}
          />
          <Route path="/" element={<DorwayLanding />} />
          <Route path="/partners/*" element={<DorwayPartners />} />
          <Route element={<Layout />}>
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/checkout/:planCode" element={<Checkout />} />
            <Route path="/checkout/return" element={<CheckoutReturn />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/account" element={<Navigate to="/dashboard" replace />} />
            <Route path="/onboarding/profile" element={<Navigate to="/welcome" replace />} />
            <Route path="/onboarding/setup" element={<OnboardingSetup />} />
            <Route path="/legal/terms" element={<TermsPage />} />
            <Route path="/legal/privacy" element={<PrivacyPage />} />
            <Route path="/legal/refund" element={<RefundPage />} />
            <Route path="/contact" element={<Contact />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
