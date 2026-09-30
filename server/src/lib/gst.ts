// onboarding.md §7.1 — CGST+SGST for intra-state, IGST for inter-state.
// Everything in paise as integers; each component rounded independently, half-up.

export interface GstBreakdown {
  netPaise: bigint;
  cgstPaise: bigint;
  sgstPaise: bigint;
  igstPaise: bigint;
  totalPaise: bigint;
  placeOfSupply: string;
}

function roundHalfUp(paise: bigint, percent: number): bigint {
  // percent is a whole number (9 or 18); do the rounding in plain numbers
  // since these amounts are well under Number.MAX_SAFE_INTEGER for a SaaS invoice.
  return BigInt(Math.round((Number(paise) * percent) / 100));
}

export function computeGst(netPaise: bigint, customerStateCode: string, supplierStateCode: string): GstBreakdown {
  const intraState = customerStateCode === supplierStateCode;

  const half = roundHalfUp(netPaise, 9);
  const full = roundHalfUp(netPaise, 18);

  const cgst = intraState ? half : 0n;
  const sgst = intraState ? half : 0n;
  const igst = intraState ? 0n : full;

  return {
    netPaise,
    cgstPaise: cgst,
    sgstPaise: sgst,
    igstPaise: igst,
    totalPaise: netPaise + cgst + sgst + igst,
    placeOfSupply: customerStateCode,
  };
}

export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function stateFromGstin(gstin: string): string {
  return gstin.slice(0, 2);
}

// GST state codes (India), used for the billing-state selector.
export const INDIAN_STATES: { code: string; name: string }[] = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "28", name: "Andhra Pradesh (Old)" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman and Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
];
