# SRS: E-Invoice Gatekeeper

- **Status:** Entwurf v0.1
- **Stand:** 16.09.2026
- **Bezug:** `docs/PRD.md`. Anforderungs-IDs und Phasenzuordnung in `.planning/REQUIREMENTS.md`.

---

## 1. Systemkontext

```
 Browser ──HTTPS──► web (Next.js, Koyeb, öffentlich)
                      │  Agent-Loop, SSE, Kosten-Guard, Rate-Limit
                      ├──► Nebius Token Factory (Nemotron-Modelle)
                      ├──► Tavily (nur Fallback für unbekannte Regeln)
                      └──HTTP intern + Shared Secret──► verifier (Java, Koyeb, nicht öffentlich)
                                                           KoSIT Validator + XRechnung-Konfiguration
                                                           KoSIT Visualisierung (PDF/A)
                                                           Mustang (ZUGFeRD combine/validate)
```

Keine Datenbank im MVP. Uploads werden nur im Arbeitsspeicher beziehungsweise temporär verarbeitet und nach dem Lauf gelöscht.

## 2. Komponenten

| Komponente | Verantwortung |
|---|---|
| `packages/core/model` | zod-Schema des Semantic Model (Teilmenge EN 16931), Provenance-Typen |
| `packages/core/normalize` | Datums-, Dezimal-, Länder-, Einheiten- und USt-Kategorie-Normalisierung gegen Codelisten |
| `packages/core/derive` | Positionsbeträge, USt-Aufschlüsselung (BG-23), Summen (BG-22), Rundung |
| `packages/core/cii` | Deterministischer Builder Semantic Model → CII-XML (XRechnung 3.0.x bzw. ZUGFeRD EN16931) |
| `packages/core/agent` | State Machine, Modell-Aufrufe über zentralen Client, Patch-Anwendung |
| `packages/core/audit` | Hash-Kette, Serialisierung JSONL, Verifikation |
| `packages/core/llm` | Token-Factory-Client, Modell-Routing, Token- und Kostenzählung, Budget-Guard |
| `apps/web` | Upload, SSE-Stream, Ergebnisansicht, Rückfrageformular, Downloads, Galerie |
| `services/verifier` | Validierung, PDF/A-Rendering, ZUGFeRD-Kombination und -Prüfung |
| `eval` | Korpus-Download (gepinnt), PDF-Rendering, Degradation, Mutationen, Benchmark |

## 3. Semantic Model (MVP-Teilmenge)

Jedes Feld ist ein `Field<T>`:

```ts
type Provenance =
  | { kind: "evidence"; page: number; quote: string }
  | { kind: "derived"; rule: string; inputs: string[] }   // z. B. "sum-line-net-amounts"
  | { kind: "user"; enteredAt: string };

type Field<T> = { value: T; provenance: Provenance } | { value: null; missingReason: string };
```

Abgedeckte Business Terms im MVP:

| Gruppe | BTs |
|---|---|
| Rechnungskopf | BT-1 Nummer, BT-2 Datum, BT-3 Typcode (nur 380), BT-5 Währung (EUR), BT-9 Fälligkeit, BT-10 Käuferreferenz, BT-13 Bestellreferenz, BT-20 Zahlungsbedingungen |
| Verkäufer (BG-4) | BT-27 Name, BT-31 USt-IdNr., BT-32 Steuernummer, BT-34 elektronische Adresse, BG-5 Adresse (BT-35, BT-37, BT-38, BT-40), BG-6 Kontakt (BT-41, BT-42, BT-43) |
| Käufer (BG-7) | BT-44 Name, BT-49 elektronische Adresse, BG-8 Adresse (BT-50, BT-52, BT-53, BT-55) |
| Zahlung (BG-16) | BT-81 Zahlungsart-Code, BT-84 IBAN |
| Positionen (BG-25) | BT-126 ID, BT-129 Menge, BT-130 Einheit, BT-131 Nettobetrag (derived), BT-146 Nettopreis, BT-151 USt-Kategorie, BT-152 USt-Satz, BT-153 Bezeichnung |
| USt-Aufschlüsselung (BG-23) | BT-116, BT-117, BT-118, BT-119 (alle derived) |
| Summen (BG-22) | BT-106, BT-109, BT-110, BT-112, BT-115 (alle derived) |

**Annahme:** Diese Teilmenge reicht für die Rechnungen des Korpus. Rechnungen mit Nachlässen, Zuschlägen (BG-20/21) oder Sonderfällen der USt werden in Phase 2 identifiziert und entweder aufgenommen oder aus dem Korpus ausgeschlossen und dokumentiert.

