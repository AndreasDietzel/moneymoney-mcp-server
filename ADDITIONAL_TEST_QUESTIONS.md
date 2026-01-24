# Zusätzliche Testfragen zur Validierung des Konten-Mappings

## Test 1: Baufinanzierung - ING-DiBa Rate Dezember 2025
**MoneyMoney:** Suche nach "ING-DiBa AG 2010827641 30.12.2025"
- Erwartete Kontobezeichnung: **Baufinanzierung** oder ein Darlehens-Konto bei ING-DiBa
- Erwarteter Betrag: **+1.006,90 EUR** (Lastschrift/Belastung)
- Verwendungszweck sollte enthalten: "Zinsen 538,15 Tilgung 468,75"

**Perplexity:** "Finde die Transaktion 'ING-DiBa AG 2010827641 30.12.2025' und sag mir auf welchem Konto sie ist"
- Erwartete Antwort: Baufinanzierung (DE87500105172010827641)
- Mit den Details: Zinsen 538,15 + Tilgung 468,75 = 1.006,90 EUR

---

## Test 2: Alle ING-DiBa Raten im Überblick
**Perplexity:** "Zeige mir alle Transaktionen zum ING-DiBa Darlehen (2010827641)"
- Erwartete Antwort: 8 Monatliche Raten auf dem Baufinanzierung-Konto
- Vom November 2025 bis Dezember 2025
- Jede Rate sollte Zinsen + Tilgung enthalten

**Oder:** "Wieviel Tilgung habe ich 2025 geleistet?"
- Erwartete Berechnung basierend auf den 8 Raten
- November: 467,03 EUR
- Dezember: 468,75 EUR
- etc.

---

## Test 3: Kontenübersicht validieren
**Perplexity:** "Welche Konten siehst du insgesamt?"
- Erwartete Antwort sollte enthalten:
  1. Girokonto (DE06500105175418209888) - Checking - 1.594,93 EUR
  2. Tagesgeldkonto - Savings - 7.300,00 EUR
  3. Baufinanzierung (DE87500105172010827641) - Loan - -145.967,97 EUR ⭐ NEGATIV
  4. Direkt-Depot - Investment - 0,00 EUR

---

## Test 4: Kategorie-Hierarchie validieren
**Perplexity:** "Welche Ausgabenkategorien erkennst du und wie viele Transaktionen pro Kategorie?"
- Erwartete Top-Level Kategorien: Ausgaben, Umbuchungen, Einnahmen, Rückstellungen
- Beispiele:
  - Ausgaben > Verbrauchsgüter > Gastronomie
  - Ausgaben > Existenz > Gesundheit
  - Ausgaben > Dienstleistung > Haushalt > Strom
  - Ausgaben > Dienstleistung > Mobilität > Nahverkehr

---

## Test 5: Sonderfall - Direkt-Depot
**Perplexity:** "Was ist auf dem Direkt-Depot Konto los?"
- Erwartete Antwort: Nur 1 Transaktion (Ausgleichsbuchung vom 29.04.2025)
- Erkärung: Das Konto wurde in MoneyMoney als "aufgelöst" markiert
- Betrag: +76.908,95 EUR (automatische Kalibrierungsbuchung)

---

## Validierungs-Checkliste:
- [ ] Baufinanzierung zeigt die ING-DiBa Raten (25 Transaktionen)
- [ ] Girokonto hat ~1.188 Transaktionen
- [ ] Tagesgeldkonto hat ~130 Transaktionen
- [ ] Direkt-Depot hat nur 1 Transaktion
- [ ] Alle 4 Konten sind in der get_accounts Liste sichtbar
- [ ] Kategorien sind hierarchisch strukturiert
- [ ] Balances sind korrekt (besonders Baufinanzierung im Minus!)
