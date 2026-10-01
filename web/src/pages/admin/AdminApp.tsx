import { Route, Routes } from "react-router-dom";
import { AdminShell } from "./AdminShell";
import { Home } from "./sections/Home";
import { Funnel } from "./sections/onboarding/Funnel";
import { Approvals } from "./sections/onboarding/Approvals";
import { Users } from "./sections/onboarding/Users";
import { UserDetail } from "./sections/onboarding/UserDetail";
import { PurchasesOverview } from "./sections/purchases/Overview";
import { Checkouts } from "./sections/purchases/Checkouts";
import { Payments } from "./sections/purchases/Payments";
import { Reconciliation } from "./sections/purchases/Reconciliation";
import { AffiliatesOverview } from "./sections/affiliates/Overview";
import { Partners } from "./sections/affiliates/Partners";
import { PartnerDetail } from "./sections/affiliates/PartnerDetail";
import { Referrals } from "./sections/affiliates/Referrals";
import { Commissions } from "./sections/affiliates/Commissions";
import { Payouts } from "./sections/affiliates/Payouts";
import { Flags } from "./sections/affiliates/Flags";
import { AuditLog } from "./sections/AuditLog";
import { Settings } from "./sections/Settings";

// superadmin.md §3 nav tree, nested under AdminShell's sidebar/topbar.
export function AdminApp() {
  return (
    <Routes>
      <Route element={<AdminShell />}>
        <Route index element={<Home />} />
        <Route path="onboarding/funnel" element={<Funnel />} />
        <Route path="onboarding/approvals" element={<Approvals />} />
        <Route path="onboarding/users" element={<Users />} />
        <Route path="onboarding/users/:id" element={<UserDetail />} />
        <Route path="purchases" element={<PurchasesOverview />} />
        <Route path="purchases/checkouts" element={<Checkouts />} />
        <Route path="purchases/payments" element={<Payments />} />
        <Route path="purchases/reconciliation" element={<Reconciliation />} />
        <Route path="affiliates" element={<AffiliatesOverview />} />
        <Route path="affiliates/partners" element={<Partners />} />
        <Route path="affiliates/partners/:id" element={<PartnerDetail />} />
        <Route path="affiliates/referrals" element={<Referrals />} />
        <Route path="affiliates/commissions" element={<Commissions />} />
        <Route path="affiliates/payouts" element={<Payouts />} />
        <Route path="affiliates/flags" element={<Flags />} />
        <Route path="audit-log" element={<AuditLog />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  );
}
