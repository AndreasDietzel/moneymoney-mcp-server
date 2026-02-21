# 🔐 Security & Privacy Guidelines

## ✅ Was ist geschützt

### Automatisch ignoriert (`.gitignore`):
- ✅ **Account-Mappings** (`account-mappings.json`) - Enthält UUIDs und IBANs
- ✅ **Transaktionsdaten** (`data/transactions.csv`, `data/accounts.json`)
- ✅ **Persönliche Configs** (`perplexity-config.json`, `*-config.json`)
- ✅ **Environment-Variablen** (`.env`, `.env.local`)
- ✅ **Test-Dateien mit Daten** (`test-*.js`, `analyze-*.js`, `*.txt`)
- ✅ **Build-Outputs** (`dist/`, `node_modules/`)

## 📋 Setup für neue User

### 1. Clone Repository
```bash
git clone https://github.com/YOUR_USERNAME/moneymoney-mcp-server.git
cd moneymoney-mcp-server
```

### 2. Erstelle persönliche Config-Dateien
```bash
# Kopiere Beispiel-Dateien
cp account-mappings.example.json account-mappings.json
cp perplexity-config.example.json perplexity-config.json

# Bearbeite mit deinen Daten
nano account-mappings.json  # Deine Account-UUIDs und Namen
nano perplexity-config.json # Dein absoluter Pfad
```

### 3. Diese Dateien bleiben IMMER lokal
- ❌ NIEMALS committen: `account-mappings.json`
- ❌ NIEMALS committen: `perplexity-config.json`
- ❌ NIEMALS committen: `data/transactions.csv`
- ❌ NIEMALS committen: `data/accounts.json`

## 🛡️ Sicherheits-Check vor jedem Push

```bash
# Prüfe Status
git status

# Stelle sicher, dass keine sensiblen Dateien dabei sind
git diff --cached --name-only | grep -E "(account-mappings\.json|perplexity-config\.json|data/.*\.(csv|json|plist)|\.env$)"

# Wenn etwas gefunden wird: NICHT PUSHEN!
```

## ⚠️ Falls du versehentlich sensible Daten committed hast

```bash
# 1. Sofort aus Git entfernen (vor dem Push!)
git reset HEAD~1
git add .gitignore  # nur .gitignore wieder stagen

# 2. Falls bereits gepusht:
# Repository-Admin kontaktieren oder
# Neues Repo mit sauberem Start erstellen
```

## 🔍 Anonymität sicherstellen

### Persönliche Daten vermeiden in:
- ❌ Commit-Messages (keine echten Kontonummern, Namen, Beträge)
- ❌ Code-Kommentaren
- ❌ Dokumentation (nutze Platzhalter wie `/ABSOLUTE/PATH/TO/YOUR/`)
- ❌ Issue/PR-Beschreibungen

### Beispiel-Daten verwenden:
- ✅ `data/transactions-example.csv` - Anonymisierte Demo-Daten
- ✅ `account-mappings.example.json` - Template ohne echte Daten

## 📖 Für Contributor

Wenn du das Projekt teilst oder Beiträge leistest:

1. **Nutze Beispiel-Daten** in Screenshots/Demos
2. **Ersetze Pfade** durch Platzhalter
3. **Keine echten IBANs/Account-IDs** in Issues/PRs
4. **Teste mit Mock-Daten** statt echten Finanzdaten

## ✅ Security Scan durchgeführt

- ✅ Git-History bereinigt (Force-Push am 24.01.2026)
- ✅ Alle persönlichen Pfade anonymisiert
- ✅ `.gitignore` erweitert
- ✅ Example-Configs erstellt
- ✅ Dokumentation aktualisiert

---

**Letzte Aktualisierung:** 24. Januar 2026
**Status:** ✅ Beide Repos (moneymoney-mcp-server, briefing) sind sauber und anonym
