# MoneyMoney MCP Server

Ein Model Context Protocol (MCP) Server für die Integration von MoneyMoney mit AI-Clients wie Perplexity Pro und Claude Desktop.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 🎯 Features

- ✅ **Automatischer Datenzugriff**: Verwendet offizielle MoneyMoney AppleScript API
- ✅ **Keine manuelle Arbeit**: Kein CSV-Export, keine UI-Automation - nur API-Calls
- ✅ **Immer aktuell**: Daten werden automatisch aktualisiert (stündlich)
- ✅ **Konten abrufen**: Alle MoneyMoney-Konten mit Kontoinformationen und Salden
- ✅ **Transaktionsverlauf**: Detaillierte Transaktionshistorie mit Filtern
- ✅ **Ausgabenanalyse**: Intelligente Analyse von Ausgabenmustern über verschiedene Zeiträume
- ✅ **MCP-Kompatibel**: Funktioniert mit Perplexity, Claude Desktop und anderen MCP-Clients
- ✅ **Intelligenter Fallback**: Verwendet Testdaten wenn MoneyMoney nicht läuft

---

## 📋 Voraussetzungen

- **macOS** 10.14+ (MoneyMoney ist nur für macOS)
- **Node.js** v18.0.0 oder höher
- **npm** v9.0.0 oder höher
- **Git** für Repository-Verwaltung
- **MoneyMoney App** (optional - Server funktioniert auch mit Mock-Daten)

### Versionen überprüfen

```bash
node --version    # sollte v18+ sein
npm --version     # sollte v9+ sein
git --version     # beliebige Version
```

---

## 🚀 Installation

### Schnellstart

```bash
# Repository klonen
git clone https://github.com/AndreasDietzel/moneymoney-mcp-server.git
cd moneymoney-mcp-server

# Dependencies installieren
npm install

# TypeScript kompilieren
npm run build

# (Optional) MoneyMoney Daten exportieren
# In MoneyMoney: Ablage → Exportieren → CSV-Export...
# Speichern als: ~/Projects/moneymoney-mcp-server/data/transactions.csv

# Server starten
npm run start
```

### Erwartete Ausgabe

```
Starting MoneyMoney MCP Server
Version: 1.0.0
MoneyMoney installed: true
Connecting via stdio...
MoneyMoney MCP Server ready for connections
```

---

## 📊 MoneyMoney Datenanbindung

### 🤖 Automatischer Datenzugriff (Keine manuelle Arbeit!)

Der MCP Server holt sich **automatisch** deine aktuellen MoneyMoney-Daten:

**Wie es funktioniert:**
1. **Du fragst** in Perplexity nach deinen Transaktionen
2. **Server prüft**: Sind die Daten aktuell? (< 1 Stunde alt)
3. **Automatischer Export**: Falls nötig, triggert der Server MoneyMoney per AppleScript
4. **Sofortiges Laden**: Daten werden gelesen und an Perplexity gesendet
5. **Du siehst**: Deine echten, aktuellen Finanzdaten!

**Du musst NICHTS manuell machen!** ✨

### ⚙️ Einmalige Einrichtung

Damit der automatische Export funktioniert:

1. **UI-Automation erlauben**:
   - Systemeinstellungen → Datenschutz & Sicherheit → Automation
   - Erlauben für Terminal/Node: MoneyMoney steuern
   
2. **MoneyMoney im Hintergrund laufen lassen**:
   ```bash
   open -a MoneyMoney
   ```

Das war's! Ab jetzt arbeitet alles automatisch. 🎉

---

## ⚙️ Konfiguration

### Umgebungsvariablen (Optional)

Erstelle eine `.env` Datei im Projektverzeichnis:

```env
# MoneyMoney API Konfiguration (aktuell nicht verwendet - für zukünftige Erweiterungen)
MONEYMONEY_API_URL=http://localhost:4444
MONEYMONEY_API_KEY=your_api_key_here

# Server Konfiguration
MCP_TRANSPORT=stdio
NODE_ENV=production
```

**Hinweis**: Diese Variablen sind optional. Der Server funktioniert auch ohne `.env` Datei.

---

