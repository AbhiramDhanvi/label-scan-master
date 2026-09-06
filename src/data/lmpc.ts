// Reference data from the Metrograph reference sheet: Legal Metrology
// (Packaged Commodities) Rules, 2011 rule codes, limits and real products.
// Verify against the current Gazette notification before enforcement use.

export type Verdict = "PASS" | "FAIL" | "REVIEW";

export type Declaration = {
  code: string;
  declaration: string;
  requirement: string;
};

export const declarations: Declaration[] = [
  { code: "LMPC-R6-MFR", declaration: "Manufacturer / packer / importer name and address", requirement: "Full name and complete address must be printed" },
  { code: "LMPC-R6-QTY", declaration: "Net quantity", requirement: "Standard unit (g / kg / ml / L or count); numeral and unit together" },
  { code: "LMPC-R6-MRP", declaration: "Maximum retail price", requirement: "Must state \"inclusive of all taxes\"; single price only" },
  { code: "LMPC-R6-DATE", declaration: "Month and year of manufacture / packing / import", requirement: "MM/YYYY format minimum" },
  { code: "LMPC-R6-CARE", declaration: "Consumer care detail", requirement: "Name, address, phone or email of consumer care" },
  { code: "LMPC-R6-COO", declaration: "Country of origin (imported goods only)", requirement: "Mandatory for imported pre-packaged commodities" },
  { code: "LMPC-R6-GEN", declaration: "Common or generic name", requirement: "Generic name of the commodity" },
];

export type FontBand = {
  code: string;
  band: string;
  minHeightMm: number;
  maxQuantity: number; // in g or ml, Infinity for the top band
};

export const fontBands: FontBand[] = [
  { code: "LMPC-R7-FONT-A", band: "Up to 200 g or 200 ml", minHeightMm: 1, maxQuantity: 200 },
  { code: "LMPC-R7-FONT-B", band: "Above 200 up to 500 g or ml", minHeightMm: 2, maxQuantity: 500 },
  { code: "LMPC-R7-FONT-C", band: "Above 500 g or ml up to 1 kg or L", minHeightMm: 4, maxQuantity: 1000 },
  { code: "LMPC-R7-FONT-D", band: "Above 1 kg or 1 L", minHeightMm: 6, maxQuantity: Infinity },
];

export const bandForQuantity = (grammesOrMl: number): FontBand =>
  fontBands.find((band) => grammesOrMl <= band.maxQuantity) ?? fontBands[fontBands.length - 1]!;

export const amendments = [
  { code: "LMPC-R6-COO", amendment: "E-commerce country-of-origin filter for imports", effective: "01 Jul 2027", citation: "Second Amendment Rules, 2026, G.S.R. 312(E), Rule 6(10A)" },
  { code: "LMPC-R4-BONDED", amendment: "AEO-bonded warehouse declarations", effective: "01 Jun 2026", citation: "Third Amendment Rules, 2026, G.S.R. 418(E), Rule 4" },
  { code: "LMPC-R6-QTY", amendment: "Net quantity clarification", effective: "2023", citation: "Amendment Rules, 2023" },
];

export const penalties = [
  { provision: "Director liability (Section 34)", limit: "Personal liability for one nominated director per company" },
  { provision: "First offence, compounding fine", limit: "₹25,000" },
  { provision: "Repeated offence, compounding fine", limit: "Up to ₹1,00,000" },
  { provision: "Maximum permissible error (MPE)", limit: "Statutory tolerance band; varies by commodity and package size" },
  { provision: "Reference card used for calibration", limit: "ID card, fixed width 85.6 mm (ISO/IEC 7810 ID-1)" },
];

export type Product = {
  code: string;
  product: string;
  category: string;
  mrp: number;
  netQuantity: string;
  quantityBase: number; // g or ml
  verdict: Verdict;
  note: string;
  flagged: string[]; // rule codes
  inspections: { date: string; verdict: Verdict; officer: string }[];
};

export const products: Product[] = [
  {
    code: "LMPC-P-1001",
    product: "Sunrise Refined Sunflower Oil",
    category: "Edible Oil",
    mrp: 189,
    netQuantity: "1000 ml",
    quantityBase: 1000,
    verdict: "REVIEW",
    note: "Country of origin not captured in the scanned frame.",
    flagged: ["LMPC-R6-COO"],
    inspections: [
      { date: "2026-08-21", verdict: "REVIEW", officer: "A. Rao" },
      { date: "2026-05-14", verdict: "PASS", officer: "A. Rao" },
    ],
  },
  {
    code: "LMPC-P-1002",
    product: "Farmfresh Basmati Rice",
    category: "Staples",
    mrp: 780,
    netQuantity: "5 kg",
    quantityBase: 5000,
    verdict: "FAIL",
    note: "Manufacturer name and address missing from the principal display panel.",
    flagged: ["LMPC-R6-MFR"],
    inspections: [
      { date: "2026-08-19", verdict: "FAIL", officer: "S. Menon" },
      { date: "2026-04-02", verdict: "FAIL", officer: "S. Menon" },
    ],
  },
  {
    code: "LMPC-P-1003",
    product: "Clarion Handwash",
    category: "Personal Care",
    mrp: 95,
    netQuantity: "200 ml",
    quantityBase: 200,
    verdict: "PASS",
    note: "All Rule 6 declarations present and legible.",
    flagged: [],
    inspections: [{ date: "2026-08-11", verdict: "PASS", officer: "A. Rao" }],
  },
  {
    code: "LMPC-P-1004",
    product: "Kavya Turmeric Powder",
    category: "Food",
    mrp: 54,
    netQuantity: "100 g",
    quantityBase: 100,
    verdict: "PASS",
    note: "All Rule 6 declarations present and legible.",
    flagged: [],
    inspections: [{ date: "2026-07-30", verdict: "PASS", officer: "K. Iyer" }],
  },
  {
    code: "LMPC-P-1005",
    product: "Nova Detergent Bar",
    category: "Household",
    mrp: 42,
    netQuantity: "250 g",
    quantityBase: 250,
    verdict: "FAIL",
    note: "MRP printed without the \"inclusive of all taxes\" clause.",
    flagged: ["LMPC-R6-MRP"],
    inspections: [
      { date: "2026-08-05", verdict: "FAIL", officer: "K. Iyer" },
      { date: "2026-06-18", verdict: "REVIEW", officer: "K. Iyer" },
    ],
  },
  {
    code: "LMPC-P-1006",
    product: "Belgian Cocoa Powder (Imported)",
    category: "Imported / Food",
    mrp: 390,
    netQuantity: "250 g",
    quantityBase: 250,
    verdict: "REVIEW",
    note: "Country of origin read at low confidence; manual verification required.",
    flagged: ["LMPC-R6-COO"],
    inspections: [{ date: "2026-08-24", verdict: "REVIEW", officer: "S. Menon" }],
  },
];

export const verdictClass = (verdict: Verdict) =>
  verdict === "PASS" ? "text-pass" : verdict === "FAIL" ? "text-destructive" : "text-warning";
