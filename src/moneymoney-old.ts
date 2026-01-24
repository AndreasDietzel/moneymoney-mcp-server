/**
 * MoneyMoney API Integration
 * 
 * MoneyMoney uses an encrypted SQLite database for security.
 * This module reads CSV exports from MoneyMoney for real data access.
 * Falls back to mock data if CSV files are not available.
 */

import * as fs from "fs";
import * as path from "path";
import Papa from "papaparse";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface MoneyMoneyAccount {
  name: string;
  owner: string;
  accountNumber: string;
  bankCode: string;
  currency: string;
  type: "Giro" | "Savings" | "FixedTermDeposit" | "Loan" | "CreditCard" | "Portfolio" | "Other";
  balance?: number;
  iban?: string;
  bic?: string;
}

export interface MoneyMoneyTransaction {
  name: string;
  accountNumber: string;
  bankCode: string;
  amount: number;
  currency: string;
  bookingDate: number; // Unix timestamp
  purpose: string;
  booked: boolean;
}

export class MoneyMoneyIntegration {
  private extensionPath: string;
  private databasePath: string;
  private csvDataPath: string;
  private csvCache: {
    transactions: MoneyMoneyTransaction[];
    accounts: MoneyMoneyAccount[];
    lastLoaded: number;
  } | null = null;

  constructor() {
    // MoneyMoney stores extensions and data in user's Library
    const homeDir = process.env.HOME || "";
    this.extensionPath = path.join(
      homeDir,
      "Library/Containers/com.moneymoney-app.retail/Data/Library/Application Support/MoneyMoney/Extensions"
    );
    this.databasePath = path.join(
      homeDir,
      "Library/Containers/com.moneymoney-app.retail/Data/Library/Application Support/MoneyMoney"
    );
    this.csvDataPath = path.join(homeDir, "Projects/moneymoney-mcp-server/data");
  }

  /**
   * Check if MoneyMoney is installed
   */
  isMoneyMoneyInstalled(): boolean {
    return fs.existsSync(this.databasePath);
  }

  /**
   * Automatically trigger MoneyMoney export via AppleScript
   */
  private async triggerMoneyMoneyExport(): Promise<boolean> {
    try {
      console.error("🔄 Starting automatic MoneyMoney export...");
      
      const scriptPath = path.join(process.env.HOME || "", "Projects/moneymoney-mcp-server/scripts/auto-export.scpt");
      
      if (!fs.existsSync(scriptPath)) {
        console.error(`❌ AppleScript not found: ${scriptPath}`);
        return false;
      }

      const { stdout, stderr } = await execAsync(`osascript "${scriptPath}"`);
      
      if (stderr) {
        console.error("AppleScript stderr:", stderr);
      }
      
      if (stdout) {
        console.error("✅ Automatic export completed:", stdout.trim());
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("❌ Automatic export failed:", error);
      console.error("   MoneyMoney muss laufen und UI-Automation muss erlaubt sein");
      console.error("   Systemeinstellungen → Datenschutz → Automation");
      return false;
    }
  }

  /**
   * Load CSV exports from MoneyMoney
   * Automatically triggers export if file doesn't exist or is outdated
   */
  private async loadCSVData(): Promise<boolean> {
    try {
      const transactionsPath = path.join(this.csvDataPath, "transactions.csv");
      const accountsPath = path.join(this.csvDataPath, "accounts.csv");

      // Check if CSV needs refresh (missing or older than 1 hour)
      let needsExport = false;
      if (!fs.existsSync(transactionsPath)) {
        needsExport = true;
        console.error("⚠️  Transactions CSV not found - triggering automatic export");
      } else {
        const stats = fs.statSync(transactionsPath);
        const fileAge = Date.now() - stats.mtimeMs;
        if (fileAge > 60 * 60 * 1000) { // 1 hour
          needsExport = true;
          console.error("⚠️  Transactions CSV outdated - triggering automatic export");
        }
      }

      // Trigger automatic export if needed
      if (needsExport) {
        const exportSuccess = await this.triggerMoneyMoneyExport();
        if (!exportSuccess) {
          console.error("❌ Automatic export failed - falling back to mock data");
          return false;
        }
      }

      // Load transactions CSV
      const transactionsCSV = fs.readFileSync(transactionsPath, "utf-8");
      const transactionsParsed = Papa.parse<Record<string, string>>(transactionsCSV, {
        header: true,
        delimiter: ";",
        skipEmptyLines: true,
      });

      const transactions: MoneyMoneyTransaction[] = transactionsParsed.data.map((row) => {
        // Parse German date format (DD.MM.YYYY)
        const dateParts = (row.Datum || row.Date || "").split(".");
        const date = dateParts.length === 3 
          ? new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]))
          : new Date();

        // Parse German number format (comma as decimal separator)
        const amount = parseFloat((row.Betrag || row.Amount || "0").replace(",", "."));

        return {
          name: row.Name || row.Payee || "",
          accountNumber: row.Kontonummer || row["Account Number"] || "",
          bankCode: row.BLZ || row["Bank Code"] || "",
          amount,
          currency: row.Währung || row.Currency || "EUR",
          bookingDate: Math.floor(date.getTime() / 1000),
          purpose: row.Verwendungszweck || row.Purpose || "",
          booked: true,
        };
      });