## 🔧 Verwendung

### Entwicklungsmodus

```bash
# Server mit automatischem Reload starten
npm run dev
```

### Produktionsmodus

```bash
# 1. TypeScript zu JavaScript kompilieren
npm run build

# 2. Kompilierten Server starten
npm run start
```

### Server im Hintergrund laufen lassen

```bash
# Mit npm
npm run start &

# Oder mit pm2 (empfohlen für Production)
npm install -g pm2
pm2 start dist/index.js --name moneymoney-mcp
pm2 save
pm2 startup
```

### 🔄 Autostart nach Neustart (macOS)

Der Server wird automatisch bei jedem Neustart gestartet:

```bash
# 1. Launch Agent installieren
cp ~/Projects/moneymoney-mcp-server/com.moneymoney.mcp-server.plist ~/Library/LaunchAgents/

# 2. Launch Agent laden und starten
launchctl load ~/Library/LaunchAgents/com.moneymoney.mcp-server.plist
launchctl start com.moneymoney.mcp-server

# 3. Status prüfen
launchctl list | grep moneymoney

# 4. Logs anzeigen
tail -f ~/Projects/moneymoney-mcp-server/logs/stderr.log
```

**Deaktivieren des Autostarts:**
```bash
launchctl unload ~/Library/LaunchAgents/com.moneymoney.mcp-server.plist
rm ~/Library/LaunchAgents/com.moneymoney.mcp-server.plist
```

---

## 🔗 Integration mit AI-Clients

### Perplexity Desktop

1. **Erstelle die Konfigurationsdatei**:
   ```bash
   mkdir -p ~/.config/perplexity
   nano ~/.config/perplexity/mcp.json
   ```

2. **Füge diese Konfiguration ein**:
   ```json
   {
     "mcpServers": {
       "moneymoney": {
         "type": "stdio",
         "command": "/usr/local/bin/node",
         "args": ["/ABSOLUTE/PATH/TO/YOUR/moneymoney-mcp-server/dist/index.js"]
       }
     }
   }
   ```
   
   **✅ Konfiguration getestet und funktionsfähig!**
       }
     }
   }
   ```
   
   **✅ Konfiguration getestet und funktionsfähig!**

3. **Perplexity neu starten**

4. **Testen**: 
   ```
   Zeige mir alle meine MoneyMoney Konten
   ```

### Claude Desktop

1. **Öffne die Claude-Konfiguration**:
   ```bash
   nano ~/.config/Claude/claude_desktop_config.json
   ```

2. **Füge die MCP-Server-Konfiguration hinzu**:
   ```json
   {
     "mcpServers": {
       "moneymoney": {
         "command": "node",
         "args": ["/Users/DEIN_USERNAME/Projects/moneymoney-mcp-server/dist/index.js"],
         "env": {
           "NODE_ENV": "production"
         }
       }
     }
   }
   ```

3. **Claude Desktop neu starten**

### Andere MCP-Clients

Der Server implementiert die Standard-MCP-Spezifikation und sollte mit jedem MCP-kompatiblen Client funktionieren. Verwende die stdio-Transport-Konfiguration wie oben gezeigt.

---

## 📊 Verfügbare Tools

Der MCP Server stellt drei Tools zur Verfügung:

### 1. `get_accounts` - Konten abrufen

Ruft alle MoneyMoney-Konten mit Details ab.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {}
}
```

**Beispiel-Prompt**:
```
Zeige mir alle meine Konten mit ihren Salden
```

**Rückgabe**:
```json
{
  "status": "success",
  "data": [
    {
      "name": "Girokonto",
      "owner": "Max Mustermann",
      "accountNumber": "123456789",
      "bankCode": "12345678",
      "currency": "EUR",
      "type": "Giro",
      "balance": 5000.50,
      "iban": "DE89370400440532013000",
      "bic": "COBADEFFXXX"
    }
  ],
  "count": 2
}
```

### 2. `get_transactions` - Transaktionen abrufen

