# 🚀 Quickstart: MoneyMoney Connector in Perplexity

Folge diesen 5 Schritten, um deine MoneyMoney Daten in Perplexity zu nutzen:

---

## 1️⃣ Projekt vorbereiten

```bash
cd ~/Projects/moneymoney-mcp-server
npm install
npm run build
```

---

## 2️⃣ Server starten

Öffne ein **neues Terminal** und starte den Server (läuft im Hintergrund):

```bash
cd ~/Projects/moneymoney-mcp-server
npm run start
```

Du solltest sehen:
```
MoneyMoney MCP Server ready for connections
```

Lasse dieses Terminal **offen und laufen**!

---

## 3️⃣ Perplexity konfigurieren

Öffne ein **anderes Terminal** und erstelle die Config-Datei:

```bash
nano ~/.config/perplexity/mcp.json
```

Füge folgendes ein:

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

Speichern: `Ctrl+X` → `Y` → `Enter`

---

## 4️⃣ Perplexity neu starten

Beende Perplexity komplett und starte es neu:

```bash
killall Perplexity || true
open /Applications/Perplexity.app
```

---

## 5️⃣ Teste die Integration!

Schreib in Perplexity:

```
Zeige mir alle meine MoneyMoney Konten
```

**Falls es funktioniert:** 🎉 Du siehst deine Kontoinformationen!

---

## 📝 Was du jetzt tun kannst

Mit deinen 3 neuen Tools in Perplexity:

| Tool | Beispiel |
|------|----------|
| **get_accounts** | "Zeige mir alle meine Konten und deren Guthaben" |
| **get_transactions** | "Gib mir die letzten 20 Transaktionen von meinem Girokonto" |
| **analyze_spending** | "Analysiere meine Ausgaben des letzten Monats" |

---

## 🆘 Hilfe?

**Server läuft nicht?**
```bash
cd ~/Projects/moneymoney-mcp-server
node dist/index.js
# Sollte "ready for connections" zeigen
```

**Perplexity erkennt die Tools nicht?**
- ✅ Läuft der Server noch im anderen Terminal?
- ✅ Wurde Perplexity nach der Config-Änderung neu gestartet?
- ✅ Ist der Dateipfad korrekt in der Config?

Mehr Hilfe: Siehe [PERPLEXITY_SETUP.md](PERPLEXITY_SETUP.md)

---

**Viel Spaß mit deinen MoneyMoney-Daten in Perplexity! 💰✨**
