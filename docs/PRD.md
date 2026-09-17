# PRD: E-Invoice Gatekeeper

- **Status:** Entwurf v0.1
- **Stand:** 16.09.2026
- **Kontext:** Einreichung im Nebius x NVIDIA Global AI Hackathon, Best Apps and Agents Track
- **Verwandte Dokumente:** `docs/SRS.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`

---

## 1. Problem

Deutsche Unternehmen müssen im B2B-Verkehr von PDF auf strukturierte E-Rechnungen nach EN 16931 umstellen. Empfangen müssen sie seit 2025, die Versandpflicht kommt gestaffelt. Viele kleine Betriebe erzeugen ihre Rechnungen weiter als PDF aus Word, Excel oder Branchensoftware.

Bestehende KI-Konverter lassen ein Sprachmodell die strukturierte Rechnung erzeugen. Das Ergebnis sieht plausibel aus, ist aber nicht nachweisbar korrekt. Typische Fehler: erfundene Pflichtfelder, falsch gerundete Summen, Codes, die in keiner Codeliste stehen. Bei einer Rechnung ist "wahrscheinlich richtig" steuerlich und buchhalterisch wertlos.

**Kernaussage für die Jury:** Das Modell schlägt vor, der offizielle Validator entscheidet, und fehlende Fakten werden erfragt statt erfunden.

## 2. Zielgruppen

| Gruppe | Rolle im Projekt | Bedürfnis |
|---|---|---|
| Kleine Betriebe, Handwerk, Freiberufler | Demo-Persona | PDF rein, gültige E-Rechnung raus, ohne Fachwissen zu EN 16931 |
| Buchhaltungs- und Softwareanbieter | Sekundär, API-Perspektive | Nachvollziehbare Umwandlung mit Prüfprotokoll |
| Hackathon-Jury | Faktisches Publikum | Nicht-offensichtliche Nemotron-Nutzung, komplettes Produkt, glaubwürdiger Impact |

**Annahme:** Die Jury bewertet überwiegend anhand von Video und Beschreibung. Laut Regeln sind Juroren nicht verpflichtet, die Demo selbst zu testen.

## 3. Ziele und Nicht-Ziele

### Ziele
- G-01: Eine hochgeladene PDF-Rechnung wird in eine XRechnung (CII) umgewandelt, die der KoSIT-Validator als valide bestätigt.
- G-02: Zusätzlich entsteht eine ZUGFeRD-Hybridrechnung (PDF/A-3 mit eingebettetem CII, Profil EN16931), sofern der Spike in Phase 1 erfolgreich ist.
- G-03: Jede Umwandlung ist über ein Hash-verkettetes Audit-Log nachvollziehbar.
- G-04: Ein reproduzierbarer Benchmark belegt Validierungsquote, Feldgenauigkeit, Kosten und Laufzeit.
- G-05: Einreichung vollständig und regelkonform bis 28.10.2026.

### Nicht-Ziele
- Versand über Peppol, E-Mail oder Portale
- ERP- oder Buchhaltungs-Integrationen
- Eingangsrechnungs-Verarbeitung (Empfang, Buchung)
- UBL-Ausgabe, Gutschriften-Sonderfälle, Fremdwährungen außer EUR
- Handschriftliche Rechnungen
- Nutzerkonten, Persistenz, Bezahlfunktionen
- Rechtsberatung oder steuerliche Beurteilung

## 4. Use Cases

**UC-01 Standardumwandlung.** Nutzer lädt ein PDF hoch. Die App zeigt die Verarbeitungsschritte live. Ergebnis: valide XRechnung und ZUGFeRD-PDF zum Download, Prüfbericht grün.

**UC-02 Automatische Reparatur.** Die erste Fassung verletzt Validator-Regeln, zum Beispiel wegen eines falsch gemappten Einheitencodes. Die App zeigt die Regelverletzung in verständlicher Sprache, den Reparaturvorschlag mit Beleg aus dem Dokument und die erneute, erfolgreiche Prüfung.