      // Load accounts CSV (if exists)
      let accounts: MoneyMoneyAccount[] = [];
      if (fs.existsSync(accountsPath)) {
        const accountsCSV = fs.readFileSync(accountsPath, "utf-8");
        const accountsParsed = Papa.parse<Record<string, string>>(accountsCSV, {
          header: true,
          delimiter: ";",
          skipEmptyLines: true,
        });

        accounts = accountsParsed.data.map((row) => ({
          name: row.Name || row["Account Name"] || "",
          owner: row.Inhaber || row.Owner || "",
          accountNumber: row.Kontonummer || row["Account Number"] || "",
          bankCode: row.BLZ || row["Bank Code"] || "",
          currency: row.Währung || row.Currency || "EUR",
          type: (row.Typ || row.Type || "Other") as MoneyMoneyAccount["type"],
          balance: parseFloat((row.Saldo || row.Balance || "0").replace(",", ".")),
          iban: row.IBAN || "",
          bic: row.BIC || "",
        }));
      }

      // Cache the loaded data
      this.csvCache = {
        transactions,
        accounts,
        lastLoaded: Date.now(),
      };

      console.error(`✅ Loaded ${transactions.length} transactions from CSV`);
      if (accounts.length > 0) {
        console.error(`✅ Loaded ${accounts.length} accounts from CSV`);
      }