**Regel:** Beträge, die im Dokument gedruckt sind (z. B. Gesamtsumme), werden als `documentTotals` separat extrahiert und nur zum Abgleich genutzt, nie direkt übernommen.

## 4. Agent-Loop (State Machine)

```
INGEST → RASTERIZE → EXTRACT → EVIDENCE_CHECK → NORMALIZE → DERIVE → CONSISTENCY_CHECK
       → BUILD_CII → VALIDATE ─ valid ──────────────────────────────► OUTPUT
                        │ invalid
                        ▼
                  REPAIR_PLAN → PATCH_GUARD → (zurück zu NORMALIZE)   max. 3 Iterationen
                        │ nicht reparierbar aus dem Dokument
                        ▼
                  NEEDS_INPUT → (Nutzereingabe) → NORMALIZE ...
```

| Zustand | Beschreibung | Akteur |
|---|---|---|
| INGEST | Limits prüfen (Größe, Seiten, MIME), SHA-256 des Uploads | core |
| RASTERIZE | Seiten als PNG, Textlayer extrahieren falls vorhanden | core |
| EXTRACT | JSON gegen Schema, pro Feld Zitat + Seite | Nemotron-3-Nano-Omni |
| EVIDENCE_CHECK | Bei Textlayer: normalisiertes Zitat muss im Seitentext vorkommen, sonst Feld auf `missing`. Ohne Textlayer: Status `evidence-unverified`, im UI kenntlich | core |
| NORMALIZE | Codelisten-Mapping, Formate. Unbekannte Codes → `missing` mit Grund | core |
| DERIVE | Alle berechneten BTs, Rundung nach EN-16931-Regeln | core |
| CONSISTENCY_CHECK | Abgleich `documentTotals` gegen berechnete Summen, Abweichung als Warnung | core |
| BUILD_CII | XRechnung-CII bzw. ZUGFeRD-EN16931-CII | core |
| VALIDATE | Verifier-Aufruf, Report + Report-Hash | verifier |
| REPAIR_PLAN | Input: Regelverletzungen (ID, Meldung, XPath), aktuelles Modell, Seitenbilder. Output: RFC-6902-Patches auf das Semantic Model, jeder Patch mit Provenance, oder Kennzeichnung "nicht aus Dokument lösbar" | Nemotron 3 Ultra |
| PATCH_GUARD | Verwirft Patches auf derived-Felder, Patches ohne Provenance und Patches mit nicht nachweisbarem Zitat | core |
| NEEDS_INPUT | Liste fehlender Felder mit Erklärung, UI-Formular | web |
| OUTPUT | Downloads, Audit-Log-Abschluss mit Kopf-Hash | core |

**Abbruch:** Nach 3 Reparatur-Iterationen ohne Fortschritt (Anzahl Fehler sinkt nicht) → NEEDS_INPUT mit verbleibenden Regelverletzungen.

**Fehlererklärung:** Für jede Regel-ID existiert eine lokale Erklärungstabelle. Fehlt ein Eintrag, erzeugt ein Nano/Super-Aufruf eine Klartext-Erklärung auf Basis der Validator-Meldung. Bei zusätzlichem Kontextbedarf ruft das System Tavily auf und zeigt die Quelle an. Ergebnisse werden pro Regel-ID gecacht.

## 5. Modell-Routing

| Aufgabe | Modell | Begründung |
|---|---|---|
| Extraktion aus Seitenbildern | Nemotron-3-Nano-Omni | Vision-fähig, günstig, strukturierte Ausgabe |
| Reparaturplanung | Nemotron 3 Ultra | Mehrschrittiges Reasoning über Regelverletzung, Modell und Dokument |
| Fehlererklärungen | Nemotron 3 Nano oder Super | Kurze Texte, hohe Frequenz |

**Offene Frage:** Exakte Modell-IDs, Base-URL und Kontextlimits in Token Factory. Vor Phase 3 in der Konsole beziehungsweise Doku verifizieren und in `.env.example` eintragen.

**Offene Frage:** Unterstützt Nano Omni mehrere Bilder pro Anfrage? Falls nicht: Extraktion pro Seite und deterministisches Zusammenführen.