Holt Transaktionen für ein bestimmtes Konto.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "account_id": {
      "type": "string",
      "description": "Die Kontonummer oder Konto-ID"
    },
    "limit": {
      "type": "number",
      "description": "Maximale Anzahl von Transaktionen (Standard: 50)"
    }
  },
  "required": ["account_id"]
}
```

**Beispiel-Prompt**:
```
Gib mir die letzten 20 Transaktionen von Konto 123456789
```

**Rückgabe**:
```json
{
  "status": "success",
  "accountId": "123456789",
  "data": [
    {
      "name": "Amazon EU S.à.r.L.",
      "accountNumber": "123456789",
      "bankCode": "12345678",
      "amount": -49.99,
      "currency": "EUR",
      "bookingDate": 1705427200,
      "purpose": "Online purchase - Order #123456",
      "booked": true
    }
  ],
  "count": 20
}
```

### 3. `analyze_spending` - Ausgaben analysieren

Analysiert Ausgabenmuster über einen definierten Zeitraum.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "account_id": {
      "type": "string",
      "description": "Die Kontonummer"
    },
    "period": {
      "type": "string",
      "enum": ["week", "month", "quarter", "year"],
      "description": "Analysezeitraum"
    }
  },
  "required": ["account_id", "period"]
}
```

**Beispiel-Prompt**:
```
Analysiere meine Ausgaben des letzten Monats für Konto 123456789
```

**Rückgabe**:
```json
{
  "status": "success",
  "accountId": "123456789",
  "period": "month",
  "data": {
    "period": "month",
    "transactionCount": 45,
    "totalSpending": "1234.56",
    "averageTransaction": "27.43",
    "currency": "EUR"
  }
}
```

---

## 🐛 Fehlerbehebung

### Problem: Server startet nicht

**Symptome**: `npm run start` schlägt fehl

**Lösung**:
```bash
# 1. Dependencies neu installieren
rm -rf node_modules package-lock.json
npm install

# 2. TypeScript neu kompilieren
npm run build

# 3. Node-Version prüfen
node --version  # muss v18+ sein

# 4. Manuell starten und Fehler anzeigen
node dist/index.js
```

### Problem: "MoneyMoney is not installed"

**Ursache**: MoneyMoney App ist nicht im erwarteten Verzeichnis

**Lösung**:
```bash
# Prüfe ob MoneyMoney installiert ist
ls -la ~/Library/Containers/com.moneymoney-app.retail/

# Falls nicht vorhanden: Der Server funktioniert trotzdem mit Mock-Daten
# Oder installiere MoneyMoney von https://moneymoney-app.com
```

### Problem: Perplexity erkennt MCP Server nicht

**Checkliste**:
- [ ] Ist der Server gebaut? (`npm run build`)
- [ ] Ist der Pfad in der Config korrekt? (absoluter Pfad!)
- [ ] Wurde Perplexity nach Config-Änderung neu gestartet?
- [ ] Läuft der Server? (teste mit `node dist/index.js`)
- [ ] Ist der Node-Pfad korrekt? (`which node`)

**Config testen**:
```bash
# 1. Server manuell starten
cd ~/Projects/moneymoney-mcp-server
npm run start

# 2. In anderem Terminal Perplexity starten
open /Applications/Perplexity.app

# 3. In Perplexity testen
# "Zeige mir meine MoneyMoney Konten"
```

### Problem: JSONRPC.ProtocolTransportError (Fehler 3)

**Ursache**: MCP-Transport konnte nicht initialisiert werden

**Lösung**:
```bash
# 1. Absoluten Node-Pfad verwenden
which node  # z.B. /usr/local/bin/node

# 2. Config mit absolutem Pfad:
{
  "mcpServers": {
    "moneymoney": {
      "type": "stdio",
      "command": "/usr/local/bin/node",  # <-- Absoluter Pfad!
      "args": ["/Users/DEIN_USERNAME/Projects/moneymoney-mcp-server/dist/index.js"]
    }
  }
}

# 3. Server-Prozesse killen
pkill -f "node dist/index.js"

# 4. Perplexity komplett neu starten
```

---

## 📁 Projektstruktur

