```
  ███╗   ███╗ ██████╗ ███╗   ██╗███████╗██╗   ██╗███╗   ███╗ ██████╗ ███╗   ██╗███████╗██╗   ██╗
  ████╗ ████║██╔═══██╗████╗  ██║██╔════╝╚██╗ ██╔╝████╗ ████║██╔═══██╗████╗  ██║██╔════╝╚██╗ ██╔╝
  ██╔████╔██║██║   ██║██╔██╗ ██║█████╗   ╚████╔╝ ██╔████╔██║██║   ██║██╔██╗ ██║█████╗   ╚████╔╝
  ██║╚██╔╝██║██║   ██║██║╚██╗██║██╔══╝    ╚██╔╝  ██║╚██╔╝██║██║   ██║██║╚██╗██║██╔══╝    ╚██╔╝
  ██║ ╚═╝ ██║╚██████╔╝██║ ╚████║███████╗   ██║   ██║ ╚═╝ ██║╚██████╔╝██║ ╚████║███████╗   ██║
  ╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝   ╚═╝   ╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝   ╚═╝
                      MCP SERVER • YOUR AI-POWERED FINANCIAL COMPANION
```

# MoneyMoney MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that connects [MoneyMoney](https://moneymoney-app.com/) — the popular macOS personal finance app — with AI assistants like **Perplexity Pro**, **Claude Desktop**, and any other MCP-compatible client.