**Option, nicht eingeplant:** Die Entscheidung "ist dieses Feld tatsächlich durch das Dokument belegt?" trifft heute dasselbe Modell, das den Wert extrahiert hat. Ein separates Urteilsmodell mit kalibrierter Wahrscheinlichkeit statt Textausgabe (Kandidat: TypeSafe/Jev, "System One") könnte diese Prüfung vom Extraktor trennen: eine Ja/Nein-Frage je Feld, deren Wahrscheinlichkeit eine im Code gesetzte Schwelle bedient. Damit würde die Produktaussage "Rückfrage statt Erfindung" (PRD 8) zu einer messbaren Schwelle, statt einer Prompt-Anweisung an den Extraktor zu vertrauen. Verwandter Ansatz an derselben Stelle: Kandidatenwerte deterministisch aus dem Dokument sammeln und das Modell nur auswählen lassen — ein ausgewählter Wert kann nicht erfunden sein.

**Vor einer Umsetzung zu klären — die Option ist ausdrücklich noch nicht abgewogen:** (1) ob die Hackathon-Regeln ein Modell außerhalb der Nebius Token Factory im Kernpfad zulassen und ob es die Bewertung im Track "Best Apps and Agents" schwächt; (2) zusätzliche Latenz gegen das Zeitbudget der Schleife; (3) Kosten je Feld bei mehreren Feldern pro Rechnung; (4) ein weiterer externer Dienst im Audit-Pfad (Abschnitt 6) und dessen Verfügbarkeit. Solange das offen ist, bleiben D-02 und das Modell-Routing oben unverändert.

## 6. Audit-Log

Format: JSONL, ein Event pro Zeile.

```json
{ "seq": 7, "ts": "2026-10-05T10:12:03.123Z", "type": "VALIDATE",
  "actor": { "kind": "verifier", "version": "kosit-validator-1.6.x", "config": "xrechnung-3.0.2-..." },
  "inputHash": "sha256:...", "outputHash": "sha256:...",
  "data": { "valid": false, "errorCount": 2 },
  "prevHash": "sha256:...", "hash": "sha256:..." }
```

- `hash = sha256(JCS(event ohne "hash"))`, kanonisiert nach RFC 8785
- Event 0 enthält Upload-Hash, Software-Version und gepinnte Komponenten-Versionen
- Modell-Events enthalten Modell-ID, Prompt-Hash, Token-Zahlen und Kosten, aber keine Rohinhalte der Rechnung
- Letztes Event enthält Hashes aller Ausgabedateien
- Verifikation: `pnpm audit:verify <datei.jsonl>` prüft Kette und optional Ausgabedateien

**Annahme:** Das Audit-Log ist ein Nachvollziehbarkeits-Nachweis für die Demo, keine GoBD-Archivlösung. So wird es auch in UI und README bezeichnet.

## 7. Verifier-API (intern)

Alle Endpunkte verlangen den Header `X-Verifier-Secret`. Der Dienst ist nicht öffentlich erreichbar.

| Methode | Pfad | Input | Output |
|---|---|---|---|
| GET | `/health` | – | Status, Versionen |
| POST | `/v1/validate/xrechnung` | CII-XML | `{ valid, errors: [{ ruleId, severity, message, location }], reportHash, versions }` |
| POST | `/v1/render/pdfa` | CII-XML | PDF/A-1 (KoSIT-Visualisierung) |
| POST | `/v1/zugferd/combine` | PDF/A + CII-XML | ZUGFeRD PDF/A-3 |
| POST | `/v1/zugferd/validate` | PDF | Mustang-Validierungsergebnis im selben Fehlerformat |

**Offene Frage (Spike Phase 1):** Funktioniert die Kette KoSIT-Visualisierung → PDF/A-1 → Mustang-Migration nach PDF/A-3 mit Einbettung, und besteht das Ergebnis die Mustang-Validierung? Fallback-Option innerhalb des Spikes: Mustang-eigene Visualisierung. Scheitert beides bis 23.09., entfällt ZUGFeRD (Entscheidung D-03).

## 8. Evaluations-Harness

- **Korpus-Quelle:** KoSIT xrechnung-testsuite, gepinntes Release, beim Setup per Script geladen
- **Sets:**
  - `clean`: Rendering über KoSIT-Visualisierung und 3 eigene HTML-Layouts (Playwright)
  - `noisy`: gerasterte Varianten mit leichter Drehung, Rauschen, reduzierter Auflösung, ohne Textlayer
  - `mutated`: valide XMLs mit gezielten Fehlern, um Reparatur und Rückfrage isoliert zu testen