      return true;
    } catch (error) {
      console.error("Error loading CSV data:", error);
      return false;
    }
  }

  /**
   * Check if we should use CSV data (reloads if older than 5 minutes)
   */
  private async shouldUseCSVData(): Promise<boolean> {
    if (!this.csvCache) {
      return await this.loadCSVData();
    }

    // Reload if cache is older than 5 minutes
    const cacheAge = Date.now() - this.csvCache.lastLoaded;
    if (cacheAge > 5 * 60 * 1000) {
      return await this.loadCSVData();
    }

    return true;
  }

  /**
   * Read MoneyMoney extension directory
   */
  getAvailableExtensions(): string[] {
    if (!fs.existsSync(this.extensionPath)) {
      return [];
    }
    
    return fs.readdirSync(this.extensionPath).filter((file) => file.endsWith(".lua"));
  }

  /**
   * Parse MoneyMoney Lua script for WebBanking configuration
   */
  parseExtensionMetadata(scriptPath: string): Record<string, unknown> | null {
    try {
      const content = fs.readFileSync(scriptPath, "utf-8");
      const webBankingMatch = content.match(/WebBanking\s*\{([^}]+)\}/);
      
      if (!webBankingMatch) {
        return null;
      }

      // Parse simple key-value pairs from the Lua table
      const metadata: Record<string, unknown> = {};
      const pairs = webBankingMatch[1].match(/(\w+)\s*=\s*([^,}]+)/g);
      
      if (pairs) {
        pairs.forEach((pair) => {
          const [key, value] = pair.split("=").map((s) => s.trim());
          metadata[key] = value.replace(/['"]/g, "");
        });
      }

      return metadata;
    } catch {
      return null;
    }
  }

  /**
   * Get accounts from MoneyMoney
   * 
   * Automatically exports and loads from CSV if needed
   */
  async getAccounts(): Promise<MoneyMoneyAccount[]> {
    // Try to load from CSV first (with automatic export if needed)
    if (await this.shouldUseCSVData() && this.csvCache && this.csvCache.accounts.length > 0) {
      console.error(`✅ Using real account data from CSV (${this.csvCache.accounts.length} accounts)`);
      return this.csvCache.accounts;
    }

    // Fall back to mock data if no CSV available
    console.error("⚠️  Using mock account data - no CSV export found");
    console.error("   Export accounts from MoneyMoney to: ~/Projects/moneymoney-mcp-server/data/accounts.csv");
    
    return [
      {
        name: "Girokonto",
        owner: "Max Mustermann",
        accountNumber: "123456789",
        bankCode: "12345678",
        currency: "EUR",
        type: "Giro",
        balance: 5000.50,
        iban: "DE89370400440532013000",
        bic: "COBADEFFXXX",
      },
      {
        name: "Sparkonto",
        owner: "Max Mustermann",
        accountNumber: "987654321",
        bankCode: "12345678",
        currency: "EUR",
        type: "Savings",
        balance: 25000.00,
        iban: "DE89370400440532013001",
        bic: "COBADEFFXXX",
      },
    ];
  }

  /**
   * Get transactions for an account
   * 
   * Automatically exports and loads from CSV if needed
   */
  async getTransactions(accountId: string, limit: number = 50): Promise<MoneyMoneyTransaction[]> {
    // Try to load from CSV first (with automatic export if needed)
    if (await this.shouldUseCSVData() && this.csvCache && this.csvCache.transactions.length > 0) {
      console.error(`✅ Using real transaction data from CSV (${this.csvCache.transactions.length} total)`);
      
      // Filter by account if specified
      let filteredTransactions = this.csvCache.transactions;
      if (accountId && accountId !== "all") {
        filteredTransactions = filteredTransactions.filter(
          (t) => t.accountNumber === accountId || t.name.includes(accountId)
        );
      }
      
      return filteredTransactions.slice(0, limit);
    }

    // Fall back to mock data generation
    console.error("⚠️  Using generated mock transaction data - automatic export not available");
    return this.generateMockTransactions(accountId, limit);
  }

  /**
   * Generate realistic mock transactions for demonstration
   */
  private generateMockTransactions(_accountId: string, limit: number): MoneyMoneyTransaction[] {
    // Generate realistic mock transaction data spanning the last year
    const transactions: MoneyMoneyTransaction[] = [];
    const now = Math.floor(Date.now() / 1000);
    const oneDay = 86400;
    
    // Categories of transactions
    const expenses = [
      { name: "REWE Markt", amount: -45.80, purpose: "Lebensmittel" },
      { name: "Amazon EU S.à.r.L.", amount: -89.99, purpose: "Online Bestellung" },
      { name: "Deutsche Bahn", amount: -67.50, purpose: "Bahnticket München-Berlin" },
      { name: "Netflix", amount: -12.99, purpose: "Streaming Abo" },
      { name: "Spotify", amount: -9.99, purpose: "Musik Abo" },
      { name: "Telekom", amount: -49.95, purpose: "Mobilfunk" },
      { name: "E.ON Energie", amount: -89.00, purpose: "Stromabschlag" },
      { name: "Rossmann", amount: -23.45, purpose: "Drogerie" },
      { name: "ALDI SÜD", amount: -38.90, purpose: "Lebensmittel" },
      { name: "IKEA", amount: -156.30, purpose: "Möbel & Einrichtung" },
      { name: "Apple Services", amount: -2.99, purpose: "iCloud Storage" },
      { name: "Stadtwerke", amount: -45.00, purpose: "Wasserversorgung" },
      { name: "Shell Station", amount: -65.00, purpose: "Tanken" },
      { name: "H&M", amount: -79.90, purpose: "Kleidung" },
      { name: "MediaMarkt", amount: -199.00, purpose: "Elektronik" },
      { name: "DM Drogerie", amount: -31.20, purpose: "Körperpflege" },
      { name: "Burger King", amount: -12.50, purpose: "Fast Food" },
      { name: "Starbucks", amount: -7.80, purpose: "Kaffee" },
      { name: "Apotheke", amount: -24.90, purpose: "Medikamente" },
      { name: "Fitnessstudio", amount: -39.90, purpose: "Mitgliedsbeitrag" },
    ];
    
    const income = [
      { name: "Employer GmbH", amount: 3500.00, purpose: "Gehalt" },
      { name: "Finanzamt", amount: 450.00, purpose: "Steuererstattung" },
      { name: "PayPal", amount: 125.00, purpose: "Online Verkauf" },
    ];
    
    // Generate transactions for the last year
    for (let i = 0; i < Math.min(limit, 365); i++) {
      const daysAgo = Math.floor(Math.random() * 365);
      const bookingDate = now - (daysAgo * oneDay);
      
      // Income transactions (salary monthly, other occasionally)
      if (i % 30 === 0) {
        transactions.push({
          name: income[0].name,
          accountNumber: _accountId || "123456789",
          bankCode: "12345678",
          amount: income[0].amount,
          currency: "EUR",
          bookingDate,
          purpose: `${income[0].purpose} ${this.getMonthName(bookingDate)}`,
          booked: true,
        });
      }
      
      if (Math.random() < 0.05) {
        const incomeItem = income[Math.floor(Math.random() * income.length)];
        transactions.push({
          name: incomeItem.name,
          accountNumber: _accountId || "123456789",
          bankCode: "12345678",
          amount: incomeItem.amount,
          currency: "EUR",
          bookingDate,
          purpose: incomeItem.purpose,
          booked: true,
        });
      }
      
      // Expense transactions (daily with varying frequency)
      if (Math.random() < 0.7) {
        const expense = expenses[Math.floor(Math.random() * expenses.length)];
        const variation = 0.8 + Math.random() * 0.4; // ±20% variation
        transactions.push({
          name: expense.name,
          accountNumber: _accountId || "123456789",
          bankCode: "12345678",
          amount: parseFloat((expense.amount * variation).toFixed(2)),
          currency: "EUR",
          bookingDate,
          purpose: expense.purpose,
          booked: true,
        });
      }
    }
    
    // Sort by date descending (newest first)
    transactions.sort((a, b) => b.bookingDate - a.bookingDate);
    
    return transactions.slice(0, limit);
  }
  
  private getMonthName(timestamp: number): string {
    const months = ["Januar", "Februar", "März", "April", "Mai", "Juni", 
                    "Juli", "August", "September", "Oktober", "November", "Dezember"];
    const date = new Date(timestamp * 1000);
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  /**
   * Analyze spending patterns
   */
  async analyzeSpending(
    accountId: string,
    period: "week" | "month" | "quarter" | "year"
  ): Promise<Record<string, unknown>> {
    const transactions = await this.getTransactions(accountId, 200);
    
    const now = Math.floor(Date.now() / 1000);
    let periodStart = now;
    
    switch (period) {
      case "week":
        periodStart = now - 7 * 24 * 60 * 60;
        break;
      case "month":
        periodStart = now - 30 * 24 * 60 * 60;
        break;
      case "quarter":
        periodStart = now - 90 * 24 * 60 * 60;
        break;
      case "year":
        periodStart = now - 365 * 24 * 60 * 60;
        break;
    }

    const periodTransactions = transactions.filter(
      (t) => t.bookingDate >= periodStart && t.amount < 0
    );

    const totalSpending = Math.abs(
      periodTransactions.reduce((sum, t) => sum + t.amount, 0)
    );
    const averageTransaction =
      periodTransactions.length > 0
        ? totalSpending / periodTransactions.length
        : 0;

    return {
      period,
      transactionCount: periodTransactions.length,
      totalSpending: totalSpending.toFixed(2),
      averageTransaction: averageTransaction.toFixed(2),
      currency: "EUR",
    };
  }
}