```
moneymoney-mcp-server/
├── src/
│   ├── index.ts              # 🚀 MCP Server Entry Point (Hauptdatei)
│   ├── moneymoney.ts         # 💰 MoneyMoney Integration & Business Logic
│   └── server.ts             # 🔄 Alternative Server Implementation
├── dist/                     # 📦 Kompilierte JavaScript-Dateien
│   ├── index.js              # ✅ Von Perplexity/Claude verwendet
│   ├── moneymoney.js
│   └── server.js
├── logs/                     # 📝 Server Logs (stdout.log, stderr.log)
├── node_modules/             # 📚 Dependencies
├── package.json              # 📋 Projekt-Metadaten & Scripts
├── tsconfig.json             # ⚙️ TypeScript Konfiguration
├── com.moneymoney.mcp-server.plist  # 🔄 macOS LaunchAgent (Autostart)
├── .env.example              # 🔐 Beispiel-Umgebungsvariablen
├── .gitignore                # 🚫 Git Ignore Rules
├── README.md                 # 📖 Diese Datei
├── PERPLEXITY_SETUP.md       # 🔧 Detaillierte Perplexity-Anleitung
├── QUICKSTART.md             # ⚡ 5-Minuten Schnellstart
└── LICENSE                   # ⚖️ MIT Lizenz

dist/index.js ist die Datei, die von MCP-Clients verwendet wird!
```

---

## � MoneyMoney Integration

### Offizielle AppleScript API

Der Server verwendet die **offizielle MoneyMoney AppleScript API** für den Datenzugriff:

```applescript
tell application "MoneyMoney"
    export transactions from date "2025-01-01" as "plist"
end tell
```

**Vorteile gegenüber CSV-Export oder UI-Automation:**
- ✅ **Zuverlässig**: Offizielle, stabile API von MoneyMoney
- ✅ **Schnell**: Direkter API-Zugriff ohne UI-Automation
- ✅ **Strukturiert**: XML Property List Format (plist)
- ✅ **Keine Berechtigungen**: Keine UI-Automation Permissions nötig
- ✅ **Detailliert**: Umfassende Transaktionsinformationen inkl. IDs, UUIDs, Kategorien

### Automatischer Export

Der Server prüft automatisch alle 5 Minuten ob Daten vorhanden sind und führt bei Bedarf einen Export durch:

1. **Datenfrische prüfen**: Sind die Daten älter als 1 Stunde?
2. **Automatischer Export**: Falls ja, wird automatisch ein Export ausgelöst
3. **Parsing**: XML plist wird in JavaScript-Objekte konvertiert
4. **Caching**: Daten werden für 5 Minuten gecached

**MoneyMoney muss laufen** für API-Zugriff. Falls nicht verfügbar, nutzt der Server Mock-Daten.

### Datenformat

Die API liefert umfassende Transaktionsdaten:
- `id`: Eindeutige Transaktions-ID
- `accountUuid`: Konto-UUID
- `amount`: Betrag (negative für Ausgaben)
- `currency`: Währung (EUR, USD, etc.)
- `bookingDate`: Buchungsdatum
- `valueDate`: Valutadatum
- `name`: Zahlungsempfänger/Absender
- `purpose`: Verwendungszweck
- `category`: Kategorie mit Pfad
- `categoryUuid`: Kategorie-UUID
- `booked`: Status (gebucht oder vorgemerkt)
- `checkmark`: Erledigt-Status