- **Metriken pro Lauf:** valide ja/nein, Feldgenauigkeit pro BT gegen Ground Truth, Anzahl Iterationen, Felder ohne Herkunft, Tokens, Kosten, Laufzeit pro Zustand
- **Ausgabe:** `eval/results/<datum>-<set>.json` und `.md`, Kennzahlen ins README
- **Regel:** Keine Optimierung auf einzelne Korpusdateien. Ein Holdout-Teil (ca. 20 %) wird erst in Phase 5 ausgewertet.

## 9. Nicht-funktionale Anforderungen

| ID | Anforderung |
|---|---|
| NFR-01 | Durchschnittliche Modellkosten ≤ 0,03 $ pro Rechnung (Korpus clean) |
| NFR-02 | Median Ende-zu-Ende ≤ 60 s bei ≤ 3 Seiten |
| NFR-03 | Uploads werden nicht persistiert; temporäre Dateien werden nach dem Lauf gelöscht; keine Rechnungsinhalte in Logs |
| NFR-04 | Upload-Limits: 5 MB, 5 Seiten, nur `application/pdf` |
| NFR-05 | Rate-Limit pro IP und globales Tagesbudget; bei Überschreitung zeigt die UI vorberechnete Galerie-Läufe statt Fehlerseite |
| NFR-06 | Demo erreichbar bis mindestens 15.12.2026 |
| NFR-07 | Lokaler Start mit `docker compose up` plus `pnpm dev` ohne Cloud-Abhängigkeit außer Token Factory |
| NFR-08 | gitleaks in CI und pre-commit, keine Secrets im Repo |
| NFR-09 | UI und README auf Englisch |
| NFR-10 | Alle gepinnten Versionen (Validator, Konfiguration, Mustang, Modelle) an einer Stelle gepflegt und im Audit-Log sichtbar |

## 10. Deployment

- Koyeb-App mit zwei Services: `web` (öffentlich) und `verifier` (nur intern)
- **Offene Frage:** Private Service-to-Service-Kommunikation auf Koyeb und RAM-Bedarf der JVM mit KoSIT und Mustang in einem Prozess. In Phase 1 messen, Instanzgröße danach wählen.
- Ausweichoption bei Problemen mit privatem Netz: Verifier öffentlich, aber nur mit Secret-Header, Rate-Limit und ohne GUI des KoSIT-Daemons
- Beispielgalerie-Läufe werden vorberechnet und als statische Dateien ausgeliefert

## 11. Entscheidungen

| ID | Entscheidung | Begründung |
|---|---|---|
| D-01 | TypeScript für App und Kern, Java nur im Verifier | Patricks Stack; KoSIT und Mustang sind Java-Referenzimplementierungen |
| D-02 | LLM erzeugt nur JSON-Patches, nie XML oder Beträge | Kern der Produktaussage, macht Fehler lokalisierbar |
| D-03 | ZUGFeRD hängt am Cut-Gate 23.09. | Höchstes technisches Risiko, früh klären |
| D-04 | Keine Datenbank im MVP | Weniger Angriffsfläche, kein Datenschutzaufwand, Zeitbudget |
| D-05 | Hosting auf Koyeb für beide Dienste | Kein Kaltstart, bestehendes Konto |
| D-06 | Apache 2.0 | Hackathon-Pflicht, kompatibel mit KoSIT und Mustang |
| D-07 | Holdout-Split im Korpus | Glaubwürdigkeit der Benchmark-Zahlen |

## 12. Risiken

| Risiko | Auswirkung | Gegenmaßnahme |
|---|---|---|
| PDF/A-3-Kette funktioniert nicht | ZUGFeRD entfällt | Spike in Phase 1, Cut-Gate |
| Nano Omni extrahiert Scans zu ungenau | Niedrige Quote im Set noisy | Ehrlich berichten; Ultra für schwierige Seiten als Fallback testen |
| Token Factory Rate-Limits oder Modellverfügbarkeit | Demo hängt | Retry mit Backoff, vorberechnete Galerie |
| Credits reichen nicht | Entwicklung stockt | Kostenzählung ab erstem Aufruf, Eval-Läufe budgetieren |
| Lizenz der KoSIT-Testsuite erlaubt keine Weitergabe | Korpus nicht im Repo | Nur Download-Script im Repo, generierte Dateien in `.gitignore` |
| Zeitbudget überschritten | Konflikt mit Labrechner-Deal und Bewerbungen | Kill-Gate 10.10., Stunden pro Phase tracken |
| Öffentliche Demo wird missbraucht | Credits verbrannt | Rate-Limit, Tagesbudget, Größenlimits |