**UC-03 Fehlende Fakten.** Ein Pflichtfeld steht nicht im Dokument, etwa die Käuferreferenz (Leitweg-ID) für XRechnung oder die elektronische Adresse des Käufers. Die App erfindet nichts, sondern fragt gezielt nach. Nach der Eingabe wird neu validiert.

**UC-04 Inkonsistentes Dokument.** Die im PDF gedruckte Gesamtsumme passt nicht zu den Positionen. Die App korrigiert das nicht still, sondern markiert die Abweichung und zeigt die berechneten Werte.

**UC-05 Nachvollziehbarkeit.** Nutzer lädt das Audit-Log herunter und prüft die Hash-Kette mit einem mitgelieferten Befehl.

**UC-06 Beispielgalerie.** Juroren ohne eigene Rechnung wählen synthetische Beispiel-PDFs (sauber, verrauscht, fehlerhaft) und sehen denselben Ablauf.

## 5. Funktionsumfang (MoSCoW)

Detaillierte, testbare Anforderungen mit IDs stehen in `.planning/REQUIREMENTS.md`. Hier die Produktsicht:

| Feature | Priorität | Kurzbeschreibung |
|---|---|---|
| PDF-Upload mit Limits | Must | Max. 5 MB, max. 5 Seiten, Text- und Scan-PDFs |
| Live-Schrittanzeige | Must | Zustand der State Machine als Stream |
| Extraktion mit Belegen | Must | Jedes Feld mit Zitat und Seitenzahl oder als fehlend markiert |
| Deterministische Berechnung | Must | Summen, USt-Aufschlüsselung, Rundung ohne LLM |
| KoSIT-Validierung | Must | Offizieller Validator, Regel-ID und Fundstelle pro Fehler |
| Reparaturschleife | Must | Max. 3 Iterationen, nur belegte Patches |
| Rückfrage bei fehlenden Fakten | Must | Formular nur für die tatsächlich fehlenden Felder |
| XRechnung-Download | Must | CII-XML |
| Audit-Log + Verifikation | Must | JSONL-Hash-Kette, CLI-Prüfbefehl |
| Beispielgalerie | Must | Mindestens 6 synthetische PDFs |
| Benchmark-Harness | Must | Reproduzierbar, Ergebnisse im README |
| ZUGFeRD-Hybrid-PDF | Should | Abhängig vom Cut-Gate 23.09. |
| Verständliche Fehlererklärung | Should | Regelverletzung in Klartext DE/EN |
| Tavily-Fallback für unbekannte Regeln | Should | Mit Quellenlink, gecacht |
| Kosten- und Zeitanzeige pro Lauf | Could | Tokens, Kosten, Dauer je Schritt |
| Diff-Ansicht zwischen Iterationen | Could | Welche Felder der Patch geändert hat |

## 6. Abgleich mit den Bewertungskriterien

Die vier Kriterien sind gleich gewichtet.

| Kriterium | Wie das Projekt es adressiert |
|---|---|
| Technological Implementation | Modell-Routing (Nano Omni für Vision-Extraktion, Ultra für Reparatur, Nano/Super für Erklärungen), Validator als Gate, messbarer Benchmark, Kosten pro Rechnung |
| Design | Kompletter Ablauf von Upload bis Download, Live-Schritte, Rückfragen statt Sackgassen, Beispielgalerie |
| Potential Impact | Konkrete Pflicht mit konkreter Zielgruppe, belegt durch Benchmark auf offiziellem Testkorpus |
| Quality of the Idea | Architektur "LLM schlägt vor, Validator entscheidet" plus Evidenzpflicht, statt einer weiteren Konverter-Hülle |

## 7. Demo-Video (≤ 3 Minuten, Storyboard)

