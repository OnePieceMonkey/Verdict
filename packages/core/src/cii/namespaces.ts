export const CII_NS = {
  rsm: "urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100",
  ram: "urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100",
  qdt: "urn:un:unece:uncefact:data:standard:QualifiedDataType:100",
  udt: "urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100",
} as const;

/** BT-24 for XRechnung 3.0 and BT-23 (PEPPOL billing process). */
export const XRECHNUNG_GUIDELINE = "urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0";
export const BUSINESS_PROCESS = "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0";
