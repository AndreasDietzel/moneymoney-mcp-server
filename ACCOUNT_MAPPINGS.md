# Account Mappings Configuration

This file allows you to customize the display names and types of your MoneyMoney accounts.

## Setup

1. Copy the example file:
   ```bash
   cp account-mappings.example.json account-mappings.json
   ```

2. Find your account UUIDs:
   - The MCP server will show account UUIDs in the format `Konto 2677e957...`
   - Or run: `npm run find-accounts` (if available)
   - Or check the MoneyMoney export data

3. Edit `account-mappings.json` with your account information:
   ```json
   {
     "accountMappings": {
       "your-actual-uuid-here": {
         "name": "My Checking Account",
         "type": "Checking"
       },
       "another-uuid-here": {
         "name": "My Savings Account", 
         "type": "Savings"
       }
     }
   }
   ```

## Account Types

Supported account types:
- `Checking` - Checking/Current account (Girokonto)
- `Savings` - Savings account (Sparkonto/Tagesgeld)
- `CreditCard` - Credit card account
- `Investment` - Investment/Securities account
- `Loan` - Loan account

## Privacy Note

⚠️ **IMPORTANT**: The `account-mappings.json` file is automatically excluded from Git (via `.gitignore`) to protect your privacy. Your account UUIDs and account names remain local to your machine only.

## Example

```json
{
  "accountMappings": {
    "2677e957-db8e-4246-87b3-7f30d92782e9": {
      "name": "Main Checking Account",
      "type": "Checking"
    },
    "1fef82b5-9d10-4b3e-9e0e-407fc733bc11": {
      "name": "Emergency Savings",
      "type": "Savings"
    }
  }
}
```

## Without Configuration

If you don't create an `account-mappings.json` file, the server will work fine but will display generic names like `Konto 2677e957...` for your accounts.
