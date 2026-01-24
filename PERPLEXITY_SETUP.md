# Perplexity MCP Integration Guide

**Dein MoneyMoney MCP Server ist ein Connector für Perplexity!** Der Server stellt die Tools via Model Context Protocol (MCP) zur Verfügung, die Perplexity als "Connectors" einbindet.

---

## Schritt 1: Server starten

Starten Sie den MoneyMoney MCP Server auf Ihrem Mac:

```bash
cd ~/Projects/moneymoney-mcp-server
npm run build    # Kompiliere TypeScript
npm run start    # Starte den Server
```

**Erwartete Ausgabe:**
```
MoneyMoney MCP Server ready for connections
```

Der Server läuft dann auf `stdio` (Standard Input/Output) und wartet auf Verbindungen von Perplexity.

---

## Schritt 2: Perplexity konfigurieren

### Für Perplexity Desktop (empfohlen):

1. **Öffne die Konfigurationsdatei:**
   ```bash
   nano ~/.config/perplexity/mcp.json
   ```

2. **Füge folgende Konfiguration ein (oder erstelle die Datei):**
   ```json
   {
     "mcpServers": {
       "moneymoney": {
         "command": "node",
         "args": ["/ABSOLUTE/PATH/TO/YOUR/moneymoney-mcp-server/dist/index.js"]
       }
     }
   }
   ```

3. **Speichern** (Ctrl+X, dann Y, dann Enter)

4. **Starten Sie Perplexity neu** - der Connector sollte dann verfügbar sein

### Für Claude Desktop (Alternative):

```bash
nano ~/.config/Claude/claude_desktop_config.json
```

```json
{
  "mcpServers": {
    "moneymoney": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/YOUR/moneymoney-mcp-server/dist/index.js"]
    }
  }
}
```

---

## Schritt 3: Nutze die Connector Tools in Perplexity

Sobald der Server läuft und Perplexity konfiguriert ist, stehen dir automatisch diese 3 Tools zur Verfügung:

### 🏦 Tool 1: `get_accounts` - Alle Konten abrufen
Zeigt alle deine MoneyMoney Konten mit Kontoinformationen und Saldo.

**Beispiel:**
```
Zeige mir alle meine MoneyMoney Konten und deren Guthaben
```

**Rückgabe:**
```json
{
  "status": "success",
  "accounts": [
    {
      "name": "Girokonto",
      "owner": "Dein Name",
      "accountNumber": "DE89370400440532013000",
      "currency": "EUR",
      "balance": 5000.50
    }
  ]
}
```

### 📊 Tool 2: `get_transactions` - Transaktionen abrufen
Ruft die letzten Transaktionen von einem spezifischen Konto ab.

**Parameter:**
- `account_id` (erforderlich): Kontoname oder ID
- `limit` (optional): Anzahl der Transaktionen (Standard: 50)

**Beispiel:**
```
Gib mir die letzten 20 Transaktionen von meinem Girokonto
```

### 💰 Tool 3: `analyze_spending` - Ausgabenanalyse
Analysiert deine Ausgabenmuster über einen Zeitraum.

**Parameter:**
- `account_id` (erforderlich): Kontoname
- `period` (erforderlich): `week` | `month` | `quarter` | `year`

**Beispiel:**
```
Analysiere meine Ausgaben des letzten Monats
```

---

---

## Fehlerbehebung

### ❌ Problem: "Server startet nicht"

```bash
# 1. Überprüfe ob alle Dependencies installiert sind
npm install

# 2. Überprüfe die TypeScript-Kompilation
npm run build

# 3. Starte den Server direkt
node dist/index.js
```

### ❌ Problem: "Perplexity erkennt den Connector nicht"

**Checklist:**
- [ ] Ist der Dateipfad korrekt? (`/ABSOLUTE/PATH/TO/YOUR/moneymoney-mcp-server/dist/index.js`)
- [ ] Wurde die Config-Datei richtig gespeichert?
- [ ] Wurde Perplexity nach der Konfiguration neu gestartet?
- [ ] Läuft der MCP Server gerade? (Test mit `npm run start` in separatem Terminal)
- [ ] Keine Typos in der Config-Datei?

```bash
# Teste den Server manuell:
cd ~/Projects/moneymoney-mcp-server
npm run build && npm run start
# Der Server sollte folgende Ausgabe zeigen:
# "MoneyMoney MCP Server ready for connections"
```

### ❌ Problem: "Tools werden in Perplexity nicht angezeigt"

1. Stelle sicher, dass der Server läuft:
   ```bash
   cd ~/Projects/moneymoney-mcp-server
   npm run start  # In eigenem Terminal laufen lassen
   ```

2. Starte Perplexity neu und überprüfe die verfügbaren Tools

3. Falls MoneyMoney nicht installiert ist:
   - Die Tools geben Mock-Daten zurück
   - Du kannst sie normal nutzen und testen

---

## 🏗️ Projektstruktur

```
moneymoney-mcp-server/
├── src/
│   ├── index.ts              → MCP Server Entry Point (verwendet von Perplexity)
│   ├── moneymoney.ts         → MoneyMoney Integration & Tools
│   └── server.ts             → Alternative Server Implementierung
├── dist/
│   ├── index.js              → ✅ Dies wird von Perplexity verwendet!
│   ├── moneymoney.js         → Kompilierte MoneyMoney Integration
│   └── server.js             → Alternative (nicht verwendet)
├── package.json              → Dependencies & Scripts
├── tsconfig.json             → TypeScript Konfiguration
├── README.md                 → Allgemeine Dokumentation
└── PERPLEXITY_SETUP.md       → Diese Datei
```

**Wichtig:** Perplexity nutzt `dist/index.js` - das ist der MCP Server mit den 3 Tools!

---

## Nächste Schritte

- [ ] Build erfolgreich mit `npm run build`
- [ ] Server startet mit `npm run start`
- [ ] Perplexity Config erstellt in `~/.config/perplexity/mcp.json`
- [ ] Perplexity neugestartet
- [ ] MoneyMoney Connector ist in Perplexity sichtbar
- [ ] Test-Anfrage an Perplexity gesendet (z.B. "Zeige meine Konten")
- [ ] Tools erfolgreich verwendet

---

## 📚 Was ist MCP?

**Model Context Protocol (MCP)** ist ein Standard, der AI-Assistenten mit externen Tools und Datenquellen verbindet:

- ✅ Dein Server = ein MCP-Server mit 3 Tools
- ✅ Perplexity = ein MCP-Client, der deine Tools nutzt
- ✅ Kommunikation = über stdio (Standard Input/Output)
- ✅ Tools = get_accounts, get_transactions, analyze_spending

**Mehr Info:** https://modelcontextprotocol.io/