| Zeit | Inhalt |
|---|---|
| 0:00–0:20 | Problem: PDF-Rechnung, Pflicht zur E-Rechnung, warum "KI schreibt XML" nicht reicht |
| 0:20–1:30 | Live-Lauf mit verrauschtem PDF: Extraktion, Validator-Fehler, Reparatur mit Beleg, Rückfrage nach fehlender Käuferreferenz, grün |
| 1:30–2:10 | Architektur und Nemotron-Routing, Token Factory explizit benennen (Pflicht laut Regeln) |
| 2:10–2:40 | Benchmark-Zahlen, Audit-Log-Verifikation, ZUGFeRD-PDF im Viewer |
| 2:40–3:00 | Abschluss, Repo-Link |

## 8. Wettbewerb und Abgrenzung

Kommerzielle Anbieter bieten bereits KI-Extraktion von PDF zu ZUGFeRD als API an (z. B. InvoiceXML). Open-Source-Bausteine wie Mustangproject und die KoSIT-Komponenten erzeugen und prüfen E-Rechnungen, extrahieren aber nicht aus beliebigen PDFs.

Die Abgrenzung dieses Projekts liegt nicht in der Konvertierung selbst, sondern in drei Punkten: Validator als verbindliches Gate in der Schleife, Evidenzpflicht pro Feld mit Rückfrage statt Erfindung, und ein offen publizierter Benchmark mit Audit-Log.

**Offene Frage:** Wie gut schneiden kommerzielle Konverter auf demselben Korpus ab? Ein Vergleich wäre stark, ist aber außerhalb des Zeitbudgets und nicht eingeplant.

## 9. Erfolgskriterien

| ID | Metrik | Zielwert |
|---|---|---|
| SM-01 | Validierungsquote, Korpus "clean" | ≥ 90 % |
| SM-02 | Validierungsquote, Korpus "noisy" | wird gemessen und ehrlich berichtet, kein Zielwert |
| SM-03 | Felder ohne Herkunft im Output | 0 |
| SM-04 | Korrekte Endbeträge (BT-112, BT-115) bei validen Ausgaben | 100 % |
| SM-05 | Durchschnittliche Modellkosten pro Rechnung | ≤ 0,03 $ |
| SM-06 | Median Ende-zu-Ende-Laufzeit bis 3 Seiten | ≤ 60 s |
| SM-07 | Einreichung vollständig | bis 28.10.2026 |

**Annahme:** SM-01 und SM-06 sind Schätzwerte ohne Messung. Nach Phase 2 werden sie anhand der Baseline angepasst.

## 10. Annahmen und offene Fragen

- **Annahme:** Nemotron-3-Nano-Omni verarbeitet mehrere Seitenbilder in einem Aufruf und liefert strukturiertes JSON zuverlässig genug.
- **Annahme:** Die KoSIT-Testsuite enthält genug fachlich unterschiedliche Rechnungen für einen aussagekräftigen Korpus.
- **Offene Frage:** Endgültiger Produktname.
- **Offene Frage (Option, nicht eingeplant):** Soll die Belegprüfung je Feld von der Extraktion getrennt werden — durch ein separates Urteilsmodell mit kalibrierter Wahrscheinlichkeit (Kandidat: TypeSafe/Jev)? Das würde "Rückfrage statt Erfindung" von einer Prompt-Anweisung zu einer messbaren Schwelle machen und trifft damit genau den Abgrenzungspunkt aus Abschnitt 8. Erst zu klären: Hackathon-Regeln zu Modellen außerhalb der Nebius Token Factory, Wirkung auf die Bewertung, Latenz, Kosten und ein weiterer externer Dienst im Audit-Pfad. Wenn das angegangen wird, vorher vollständig abwägen. Details in SRS 5.
- **Offene Frage:** Bleiben die Planungsdokumente auf Deutsch im öffentlichen Repo oder werden sie vor der Einreichung übersetzt beziehungsweise verschoben?
