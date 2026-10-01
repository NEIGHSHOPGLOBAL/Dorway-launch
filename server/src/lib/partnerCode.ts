import { db } from "./db.js";

// partners.md §6: five words, lowercase, hyphen-joined, no repeated word.
// Short list for now — expand to 1,000+ unambiguous words before launch so
// the collision rate stays low at scale (see README TODO).
const WORDS = [
  "amber", "anchor", "aspen", "basil", "birch", "bloom", "brook", "cedar", "chai", "cider",
  "clove", "coral", "cove", "crest", "dawn", "delta", "dune", "ember", "fern", "field",
  "flint", "frost", "glade", "grove", "harbor", "hazel", "honey", "indigo", "ivory", "jade",
  "juniper", "kite", "lagoon", "lark", "lemon", "lotus", "maple", "marble", "meadow", "mint",
  "monsoon", "moss", "nectar", "noon", "north", "oak", "olive", "opal", "orbit", "orchid",
  "palm", "pebble", "pepper", "pine", "plum", "quartz", "rain", "reed", "ridge", "river",
  "rose", "saffron", "sage", "shore", "sierra", "slate", "solar", "spark", "spruce", "stone",
  "summit", "tamarind", "teal", "thyme", "tide", "tulip", "valley", "velvet", "willow", "wind", "zest",
];

function randomCode(): string {
  const picked: string[] = [];
  while (picked.length < 5) {
    const w = WORDS[Math.floor(Math.random() * WORDS.length)];
    if (!picked.includes(w)) picked.push(w);
  }
  return picked.join("-");
}

/** Lowercase, trim, collapse separators to '-' — so pasted/typed variants still match. */
export function normalizeCode(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s._]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function generateUniquePartnerCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    const existing = await db.partner.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique partner code");
}
