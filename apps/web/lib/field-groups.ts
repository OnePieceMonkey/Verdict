/** Which facts the result view shows, grouped as on a German invoice, with their business terms. */
export interface FieldDef {
  readonly path: string;
  readonly label: string;
  readonly bt: string;
}

export interface FieldGroup {
  readonly title: string;
  readonly fields: readonly FieldDef[];
}

export const FIELD_GROUPS: readonly FieldGroup[] = [
  {
    title: "Invoice",
    fields: [
      { path: "number", label: "Invoice number", bt: "BT-1" },
      { path: "issueDate", label: "Issue date", bt: "BT-2" },
      { path: "dueDate", label: "Due date", bt: "BT-9" },
      { path: "buyerReference", label: "Leitweg-ID / buyer reference", bt: "BT-10" },
      { path: "orderReference", label: "Order reference", bt: "BT-13" },
      { path: "currency", label: "Currency", bt: "BT-5" },
    ],
  },
  {
    title: "Seller",
    fields: [
      { path: "seller.name", label: "Name", bt: "BT-27" },
      { path: "seller.vatId", label: "VAT ID", bt: "BT-31" },
      { path: "seller.taxNumber", label: "Tax number", bt: "BT-32" },
      { path: "seller.legalRegistrationId", label: "Register entry", bt: "BT-30" },
      { path: "seller.address.line1", label: "Street", bt: "BT-35" },
      { path: "seller.address.postcode", label: "Postcode", bt: "BT-38" },
      { path: "seller.address.city", label: "City", bt: "BT-37" },
      { path: "seller.address.countryCode", label: "Country", bt: "BT-40" },
      { path: "seller.electronicAddress.value", label: "Electronic address", bt: "BT-34" },
      { path: "seller.contact.name", label: "Contact", bt: "BT-41" },
      { path: "seller.contact.phone", label: "Phone", bt: "BT-42" },
      { path: "seller.contact.email", label: "E-mail", bt: "BT-43" },
    ],
  },
  {
    title: "Buyer",
    fields: [
      { path: "buyer.name", label: "Name", bt: "BT-44" },
      { path: "buyer.address.line1", label: "Street", bt: "BT-50" },
      { path: "buyer.address.postcode", label: "Postcode", bt: "BT-53" },
      { path: "buyer.address.city", label: "City", bt: "BT-52" },
      { path: "buyer.address.countryCode", label: "Country", bt: "BT-55" },
      { path: "buyer.electronicAddress.value", label: "Electronic address", bt: "BT-49" },
    ],
  },
  {
    title: "Payment",
    fields: [
      { path: "payment.iban", label: "IBAN", bt: "BT-84" },
      { path: "payment.accountName", label: "Account holder", bt: "BT-85" },
      { path: "paymentTerms", label: "Payment terms", bt: "BT-20" },
    ],
  },
];

/** Read a dotted path from the (possibly partial) model. */
export function valueAt(model: unknown, path: string): string | undefined {
  let node: unknown = model;
  for (const k of path.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[k];
  }
  return typeof node === "string" && node !== "" ? node : undefined;
}

/** Human labels for model paths the user may be asked about. */
export function labelFor(path: string): { label: string; bt: string } {
  for (const g of FIELD_GROUPS) {
    const f = g.fields.find((x) => x.path === path);
    if (f) return { label: `${g.title}: ${f.label}`, bt: f.bt };
  }
  return { label: path, bt: "" };
}
