// Browser-safe: no Node imports, so the web client can import it via "@verdict/core/rule-fields".

/**
 * Validator rules whose violation means a fact is simply not on the document, mapped to the
 * model field the user can supply. Used to turn an unresolved rejection into a precise question.
 */
export const RULE_FIELDS: Readonly<Record<string, string>> = {
  "BR-DE-1": "payment.iban",
  "BR-DE-15": "buyerReference",
  "BR-DE-3": "seller.address.city",
  "BR-DE-4": "seller.address.postcode",
  "BR-DE-6": "seller.contact.phone",
  "BR-DE-7": "seller.contact.email",
  "BR-DE-8": "buyer.address.city",
  "BR-DE-9": "buyer.address.postcode",
  "BR-62": "seller.electronicAddress.value",
  "BR-63": "buyer.electronicAddress.value",
  "BR-CO-26": "seller.vatId",
  "BR-S-02": "seller.vatId",
};