Ask your AI assistant questions about your finances in natural language and get real answers backed by your actual banking data.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-1.0-purple)](https://modelcontextprotocol.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Features

- **Automatic Data Access** — Uses the official MoneyMoney AppleScript API to export data as XML Property List (plist)
- **Zero Manual Work** — No CSV exports, no UI automation; the server auto-exports when data is stale (> 1 hour)
- **5 MCP Tools** — Accounts, transactions, spending analysis, category breakdown, and server status
- **Multi-Year Comparison** — Compare income, expenses, and savings rate across multiple years
- **Hierarchical Categories** — Full category tree with spending totals (e.g. `Expenses > Consumables > Dining`)
- **Account Mappings** — Map account UUIDs to friendly names via a local config file
- **Smart Fallback** — Uses realistic mock data in development mode if MoneyMoney isn't running
- **Production Mode** — Strict mode that requires real data (no mock fallback)
- **Autostart** — Includes a macOS LaunchAgent for automatic startup on reboot

---

## Prerequisites

- **macOS** 10.14 or later (MoneyMoney is macOS-only)
- **Node.js** v18.0.0+ and **npm** v9.0.0+
- **MoneyMoney** app (optional — server works with mock data in dev mode)

```bash
node --version    # v18+
npm --version     # v9+
```

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/AndreasDietzel/moneymoney-mcp-server.git
cd moneymoney-mcp-server
npm install

# Build and run
npm run build
npm run start
```

Expected output:

```
Starting MoneyMoney MCP Server
Version: 1.0.0
Connecting via stdio...
MoneyMoney MCP Server ready for connections
```

---

## How It Works

```
┌──────────────┐     MCP (stdio)     ┌───────────────────┐     AppleScript     ┌──────────────┐
│  AI Client   │ ◄──────────────────► │  MCP Server       │ ◄────────────────►  │  MoneyMoney  │
│  (Perplexity │     JSON-RPC         │  (Node.js)        │     plist export    │  (macOS App) │
│   / Claude)  │                      │                   │                     │              │
└──────────────┘                      └───────────────────┘                     └──────────────┘
```

1. You ask your AI assistant a question about your finances
2. The AI client calls one of the 5 MCP tools
3. The server checks if exported data is fresh (< 1 hour old)
4. If stale, it triggers MoneyMoney's AppleScript API to re-export as plist
5. Data is parsed, formatted, and returned to the AI client
6. You see your real, up-to-date financial data

**No manual exports needed.** MoneyMoney just needs to be running in the background.

---

## One-Time Setup

For automatic AppleScript exports to work:

1. **Grant Automation Permission**:
   - System Settings → Privacy & Security → Automation
   - Allow Terminal / Node.js to control MoneyMoney

2. **Keep MoneyMoney running**:
   ```bash
   open -a MoneyMoney
   ```

3. **(Optional) Set up Account Mappings** — see [Account Mappings](#account-mappings)

---

## AI Client Integration

### Perplexity Desktop

```bash
mkdir -p ~/.config/perplexity
nano ~/.config/perplexity/mcp.json
```

```json
{
  "mcpServers": {
    "moneymoney": {
      "type": "stdio",
      "command": "/usr/local/bin/node",
      "args": ["/ABSOLUTE/PATH/TO/moneymoney-mcp-server/dist/index.js"]
    }
  }
}
```

Restart Perplexity after saving. Use `which node` to find your absolute Node.js path.

### Claude Desktop

```bash
nano ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

```json
{
  "mcpServers": {
    "moneymoney": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/moneymoney-mcp-server/dist/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

Restart Claude Desktop after saving.

### Other MCP Clients

The server uses the standard MCP stdio transport and works with any MCP-compatible client.

---

## Available Tools

The server exposes **14 tools** via the Model Context Protocol:

### 1. `get_status`

Returns server status, data loading state, and data freshness.

| Parameter | Type | Description |
|-----------|------|-------------|
| *(none)* | — | No parameters required |

**Example prompt**: `What's the status of my MoneyMoney connection?`

**Response**:
```json
{
  "status": "✅ Data loaded and available",
  "isLoading": false,
  "hasData": true,
  "dataAge": 1800000,
  "ageMessage": "Last updated 30 minutes ago",
  "mode": "production"
}
```

---

### 2. `get_accounts`

Fetches all MoneyMoney accounts with names, types, and balances.

| Parameter | Type | Description |
|-----------|------|-------------|
| *(none)* | — | No parameters required |

**Example prompt**: `Show me all my accounts and their balances`

**Response**:
```json
{
  "status": "success",
  "data": [
    {
      "id": "2677e957-...",
      "name": "Checking Account",
      "type": "Checking",
      "balance": 5234.50,
      "currency": "EUR"
    }
  ],
  "count": 3
}
```

---

### 3. `get_transactions`

Fetches transactions, optionally filtered by account and/or year.

| Parameter | Type | Description |
|-----------|------|-------------|
| `account_id` | string | *(optional)* Filter by account UUID |
| `limit` | number | *(optional)* Max transactions to return (default: all) |
| `year` | number | *(optional)* Filter by year, e.g. `2025` |

**Example prompt**: `Show me all transactions from 2025`

**Response**:
```json
{
  "status": "success",
  "accountId": "all",
  "year": 2025,
  "filteredCount": 842,
  "returnedCount": 842,
  "data": [
    {
      "id": "tx-12345",
      "accountId": "2677e957-...",
      "date": "2025-06-15",
      "description": "REWE Supermarket",
      "amount": -45.99,
      "currency": "EUR",
      "category": "Groceries",
      "categoryPath": ["Expenses", "Consumables", "Groceries"],
      "payee": "REWE",
      "booked": true
    }
  ]
}
```

---

### 4. `analyze_spending`

Analyzes spending patterns. Supports two modes:

**Mode A — Period-based analysis** (requires `account_id` + `period`):

| Parameter | Type | Description |
|-----------|------|-------------|
| `account_id` | string | Account UUID to analyze |
| `period` | string | `week`, `month`, `quarter`, or `year` |

**Example prompt**: `Analyze my spending from the checking account for the last month`

**Mode B — Multi-year comparison** (requires `start_year` and/or `end_year`):

| Parameter | Type | Description |
|-----------|------|-------------|
| `start_year` | number | Start year (e.g. `2020`) |
| `end_year` | number | End year (e.g. `2025`) |

**Example prompt**: `Compare my income and expenses from 2022 to 2025`

**Response** (multi-year):
```json
{
  "status": "success",
  "mode": "year-comparison",
  "data": {
    "2024": {
      "income": { "Salary": 42000 },
      "expenses": { "Rent": 12000, "Groceries": 4800 },
      "totalIncome": 42000,
      "totalExpenses": 16800,
      "netSavings": 25200,
      "savingsRate": 60.0
    }
  }
}
```

---

### 5. `get_categories`

Returns the hierarchical category tree with spending totals.

| Parameter | Type | Description |
|-----------|------|-------------|
| `account_id` | string | *(optional)* Filter by account UUID |
| `include_income` | boolean | *(optional)* Include income categories (default: `false`) |

**Example prompt**: `Show me my expense categories with totals`

**Response**:
```json
{
  "status": "success",
  "categories": [
    {
      "name": "Expenses",
      "path": "Expenses",
      "total": 18500.00,
      "count": 620,
      "children": [
        {
          "name": "Consumables",
          "path": "Expenses > Consumables",
          "total": 6200.00,
          "count": 310,
          "children": [
            { "name": "Groceries", "path": "Expenses > Consumables > Groceries", "total": 4800.00, "count": 240 },
            { "name": "Dining", "path": "Expenses > Consumables > Dining", "total": 1400.00, "count": 70 }
          ]
        }
      ]
    }
  ]
}
```

---

### 6. `list_statements`

Lists bank statement PDFs from MoneyMoney's on-disk statement archive
(`~/Library/Containers/com.moneymoney-app.retail/.../MoneyMoney/Statements/`).

Read-only and filesystem-only — this tool needs neither AppleScript nor a running
MoneyMoney instance.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `bank` | string | Optional: case-insensitive substring of the bank name, e.g. `"ING"` |
| `account` | string | Optional: IBAN, account number, digit fragment, or `"Bank/Prefix"` |
| `since` | string | Optional: only statements dated on/after this ISO date (`YYYY-MM-DD`) |
| `until` | string | Optional: only statements dated on/before this ISO date (`YYYY-MM-DD`) |
| `limit` | number | Optional: maximum number of statements to return |

**Response:**

```json
{
  "root": "/Users/you/Library/Containers/com.moneymoney-app.retail/.../Statements",
  "total": 1950,
  "returned": 2,
  "undatedExcluded": 0,
  "statements": [
    {
      "bank": "DKB",
      "filename": "Kontoauszug_7_2026_vom_05.08.2026_zu_Konto_9876543210.pdf",
      "path": "/Users/you/Library/Containers/.../Statements/DKB/Kontoauszug_7_2026_vom_05.08.2026_zu_Konto_9876543210.pdf",
      "date": "2026-08-05",
      "accountHint": "9876543210",
      "size": 48213
    }
  ]
}
```

Statement dates are derived from the file name in the four formats German banks
use: `YYYY-MM-DD`, `YYYY_MM_DD`, `DD.MM.YYYY` and `YYYYMMDD`. Account and
reference numbers are never mistaken for dates. When a date filter is active,
`undatedExcluded` reports how many statements were skipped because no date could
be derived, so a filtered result is never silently incomplete.

> **Note:** file names rarely answer the user's question on their own. Pass the
> returned `path` to a PDF reader to see balances, bookings and fees.

---

### 7. `get_statement`

Resolves a single statement by its exact file name (as returned by
`list_statements`) and returns its absolute path.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `filename` | string | **Required.** Exact file name, e.g. `"Kontoauszug_1234567890_2020-05-30_0916.pdf"` |

Path separators and `..` segments are rejected, so the tool can only ever resolve
files inside the archive. If the same file name exists for several banks, the
error lists them and you can disambiguate with the `"Bank/Prefix"` form of
`list_statements`.

---

### 8. `create_batch_transfer`

Loads a SEPA XML batch file into MoneyMoney.

> **This tool drafts only.** MoneyMoney opens the batch for review and you must
> confirm it and enter a TAN. Neither the MCP server nor the assistant can send a
> payment on its own.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `xml_path` | string | **Required.** Path to the SEPA XML file (max 1024 characters, must end in `.xml`) |
| `direct_debit` | boolean | Optional: `true` for a `pain.008` direct-debit batch (default `false`, `pain.001` credit transfer) |

**Response:**

```json
{
  "success": true,
  "requiresConfirmation": true,
  "message": "MoneyMoney opened the transfer batch from \"/path/to/batch.xml\". Review it in MoneyMoney and confirm with your TAN — nothing has been sent yet."
}
```

Before MoneyMoney is involved at all, the file is checked: it must exist, be a
regular `.xml` file below 512 KB, and carry a `pain.001` or `pain.008` namespace.
The namespace must match the requested mode, so a direct-debit batch can never be
submitted as a credit transfer or vice versa.

> **Sandbox note:** MoneyMoney is a sandboxed app. If it cannot read the file, the
> tool reports this and you should move the XML somewhere MoneyMoney may access,
> or grant access once through MoneyMoney's own file dialog.

---

### 9. `get_portfolio`

Lists the securities held in a portfolio (Depot) account. Read-only.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `account_id` | string | **Required.** UUID, account number or account name of a portfolio account |

**Response:**

```json
{
  "account": "Example Depot",
  "holdingCount": 2,
  "totals": [
    { "currency": "EUR", "marketValue": 1005.00, "absoluteProfit": 205.00 },
    { "currency": "USD", "marketValue": 1000.00, "absoluteProfit": 50.00 }
  ],
  "holdings": [
    {
      "id": 1,
      "name": "Example World ETF",
      "isin": "DE0001234567",
      "type": "share",
      "market": "Tradegate",
      "quantity": 10,
      "price": 100.50,
      "currencyOfPrice": "EUR",
      "purchasePrice": 80.00,
      "amount": 1005.00,
      "currencyOfAmount": "EUR",
      "absoluteProfit": 205.00,
      "relativeProfit": 0.2562,
      "tradeTimestamp": "2026-08-27T16:30:00.000Z"
    }
  ]
}
```

Totals are grouped by the currency a position is valued in — values in different
currencies are never summed together, and a profit reported in a different
currency than the position is left out of that currency's total. Optional fields
vary between MoneyMoney versions and are simply omitted when absent.

Passing a non-portfolio account returns a clear error pointing at `get_accounts`.

---

## Account Mappings

By default, accounts are identified by their UUID. To assign friendly names:

1. Copy the example config:
   ```bash
   cp account-mappings.example.json account-mappings.json
   ```

2. Add your account UUIDs and names:
   ```json
   {
     "accountMappings": {
       "2677e957-abcd-...": { "name": "Checking Account", "type": "Checking" },
       "8fa2c1b3-efgh-...": { "name": "Savings Account", "type": "Savings" }
     }
   }
   ```

Supported types: `Checking`, `Savings`, `CreditCard`, `Investment`, `Loan`

> **Privacy**: `account-mappings.json` is in `.gitignore` and never committed to Git.

See [ACCOUNT_MAPPINGS.md](ACCOUNT_MAPPINGS.md) for details.

---

## Configuration

### Environment Variables (Optional)

Create a `.env` file in the project root:

```env
# Set to "production" to disable mock data fallback
NODE_ENV=production
```

The server works without any `.env` file. In production mode, it will throw errors instead of falling back to mock data when MoneyMoney is unavailable.

---

## Running the Server

### Development Mode

```bash
npm run dev       # Starts with ts-node (auto-compiles TypeScript)
```

### Production Mode

```bash
npm run build     # Compile TypeScript to JavaScript
npm run start     # Run compiled server
```

### Background / Daemon

```bash
# Simple background process
npm run start &

# Or with pm2 (recommended)
npm install -g pm2
pm2 start dist/index.js --name moneymoney-mcp
pm2 save
pm2 startup
```

### Autostart on Reboot (macOS LaunchAgent)

```bash
# Install
cp com.moneymoney.mcp-server.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.moneymoney.mcp-server.plist

# Check status
launchctl list | grep moneymoney

# View logs
tail -f logs/stderr.log

# Uninstall
launchctl unload ~/Library/LaunchAgents/com.moneymoney.mcp-server.plist
rm ~/Library/LaunchAgents/com.moneymoney.mcp-server.plist
```

---

## MoneyMoney AppleScript API

The server uses the **official MoneyMoney AppleScript API** to export transaction data:

```applescript
tell application "MoneyMoney"
    export transactions from date "2025-01-01" as "plist"
end tell
```

**Advantages over CSV export or UI automation:**

| | AppleScript API | CSV Export | UI Automation |
|---|---|---|---|
| Reliability | Official, stable API | Format may change | Fragile |
| Speed | Direct API call | Manual step | Slow |
| Data format | Structured plist/XML | Flat CSV | None |
| Permissions | Automation only | None | Accessibility |
| Detail level | IDs, UUIDs, categories | Limited | Limited |

### Data Fields

Each transaction includes:

| Field | Description |
|-------|-------------|
| `id` | Unique transaction ID |
| `accountUuid` | Account UUID |
| `amount` | Amount (negative = expense) |
| `currency` | Currency code (EUR, USD, ...) |
| `bookingDate` | Booking date |
| `valueDate` | Value date |
| `name` | Payee / payer |
| `purpose` | Payment reference |
| `category` | Category (leaf level) |
| `categoryPath` | Full hierarchy, e.g. `["Expenses", "Groceries"]` |
| `categoryUuid` | Category UUID |
| `booked` | Whether the transaction is posted |

See also: [MoneyMoney AppleScript Documentation](https://moneymoney-app.com/applescript/)

---

## Project Structure

```
moneymoney-mcp-server/
├── src/
│   ├── index.ts                 # MCP server entry point & tool definitions
│   ├── moneymoney.ts            # MoneyMoney service (API, parsing, analysis)
│   ├── statements.ts            # Bank statement archive index (filesystem-only)
│   └── moneymoney-old.ts        # Legacy implementation (reference only)
├── dist/                        # Compiled JavaScript (used by MCP clients)
├── scripts/
│   ├── auto-export.scpt         # AppleScript for automatic data export
│   ├── get-accounts.scpt        # AppleScript to fetch account list
│   ├── create-batch-transfer.applescript # Load a SEPA XML batch (drafts only)
│   ├── export-portfolio.applescript # Export Depot holdings as plist
│   ├── diagnose-accounts.scpt   # Account diagnostics
│   └── diagnose.applescript     # General diagnostics
├── data/
│   ├── transactions.plist       # Exported transaction data (auto-generated)
│   ├── accounts.json            # Account balances cache
│   ├── transactions.csv         # Legacy CSV data (optional)
│   └── transactions-example.csv # Example data for reference
├── logs/                        # Server logs (stdout.log, stderr.log)
├── account-mappings.json        # Your account name mappings (gitignored)
├── account-mappings.example.json# Template for account mappings
├── com.moneymoney.mcp-server.plist  # macOS LaunchAgent for autostart
├── moneymoney-export.lua        # MoneyMoney Lua export extension
├── tests/
│   ├── statements.test.js       # Statement archive tests (node --test)
│   ├── batch-transfer.test.js   # SEPA batch validation tests (node --test)
│   └── portfolio.test.js        # Portfolio parsing tests (node --test)
├── package.json                 # Project metadata & scripts
├── tsconfig.json                # TypeScript configuration
├── QUICKSTART.md                # 5-minute quick start guide
├── PERPLEXITY_SETUP.md          # Detailed Perplexity integration guide
├── ACCOUNT_MAPPINGS.md          # Account mapping documentation
├── MONEYMONEY_EXPORT.md         # Export documentation
├── SECURITY.md                  # Security & privacy guidelines
└── LICENSE                      # MIT License
```

---

## Troubleshooting

### Server won't start

```bash
rm -rf node_modules package-lock.json
npm install
npm run build
node dist/index.js    # Run directly to see errors
```

### Perplexity doesn't recognize the MCP server

1. Verify the server is built: `ls dist/index.js`
2. Use an **absolute path** in the config (run `which node` to find yours)
3. Restart Perplexity **completely** after changing the config
4. Test the server manually: `node dist/index.js`

### JSONRPC.ProtocolTransportError (Error 3)

Use the absolute Node.js path in your MCP config:

```bash
which node    # e.g. /usr/local/bin/node or /opt/homebrew/bin/node
```

### MoneyMoney data not loading

- Ensure MoneyMoney is running: `open -a MoneyMoney`
- Check automation permissions in System Settings
- View server logs: `tail -f logs/stderr.log`
- The server retries every 30 seconds and re-exports data older than 1 hour

---

## Security & Privacy

- **Financial data stays local** — All data remains on your machine. The MCP server only communicates via stdio with the local AI client.
- **Sensitive files are gitignored** — `account-mappings.json`, `data/*.csv`, `data/*.plist`, `data/accounts.json`, `.env`, and config files are excluded from Git.
- **Example files provided** — Use `account-mappings.example.json` and `perplexity-config.example.json` as templates.
- **No network requests** — The server makes no outbound HTTP calls. All data access is via local AppleScript.

See [SECURITY.md](SECURITY.md) for the full security policy.

---

## Development

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start server in development mode (ts-node) |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run start` | Start compiled production server |
| `npm test` | Build, then run the test suite |

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Develop and test: `npm run dev`
4. Commit changes: `git commit -m "feat: description"`
5. Push and create a Pull Request

### Roadmap

- [x] ~~AppleScript bridge for direct MoneyMoney communication~~
- [x] ~~Hierarchical category analysis~~
- [x] ~~Multi-year spending comparison~~
- [x] ~~Year-based transaction filtering~~
- [x] ~~Account mapping configuration~~
- [ ] Budget tracking and alerts
- [ ] Trend analysis and forecasting
- [ ] Multi-currency support
- [ ] Unit and integration tests
- [ ] CI/CD pipeline (GitHub Actions)

---

## Additional Documentation

- [QUICKSTART.md](QUICKSTART.md) — 5-minute quick start guide
- [PERPLEXITY_SETUP.md](PERPLEXITY_SETUP.md) — Detailed Perplexity integration guide
- [ACCOUNT_MAPPINGS.md](ACCOUNT_MAPPINGS.md) — Account mapping configuration
- [SECURITY.md](SECURITY.md) — Security & privacy guidelines
- [Model Context Protocol](https://modelcontextprotocol.io/) — Official MCP specification
- [MoneyMoney](https://moneymoney-app.com/) — MoneyMoney app & documentation

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Acknowledgements

- [Model Context Protocol](https://modelcontextprotocol.io/) — The open MCP standard by Anthropic
- [MoneyMoney](https://moneymoney-app.com/) — Excellent macOS personal finance app
- [Perplexity AI](https://www.perplexity.ai/) — MCP client support
- [Anthropic](https://www.anthropic.com/) — Claude and MCP development
- [lukasmalkmus/moneymoney](https://github.com/lukasmalkmus/moneymoney) (MIT) — where the idea of exposing MoneyMoney's statement archive, loading SEPA batches, and exposing Depot holdings over MCP came from

---

**Version**: 1.0.0 · **Last Updated**: February 2026 · **Status**: Production Ready

---

Made with ❤️ for the MoneyMoney and AI community