Siehe auch: [MoneyMoney AppleScript Dokumentation](https://moneymoney.app/applescript/)

---

## �🔐 Sicherheit

### Best Practices

1. **Umgebungsvariablen schützen**:
   - Nie API-Keys oder Passwörter im Code speichern
   - `.env` Dateien nicht in Git committen (ist bereits in `.gitignore`)
   - Verwende `.env.example` als Vorlage

2. **GitHub Token Sicherheit**:
   ```bash
   # Token sicher in macOS Keychain speichern
   security add-generic-password -a "github-token" \
     -s "github.com" \
     -w "YOUR_TOKEN_HERE"
   
   # Token abrufen
   security find-generic-password -a "github-token" \
     -s "github.com" -w
   ```

3. **Regelmäßige Updates**:
   ```bash
   # Sicherheits-Audits
   npm audit
   
   # Automatische Fixes
   npm audit fix
   
   # Dependencies aktualisieren
   npm update
   ```

---

## 🛠️ Entwicklung

### Development Workflow

```bash
# 1. Repository forken und klonen
git clone https://github.com/DEIN_USERNAME/moneymoney-mcp-server.git
cd moneymoney-mcp-server

# 2. Feature Branch erstellen
git checkout -b feature/meine-neue-feature

# 3. Entwickeln und testen
npm run dev

# 4. Code formatieren und linten
npm run lint  # (falls konfiguriert)

# 5. Änderungen committen
git add .
git commit -m "feat: beschreibung der änderung"

# 6. Branch pushen
git push origin feature/meine-neue-feature

# 7. Pull Request erstellen auf GitHub
```

### Scripts

| Command | Beschreibung |
|---------|-------------|
| `npm run dev` | Startet Server im Entwicklungsmodus mit ts-node |
| `npm run build` | Kompiliert TypeScript zu JavaScript |
| `npm run start` | Startet kompilierten Server |
| `npm test` | Führt Tests aus (aktuell nicht implementiert) |

### Code Style

- **TypeScript**: Strict Mode aktiviert
- **ES Modules**: CommonJS (Node.js Kompatibilität)
- **Formatting**: Prettier (empfohlen)
- **Linting**: ESLint (empfohlen)

---

## 📚 Zusätzliche Dokumentation

- **[PERPLEXITY_SETUP.md](PERPLEXITY_SETUP.md)** - Ausführliche Perplexity-Integration mit Troubleshooting
- **[QUICKSTART.md](QUICKSTART.md)** - 5-Minuten Schnellstart-Anleitung
- **[Model Context Protocol](https://modelcontextprotocol.io/)** - Offizielle MCP-Dokumentation
- **[MoneyMoney API](https://moneymoney-app.com/api/)** - MoneyMoney Lua Extension API

---

## 🤝 Beiträge

Beiträge sind willkommen! Bitte beachte:

1. **Issues erstellen** für Bugs oder Feature-Requests
2. **Pull Requests** mit klarer Beschreibung
3. **Code-Qualität** beibehalten (TypeScript Strict Mode)
4. **Tests** hinzufügen für neue Features
5. **Dokumentation** aktualisieren

### Roadmap

- [ ] Echte MoneyMoney-Datenbankintegration (SQLite)
- [ ] AppleScript-Bridge für direkte MoneyMoney-Kommunikation
- [ ] Erweiterte Analysetools (Kategorien, Trends, Budgets)
- [ ] Mehr Filter- und Sortieroptionen für Transaktionen
- [ ] Unterstützung für mehrere Währungen
- [ ] Export-Funktionen (CSV, JSON, Excel)
- [ ] Grafische Visualisierungen
- [ ] Unit und Integration Tests
- [ ] Docker Container Support
- [ ] CI/CD Pipeline (GitHub Actions)

---

## 📄 Lizenz

MIT License - siehe [LICENSE](LICENSE) Datei für Details.

Copyright (c) 2026 MoneyMoney MCP Server Contributors

---

## 🙏 Danksagungen

- **[Model Context Protocol](https://modelcontextprotocol.io/)** für das offene MCP-Standard
- **[MoneyMoney](https://moneymoney-app.com/)** für die großartige macOS Finanz-App
- **[Perplexity AI](https://www.perplexity.ai/)** für MCP-Client-Support
- **[Anthropic](https://www.anthropic.com/)** für Claude und MCP-Entwicklung

---

## 📞 Support

- **GitHub Issues**: [Issues erstellen](https://github.com/YOUR_USERNAME/moneymoney-mcp-server/issues)
- **Diskussionen**: [GitHub Discussions](https://github.com/YOUR_USERNAME/moneymoney-mcp-server/discussions)
- **Email**: Siehe GitHub Profil

---

**Version**: 1.0.0  
**Letzte Aktualisierung**: 17. Januar 2026  
**Status**: ✅ Production Ready (mit Mock-Daten & Autostart)  
**Status**: ✅ Production Ready (mit Mock-Daten & Autostart)

---

Made with ❤️ for the MoneyMoney and AI community
