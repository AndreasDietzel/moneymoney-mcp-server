# MoneyMoney CSV Export Anleitung

Da MoneyMoney's Datenbank verschlüsselt ist, ist der beste Weg zum Datenzugriff der **CSV-Export**.

## 📤 Daten aus MoneyMoney exportieren

### 1. Transaktionen exportieren

1. **Öffne MoneyMoney**
2. **Wähle ein Konto** oder "Alle Konten"
3. **Menü: Ablage → Exportieren → CSV-Export...**
4. **Einstellungen**:
   - Trennzeichen: Semikolon (;)
   - Zeichenkodierung: UTF-8
   - Datumsformat: TT.MM.JJJJ
   - Zeitraumfilter: Letztes Jahr (oder gewünschter Zeitraum)
5. **Speichern als**: `~/Projects/moneymoney-mcp-server/data/transactions.csv`

### 2. Automatischer Export (Geplant)

MoneyMoney unterstützt leider keine automatischen Exporte. Alternativen:

#### Option A: AppleScript für automatischen Export
```applescript
-- Wird in zukünftiger Version implementiert
tell application "MoneyMoney"
    export transactions to file "~/Projects/moneymoney-mcp-server/data/transactions.csv"
end tell
```

#### Option B: Cron-Job für regelmäßigen manuellen Trigger
```bash
# Hinweis anzeigen für manuellen Export
echo "Bitte MoneyMoney CSV-Export aktualisieren"
```

## 📥 CSV-Format

Der MCP Server erwartet folgendes CSV-Format:

```csv
Datum;Valuta;Name;Verwendungszweck;Betrag;Währung;Konto
17.01.2026;17.01.2026;REWE Markt;Lebensmitteleinkauf;-45.80;EUR;Girokonto
16.01.2026;16.01.2026;Employer GmbH;Gehalt Januar;3500.00;EUR;Girokonto
```

## 🔄 Implementierungsstatus

- ✅ CSV-Parser implementiert
- ✅ Automatisches Einlesen bei Server-Start
- ⏳ AppleScript-Integration (geplant)
- ⏳ Automatischer Export-Trigger (geplant)

## 💡 Warum kein direkter Datenbankzugriff?

MoneyMoney verwendet eine **verschlüsselte SQLite-Datenbank** zum Schutz sensibler Finanzdaten. Dies ist eine Sicherheitsmaßnahme. Der CSV-Export ist der von MoneyMoney vorgesehene Weg zum Datenexport.
