=== MONEYMONEY MCP SERVER - STATUS REPORT ===
Generated: 2026-01-17

DATEN-ÜBERSICHT
===============

Konten gesamt: 4
✅ Girokonto (DE06500105175418209888)
   - Transaktionen: 1.188
   - Saldo: 1.594,93 EUR
   - Typ: Checking

✅ Tagesgeldkonto
   - Transaktionen: 130
   - Saldo: 7.300,00 EUR
   - Typ: Savings

✅ Baufinanzierung (DE87500105172010827641) [KORRIGIERT]
   - Transaktionen: 25 (ING-DiBa Raten)
   - Saldo: -145.967,97 EUR
   - Typ: Loan
   - ⭐ ING-DiBa AG 2010827641 Monatsraten (Zinsen + Tilgung)

✅ Direkt-Depot
   - Transaktionen: 1 (Ausgleichsbuchung)
   - Saldo: 0,00 EUR
   - Typ: Investment

Transaktionen insgesamt: 1.344


BEHOBENE PROBLEME
=================

1. ✅ Account-Misidentifikation
   Problem: ING-DiBa Raten wurden dem Direkt-Depot zugeordnet
   Lösung: UUIDs in account-mappings.json korrekt gemappt
   Status: GELÖST

2. ✅ Baufinanzierung nicht in Kontenliste
   Problem: Nur Konten mit Transaktionen wurden angezeigt
   Lösung: get_accounts() lädt jetzt auch Konten aus account-mappings.json
   Status: GELÖST

3. ✅ Sicherheit & Portabilität
   Problem: Kontodaten und UUIDs waren hartcodiert
   Lösung: Externalisiert in account-mappings.json (gitignored)
   Status: GELÖST

4. ✅ Korrekte Kontostände
   Problem: Nur Transaktionssummen statt echte Balances
   Lösung: Real balances aus accounts.json geladen
   Status: GELÖST

5. ✅ Kategorie-Hierarchie
   Problem: Kategorien waren flache Strings
   Lösung: Parse zu categoryPath Arrays mit Hierarchie
   Status: GELÖST


KATEGORIEN-STRUKTUR
===================

Top-Level Kategorien: 4
- Ausgaben (größte Kategorie)
  * Verbrauchsgüter > Gastronomie
  * Verbrauchsgüter > Einkauf
  * Dienstleistung > Haushalt > Strom
  * Dienstleistung > Mobilität > Nahverkehr
  * Existenz > Gesundheit

- Umbuchungen
  * Echte Umbuchung (Transfers zwischen Konten)
  * Fremdkapital Eigentumswohnung (Darlehensraten)

- Einnahmen
  * Zinsen

- Rückstellungen

Eindeutige Pfade: 39


MCP TOOLS VERFÜGBAR
===================

1. get_status
   → Zeigt Server-Status und Ladenfortschritt

2. get_accounts
   → Liste aller 4 Konten mit Balances
   ✅ Baufinanzierung ist jetzt sichtbar

3. get_transactions
   → Alle Transaktionen optional gefiltert nach Konto
   ✅ ING-DiBa Raten korrekt auf Baufinanzierung

4. get_categories
   → Hierarchische Kategoriestruktur
   ✅ Ermöglicht Aggregation nach Ausgabentyp

5. refresh_data
   → Triggert MoneyMoney Export neu


EMPFOHLENE TESTFRAGEN FÜR PERPLEXITY
====================================

Test 1: "Auf welchem Konto sind die ING-DiBa Raten (2010827641)?"
→ Sollte antworten: Baufinanzierung (DE87500105172010827641)

Test 2: "Welche Konten sieht du insgesamt?"
→ Sollte alle 4 Konten mit korrekten Balances aufzählen

Test 3: "Wieviel Tilgung habe ich 2025 geleistet?"
→ Sollte die 8 Raten zusammenrechnen

Test 4: "Zeige mir die Kategoriestruktur"
→ Sollte hierarchische Kategorien mit Beispielen zeigen

Test 5: "Welches Konto ist negativ und warum?"
→ Sollte Baufinanzierung mit Erklärung zeigen


NÄCHSTE SCHRITTE
================

1. In Perplexity testen:
   - "Auf welchem Konto sind die ING-DiBa Raten?"
   - Sollte jetzt: Baufinanzierung (nicht mehr Direkt-Depot)

2. Validierung:
   - Alle 4 Konten sollten in get_accounts sichtbar sein
   - Balances sollten korrekt angezeigt werden
   - Kategorien sollten hierarchisch strukturiert sein

3. Optional: Weitere Analysen
   - Ausgaben nach Kategorie aggregieren
   - Sparquote berechnen (Einnahmen vs. Ausgaben)
   - Darlehenstilgung verfolgen
