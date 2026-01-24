# Migration zur offiziellen MoneyMoney AppleScript API

## 🎉 Was wurde verbessert?

### Vorher: UI-Automation 
- ❌ Erforderte UI-Automation Berechtigungen
- ❌ Anfällig für UI-Änderungen
- ❌ Langsamer (Menu-Navigation, Dialoge)
- ❌ CSV-Format mit Parsing-Problemen

### Jetzt: Offizielle API
- ✅ **Offizielle MoneyMoney AppleScript API**
- ✅ **Keine speziellen Berechtigungen nötig**
- ✅ **Schneller und zuverlässiger**
- ✅ **Strukturierte XML Property List (plist)**
- ✅ **Umfassende Daten** (UUIDs, IDs, detaillierte Kategorien)

## 🔧 Technische Änderungen

### AppleScript
```applescript
tell application "MoneyMoney"
    export transactions from date "2025-01-01" as "plist"
end tell
```

### TypeScript
- Neue Dependency: `plist` für XML Property List Parsing
- Entfernt: `papaparse` (CSV Parser)
- Export-Format: `.plist` statt `.csv`
- Datenquelle: `data/transactions.plist`

### Datenstruktur
```typescript
{
  id: 42094,
  accountUuid: "2677e957-db8e-4246-87b3-7f30d92782e9",
  amount: -30.0,
  currency: "EUR",
  bookingDate: "2026-01-22T12:00:00Z",
  name: "Freako Detroit Dresden",
  purpose: "Freako Detroit Dresden Datum 16.01.2026 Zeit 17.48...",
  category: "Ausgaben\\Verbrauchsgüter\\Gastronomie",
  categoryUuid: "61ed7686-c89c-4ea1-ae35-eff036fdce2d",
  booked: false,
  checkmark: false
}
```

## 📊 Vergleich

| Feature | UI-Automation (alt) | AppleScript API (neu) |
|---------|-------------------|----------------------|
| Berechtigungen | UI-Automation erforderlich | Keine speziellen nötig |
| Geschwindigkeit | ~5-10 Sekunden | <1 Sekunde |
| Zuverlässigkeit | Anfällig für UI-Änderungen | Stabile API |
| Datenformat | CSV (parsing nötig) | Strukturierte plist |
| Transaktions-IDs | ❌ Nicht verfügbar | ✅ Vorhanden |
| UUIDs | ❌ Nicht verfügbar | ✅ Vorhanden |
| Kategorie-Details | ❌ Nur Name | ✅ Pfad + UUID |
| Setup | 3 Schritte | 1 Schritt |

## 🚀 Für Nutzer

**Was ändert sich?**
- ✅ **Einfacher**: Keine UI-Automation Berechtigungen mehr nötig
- ✅ **Schneller**: Export in <1 Sekunde statt 5-10 Sekunden
- ✅ **Zuverlässiger**: Nutzt offizielle, stabile API

**Was bleibt gleich?**
- ✅ Automatische Datenaktualisierung (stündlich)
- ✅ Keine manuelle Arbeit
- ✅ Gleiche MCP Tools (`get_accounts`, `get_transactions`, `analyze_spending`)
- ✅ MoneyMoney muss laufen

## 📚 Referenzen

- [MoneyMoney AppleScript Dokumentation](https://moneymoney.app/applescript/)
- [Apple plist Format](https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/PropertyLists/)

## ✅ Status

- [x] AppleScript mit offizieller API implementiert
- [x] plist Parser integriert
- [x] Alte CSV-Logik entfernt
- [x] Tests durchgeführt (funktioniert!)
- [x] README aktualisiert
- [x] Code committed & gepusht
- [x] Server läuft mit neuer API

**Commit**: `b0c26cb` - feat: migrate to official MoneyMoney AppleScript API
**Branch**: `main`
**Status**: ✅ Produktiv einsatzbereit
