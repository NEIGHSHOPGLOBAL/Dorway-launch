// partners.md §8: the server must send already-masked values — partners
// must never see a referred customer's full name, phone, account number or PAN.

export function maskPhoneE164(digits: string): string {
  const local = digits.replace(/^91/, "");
  return `+91 ${local.slice(0, 2)}XXX XX${local.slice(-3)}`;
}

export function maskBusinessName(name: string | null | undefined): string {
  if (!name || !name.trim()) return "Customer";
  const [first, ...rest] = name.trim().split(/\s+/);
  if (rest.length === 0) return first;
  return `${first} ${rest.map((w) => `${w[0]?.toUpperCase() ?? ""}.`).join(" ")}`;
}

export function maskUpi(upiId: string): string {
  const [local, domain] = upiId.split("@");
  if (!domain) return upiId;
  return `${local.slice(0, 3)}***@${domain}`;
}

export function maskAccountNumber(accountNumber: string): string {
  return `XXXX${accountNumber.slice(-4)}`;
}

export function maskPan(pan: string): string {
  return `${pan.slice(0, 2)}XXXXX${pan.slice(-3)}`;
}
