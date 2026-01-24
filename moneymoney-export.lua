-- MoneyMoney Data Export Extension
-- Exports account and transaction data to JSON for MCP Server access
--
-- Installation: Place in ~/Library/Containers/com.moneymoney-app.retail/Data/Library/Application Support/MoneyMoney/Extensions/
-- 
-- This is a PROTOTYPE - MoneyMoney Extensions are designed for bank connections,
-- not data export. This may not work as intended.

WebBanking {
  version = 1.0,
  country = "de",
  description = "MCP Server Data Export",
  services = { "MCP Export" }
}

local exportPath = os.getenv("HOME") .. "/Projects/moneymoney-mcp-server/data/export.json"

function SupportsBank(protocol, bankCode)
  return protocol == "MCP Export"
end

function InitializeSession(protocol, bankCode, username, reserved, password)
  -- This would need to export data, but Extensions don't have direct DB access
  return "MoneyMoney Extensions cannot export internal data. Use CSV export instead."
end

function ListAccounts(knownAccounts)
  return {}
end

function RefreshAccount(account, since)
  return {}
end

function EndSession()
  -- Nothing to do
end
