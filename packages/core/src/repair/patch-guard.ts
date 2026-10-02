import { checkEvidence } from "../evidence/evidence-check.ts";
import {
  normalizeCountry,
  normalizeCurrency,
  normalizeDate,
  normalizeDecimal,
  normalizeUnit,
  normalizeVatCategory,
  type Normalized,
} from "../normalize/normalize.ts";
import { PATH_BT, type Provenance } from "../extract/assemble.ts";
import { cityFollowsPostcode, EvidenceRoles, shapeProblem } from "../plausibility/shape.ts";

/** One proposed change from the repair model (RFC 6902 subset: add / replace). */
export interface ProposedPatch {
  readonly op: "add" | "replace";
  /** JSON pointer into the semantic model, e.g. "/seller/contact/phone" or "/lines/0/unitCode". */
  readonly path: string;
  readonly value: string;
  readonly quote: string;
  readonly page: number;
}

export interface AcceptedPatch extends ProposedPatch {
  /** Normalized value that is written into the model. */
  readonly normalized: string;
}

export interface RejectedPatch {
  readonly patch: ProposedPatch;
  readonly reason: string;
}

/** Fields the model may never set: computed, fixed or scheme fields. */
const FORBIDDEN = [
  /^\/typeCode$/,
  /^\/payment\/meansCode$/,
  /electronicAddress\/scheme$/,
  /\/(netAmount|taxAmount|taxableAmount|lineTotal|grandTotal|taxTotal|duePayable)$/,
];

const LINE_FIELD = /^\/lines\/(\d+)\/(id|name|quantity|unitCode|netPrice|priceBaseQuantity|vatCategory|vatRate)$/;

function normalizerFor(path: string, numberFormat: "de" | "plain"): (v: string) => Normalized {
  const dec = (v: string) => normalizeDecimal(v.replace(/%/g, ""), numberFormat);
  const line = LINE_FIELD.exec(path);
  if (line) {
    switch (line[2]) {
      case "quantity":
      case "netPrice":
      case "priceBaseQuantity":
      case "vatRate":
        return dec;
      case "unitCode":
        return normalizeUnit;
      case "vatCategory":
        return (v) => normalizeVatCategory(v);
    }
  }
  if (/^\/(issueDate|dueDate)$/.test(path)) return normalizeDate;
  if (path === "/currency") return normalizeCurrency;
  if (/\/address\/countryCode$/.test(path)) return normalizeCountry;
  if (path === "/payment/iban") {
    return (v) => {
      const t = v.replace(/\s/g, "").toUpperCase();
      return /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(t) ? { ok: true, value: t } : { ok: false, reason: "not an IBAN" };
    };
  }
  return (v) => (v.trim() ? { ok: true, value: v.trim() } : { ok: false, reason: "empty value" });
}

const pointerToPath = (pointer: string) => pointer.replace(/^\//, "").replaceAll("/", ".");

/**
 * Patch guard (REP-02): rejects patches on derived or fixed fields, unknown paths, patches
 * without a quote that is really on the page, and values that do not normalize.
 */
export function guardPatches(
  patches: readonly ProposedPatch[],
  pages: readonly string[],
  numberFormat: "de" | "plain",
  /** Evidence already backing model fields: path -> provenance, plus the current values. */
  existing?: { readonly provenance: ReadonlyMap<string, Provenance>; readonly valueOf: (path: string) => string | undefined },
): { accepted: AcceptedPatch[]; rejected: RejectedPatch[] } {
  const accepted: AcceptedPatch[] = [];
  const rejected: RejectedPatch[] = [];
  const roles = new EvidenceRoles();
  for (const [path, prov] of existing?.provenance ?? []) {
    const value = existing?.valueOf(path);
    if (prov.kind === "evidence" && value !== undefined && !path.startsWith("lines.")) roles.claim(path, value, prov.quote);
  }
  for (const patch of patches) {
    const reject = (reason: string) => rejected.push({ patch, reason });
    if (patch.op !== "add" && patch.op !== "replace") {
      reject(`operation ${String(patch.op)} not allowed`);
      continue;
    }
    if (FORBIDDEN.some((re) => re.test(patch.path))) {
      reject("derived or fixed field");
      continue;
    }
    const known = PATH_BT[pointerToPath(patch.path)] !== undefined || LINE_FIELD.test(patch.path);
    if (!known) {
      reject("unknown field");
      continue;
    }
    if (!patch.quote?.trim()) {
      reject("no provenance (missing quote)");
      continue;
    }
    const evidence = checkEvidence(pages, { page: patch.page, quote: patch.quote }, patch.value);
    if (!evidence.ok) {
      reject(`evidence: ${evidence.reason}`);
      continue;
    }
    const n = normalizerFor(patch.path, numberFormat)(patch.value);
    if (!n.ok) {
      reject(`normalization: ${n.reason}`);
      continue;
    }
    const modelPath = pointerToPath(patch.path);
    const shape = shapeProblem(modelPath, n.value);
    if (shape) {
      reject(`shape: ${shape}`);
      continue;
    }
    const cityOf = /^(seller|buyer)\.address\.city$/.exec(modelPath);
    const postcode = cityOf ? existing?.valueOf(`${cityOf[1]}.address.postcode`) : undefined;
    if (cityOf && postcode && !cityFollowsPostcode(pages, postcode, n.value)) {
      reject("city is not printed next to the postcode");
      continue;
    }
    if (!modelPath.startsWith("lines.")) {
      const owner = roles.claim(modelPath, patch.value, patch.quote);
      if (owner) {
        reject(`same evidence already used for ${owner}`);
        continue;
      }
    }
    accepted.push({ ...patch, normalized: n.value });
  }
  return { accepted, rejected };
}

/** Applies accepted patches to a plain JSON model (creating intermediate objects). */
export function applyPatches<T>(model: T, patches: readonly AcceptedPatch[]): T {
  const out = structuredClone(model) as Record<string, unknown>;
  for (const p of patches) {
    const keys = p.path.replace(/^\//, "").split("/");
    let node: Record<string, unknown> = out;
    for (const k of keys.slice(0, -1)) {
      if (node[k] === undefined || node[k] === null) node[k] = {};
      node = node[k] as Record<string, unknown>;
    }
    const leaf = keys.at(-1);
    if (leaf !== undefined) node[leaf] = p.normalized;
  }
  return out as T;
}
