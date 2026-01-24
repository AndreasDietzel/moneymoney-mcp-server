# ⚠️ WICHTIG: Sensible Daten aus Git History entfernen

Die Datei `perplexity-config.json` mit persönlichen Pfaden wurde in 2 Commits (3c773c6, 4d90041) committed.

## Optionen zur Bereinigung:

### Option 1: Force Push mit neuer History (EMPFOHLEN)
```bash
# Backup erstellen
cd /Users/andreasdietzel/Projects/moneymoney-mcp-server
git tag backup-before-cleanup

# History neu schreiben (BFG Repo-Cleaner installieren)
brew install bfg
bfg --delete-files perplexity-config.json

# Force push
git push origin --force --all
```

### Option 2: Neues Repo mit sauberem Start
```bash
# Aktueller Stand als neuer Initial Commit
cd /Users/andreasdietzel/Projects/moneymoney-mcp-server
rm -rf .git
git init
git add -A
git commit -m "Initial commit: Clean start without sensitive data"
git branch -M main
git remote add origin https://github.com/AndreasDietzel/moneymoney-mcp-server.git
git push -u --force origin main
```

### Option 3: GitHub BFG Tool nutzen
1. Gehe zu https://github.com/AndreasDietzel/moneymoney-mcp-server/settings
2. Navigiere zu "Danger Zone" → "Delete this repository"
3. Erstelle neues Repo und pushe nur den aktuellen sauberen Stand

## Status:
- ✅ Lokale Dateien bereinigt
- ✅ .gitignore erweitert
- ✅ Dokumentation anonymisiert
- ⚠️ GitHub History enthält noch 2 Commits mit perplexity-config.json
