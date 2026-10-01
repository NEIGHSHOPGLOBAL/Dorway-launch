export const ADMIN_HOST = "admin.dorwayai.com";

export function isAdminHost(): boolean {
  return window.location.hostname === ADMIN_HOST;
}

export function isMarketingHost(): boolean {
  const host = window.location.hostname;
  return host === "dorwayai.com" || host === "www.dorwayai.com";
}

export function adminHomePath(): string {
  return isAdminHost() ? "/" : "/admin";
}

export function adminLoginPath(): string {
  return isAdminHost() ? "/login" : "/admin/login";
}

/** Prefixes an absolute admin-app path with "/admin" when not on the admin subdomain. */
export function adminHref(path: string): string {
  return isAdminHost() ? path : `/admin${path}`;
}
