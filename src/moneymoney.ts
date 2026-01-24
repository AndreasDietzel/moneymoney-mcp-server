/**
 * MoneyMoney API Integration
 * 
 * Uses official MoneyMoney AppleScript API to export transactions as XML Property List.
 * Falls back to mock data if MoneyMoney is not available.
 */

import * as fs from "fs";
import * as path from "path";
import * as plist from "plist";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  categoryPath: string[];  // Hierarchical category path, e.g. ["Ausgaben", "Verbrauchsgüter", "Gastronomie"]
  categoryId?: number;
  categoryUuid?: string;
  payee: string;
  booked?: boolean;
  bookingText?: string;
}

interface AccountMapping {
  name: string;
  type: string;
}

interface AccountMappingsConfig {
  accountMappings: Record<string, AccountMapping>;
}

export class MoneyMoneyService {
  private plistPath = path.join(
    process.env.HOME || "",
    "Projects/moneymoney-mcp-server/data/transactions.plist"
  );
  private accountMappingsPath = path.join(
    process.env.HOME || "",
    "Projects/moneymoney-mcp-server/account-mappings.json"
  );
  private accountsJsonPath = path.join(
    process.env.HOME || "",
    "Projects/moneymoney-mcp-server/data/accounts.json"
  );
  private realTransactions: Transaction[] = [];
  private isLoading = false;
  private lastLoadAttempt = 0;
  private isProduction = process.env.NODE_ENV === "production";
  private accountMappings: Record<string, AccountMapping> = {};
  private realBalances: Record<string, number> = {};

  /**
   * Automatically trigger MoneyMoney export via AppleScript
   */
  private async triggerMoneyMoneyExport(): Promise<boolean> {
    try {
      console.error("🔄 Starting automatic MoneyMoney export via official API...");
      
      const scriptPath = path.join(
        process.env.HOME || "",
        "Projects/moneymoney-mcp-server/scripts/auto-export.scpt"
      );
      
      if (!fs.existsSync(scriptPath)) {
        console.error(`❌ AppleScript not found: ${scriptPath}`);
        return false;
      }

      const { stdout, stderr } = await execAsync(`osascript "${scriptPath}"`);
      
      if (stderr) {
        console.error("AppleScript stderr:", stderr);
      }
      
      if (stdout && stdout.includes("✅")) {
        console.error("✅ Automatic export completed:", stdout.trim());
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("❌ Automatic export failed:", error);
      console.error("   MoneyMoney must be running for API access");
      return false;
    }
  }

  /**
   * Load transaction data from MoneyMoney plist export
   */
  private async loadPlistData(): Promise<boolean> {
    try {
      // Prevent concurrent loads
      if (this.isLoading) {
        console.error("⏳ Data load already in progress, please wait...");
        return false;
      }

      // Don't retry too often (max once per 30 seconds)
      const now = Date.now();
      if (now - this.lastLoadAttempt < 30 * 1000 && this.realTransactions.length === 0) {
        console.error("⏳ Recent load attempt failed, please wait before retrying");
        return false;
      }

      this.isLoading = true;
      this.lastLoadAttempt = now;

      // Check if file exists and when it was last modified
      const stats = fs.existsSync(this.plistPath)
        ? fs.statSync(this.plistPath)
        : null;
      const fileAge = stats ? Date.now() - stats.mtimeMs : Infinity;
      const oneHour = 60 * 60 * 1000;

      // If file doesn't exist or is older than 1 hour, trigger automatic export
      const needsExport = !stats || fileAge > oneHour;

      if (needsExport) {
        console.error(
          "🔄 Plist data is stale or missing - triggering automatic export..."
        );
        const exportSuccess = await this.triggerMoneyMoneyExport();

        if (!exportSuccess) {
          const errorMsg = "❌ Automatic export failed";
          console.error(errorMsg);
          
          if (this.isProduction) {
            this.isLoading = false;
            throw new Error(
              "MoneyMoney export failed. Please ensure MoneyMoney is running and try again."
            );
          }
          
          console.error("⚠️ Development mode: falling back to mock data");
          this.isLoading = false;
          return false;
        }
      }

      // Read and parse plist file
      const plistContent = fs.readFileSync(this.plistPath, "utf-8");
      const data = plist.parse(plistContent) as any;

      if (!data || !data.transactions) {
        console.error("❌ Invalid plist format: no transactions found");
        return false;
      }

      // Transform plist data to Transaction format
      this.realTransactions = data.transactions
        .map((tx: any) => {
          if (!tx.bookingDate) return null;

          const date = tx.bookingDate instanceof Date
            ? tx.bookingDate
            : new Date(tx.bookingDate);

          // Parse hierarchical category (e.g. "Ausgaben\Verbrauchsgüter\Gastronomie")
          const categoryRaw = tx.category || "";
          const categoryPath = categoryRaw.split("\\").filter((c: string) => c.length > 0);
          const categoryDisplay = categoryPath.length > 0 
            ? categoryPath[categoryPath.length - 1]  // Use last level as display name
            : (tx.amount < 0 ? "Expenses" : "Income");

          return {
            id: tx.id ? `tx-${tx.id}` : `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            accountId: tx.accountUuid || tx.accountNumber || tx.accountId || "unknown",
            date: date.toISOString().split("T")[0],
            description: tx.purpose || tx.name || "Unknown",
            amount: tx.amount || 0,
            currency: tx.currency || "EUR",
            category: categoryDisplay,
            categoryPath: categoryPath,
            categoryId: tx.categoryId,
            categoryUuid: tx.categoryUuid,
            payee: tx.name || "Unknown",
            booked: tx.booked,
            bookingText: tx.bookingText,
          };
        })
        .filter((t: Transaction | null): t is Transaction => t !== null);

      console.error(
        `✅ Loaded ${this.realTransactions.length} real transactions from MoneyMoney API`
      );
      this.isLoading = false;
      return true;
    } catch (error) {
      this.isLoading = false;
      console.error("❌ Error loading plist data:", error);
      
      if (this.isProduction) {
        throw new Error(
          `Failed to load MoneyMoney data: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      
      return false;
    }
  }

  /**
   * Load account mappings from config file
   */
  private loadAccountMappings(): void {
    try {
      if (fs.existsSync(this.accountMappingsPath)) {
        const configContent = fs.readFileSync(this.accountMappingsPath, 'utf-8');
        const config: AccountMappingsConfig = JSON.parse(configContent);
        this.accountMappings = config.accountMappings || {};
        console.error(`✅ Loaded ${Object.keys(this.accountMappings).length} account mappings from config`);
      } else {
        console.error('⚠️ No account-mappings.json found - using generic account names');
        console.error(`   Create ${this.accountMappingsPath} to customize account names`);
      }
    } catch (error) {
      console.error('⚠️ Error loading account mappings:', error);
      console.error('   Using generic account names');
    }
  }

  /**
   * Load real account balances from accounts.json if available
   */
  private loadRealBalances(): void {
    try {
      if (fs.existsSync(this.accountsJsonPath)) {
        const accountsContent = fs.readFileSync(this.accountsJsonPath, 'utf-8');
        const accountsData = JSON.parse(accountsContent);
        
        for (const [uuid, data] of Object.entries(accountsData)) {
          if (typeof data === 'object' && data !== null && 'balance' in data) {
            this.realBalances[uuid] = (data as any).balance;
          }
        }
        
        console.error(`✅ Loaded real balances for ${Object.keys(this.realBalances).length} accounts`);
      }
    } catch (error) {
      console.error('⚠️ Could not load real balances from accounts.json');
    }
  }

  /**
   * Map account UUID to friendly name and type
   */
  private getAccountInfo(accountId: string): { name: string; type: string } {
    // Load mappings on first use
    if (Object.keys(this.accountMappings).length === 0 && fs.existsSync(this.accountMappingsPath)) {
      this.loadAccountMappings();
    }
    
    // Check if we have a mapping for this account
    if (this.accountMappings[accountId]) {
      return this.accountMappings[accountId];
    }
    
    // Fallback: use shortened UUID
    return { name: `Konto ${accountId.substring(0, 8)}...`, type: "Checking" };
  }

  /**
   * Get all accounts
   */
  async getAccounts(): Promise<Account[]> {
    // Try to load real data from plist (triggers export if needed)
    await this.loadPlistData();
    
    // Load account mappings and real balances
    if (Object.keys(this.accountMappings).length === 0) {
      this.loadAccountMappings();
    }
    if (Object.keys(this.realBalances).length === 0) {
      this.loadRealBalances();
    }

    if (this.realTransactions.length > 0) {
      // Extract unique accounts from real transactions
      const accountMap = new Map<string, Account>();

      for (const tx of this.realTransactions) {
        if (!accountMap.has(tx.accountId)) {
          const accountInfo = this.getAccountInfo(tx.accountId);
          accountMap.set(tx.accountId, {
            id: tx.accountId,
            name: accountInfo.name,
            type: accountInfo.type,
            balance: 0,
            currency: tx.currency,
          });
        }

        // Update balance (sum of transactions)
        const account = accountMap.get(tx.accountId)!;
        account.balance += tx.amount;
      }
      
      // Add accounts from mappings that don't have transactions
      for (const [uuid, mapping] of Object.entries(this.accountMappings)) {
        if (!accountMap.has(uuid)) {
          accountMap.set(uuid, {
            id: uuid,
            name: mapping.name,
            type: mapping.type,
            balance: 0,
            currency: "EUR",
          });
        }
      }
      
      // Replace calculated balances with real balances if available
      for (const account of accountMap.values()) {
        if (this.realBalances[account.id] !== undefined) {
          account.balance = this.realBalances[account.id];
        } else if (accountMap.size > 1) {
          // Only warn if we have multiple accounts (not a single fallback)
          console.error(`⚠️ Using calculated balance for ${account.name} (only transaction sum from export period)`);
        }
      }

      console.error(`✅ Using ${accountMap.size} real accounts from MoneyMoney API`);
      return Array.from(accountMap.values());
    }

    // Fallback to mock data only in development
    if (this.isProduction) {
      throw new Error(
        "No real MoneyMoney data available. Please ensure MoneyMoney is running and accessible."
      );
    }
    
    console.error("⚠️ Development mode: Using mock accounts");
    return this.getMockAccounts();
  }

  /**
   * Get transactions, optionally filtered by account
   */
  async getTransactions(accountId?: string): Promise<Transaction[]> {
    // Try to load real data from plist (triggers export if needed)
    await this.loadPlistData();

    if (this.realTransactions.length > 0) {
      console.error("✅ Using real transaction data from MoneyMoney API");
      return accountId
        ? this.realTransactions.filter((t) => t.accountId === accountId)
        : this.realTransactions;
    }

    // Fallback to mock data only in development
    if (this.isProduction) {
      throw new Error(
        "No real MoneyMoney data available. Please ensure MoneyMoney is running and accessible."
      );
    }
    
    console.error("⚠️ Development mode: Using mock transactions");
    return this.generateMockTransactions(accountId);
  }

  /**
   * Get loading status and data availability
   */
  getStatus(): { isLoading: boolean; hasData: boolean; dataAge: number | null; isProduction: boolean } {
    const stats = fs.existsSync(this.plistPath) ? fs.statSync(this.plistPath) : null;
    const dataAge = stats ? Date.now() - stats.mtimeMs : null;
    
    return {
      isLoading: this.isLoading,
      hasData: this.realTransactions.length > 0,
      dataAge,
      isProduction: this.isProduction
    };
  }

  /**
   * Get mock accounts for testing
   */
  private getMockAccounts(): Account[] {
    return [
      {
        id: "acc-1",
        name: "Girokonto",
        type: "Checking",
        balance: 3542.5,
        currency: "EUR",
      },
      {
        id: "acc-2",
        name: "Sparkonto",
        type: "Savings",
        balance: 15000.0,
        currency: "EUR",
      },
      {
        id: "acc-3",
        name: "Kreditkarte",
        type: "CreditCard",
        balance: -542.3,
        currency: "EUR",
      },
    ];
  }

  /**
   * Generate realistic mock transactions for testing (365 days)
   */
  private generateMockTransactions(accountId?: string): Transaction[] {
    const transactions: Transaction[] = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 365);

    const categories = [
      { name: "Groceries", payees: ["REWE", "Edeka", "Aldi", "Lidl", "Kaufland"], avgAmount: -45 },
      { name: "Restaurants", payees: ["Restaurant", "Café", "McDonald's", "Burger King"], avgAmount: -25 },
      { name: "Transportation", payees: ["DB", "Shell", "Tankstelle", "MVG"], avgAmount: -60 },
      { name: "Utilities", payees: ["Stadtwerke", "Telekom", "Vodafone"], avgAmount: -80 },
      { name: "Rent", payees: ["Vermieter"], avgAmount: -950 },
      { name: "Insurance", payees: ["Allianz", "HUK"], avgAmount: -120 },
      { name: "Shopping", payees: ["Amazon", "Zalando", "H&M", "MediaMarkt"], avgAmount: -85 },
      { name: "Entertainment", payees: ["Netflix", "Spotify", "Kino"], avgAmount: -15 },
      { name: "Healthcare", payees: ["Apotheke", "Arzt"], avgAmount: -40 },
      { name: "Salary", payees: ["Employer GmbH"], avgAmount: 3500 },
    ];

    const accountIds = accountId ? [accountId] : ["acc-1", "acc-2", "acc-3"];

    for (let i = 0; i < 365; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);

      // Generate 1-3 transactions per day
      const numTransactions = Math.floor(Math.random() * 3) + 1;

      for (let j = 0; j < numTransactions; j++) {
        const category = categories[Math.floor(Math.random() * categories.length)];
        const payee = category.payees[Math.floor(Math.random() * category.payees.length)];
        const variance = (Math.random() - 0.5) * 0.4; // ±20% variance
        const amount = Math.round((category.avgAmount * (1 + variance)) * 100) / 100;

        transactions.push({
          id: `mock-${i}-${j}`,
          accountId: accountIds[Math.floor(Math.random() * accountIds.length)],
          date: date.toISOString().split("T")[0],
          description: `${payee} - ${category.name}`,
          amount,
          currency: "EUR",
          category: category.name,
          categoryPath: amount < 0 ? ["Ausgaben", category.name] : ["Einnahmen", category.name],
          payee,
        });
      }
    }

    return transactions.sort((a, b) => b.date.localeCompare(a.date));
  }

  /**
   * Analyze spending by category
   */
  analyzeSpending(transactions: Transaction[]): Record<string, number> {
    const spending: Record<string, number> = {};

    for (const tx of transactions) {
      if (tx.amount < 0) {
        const category = tx.category || "Uncategorized";
        spending[category] = (spending[category] || 0) + Math.abs(tx.amount);
      }
    }

    return spending;
  }

  /**
   * Analyze spending by year for multi-year comparisons
   * Returns: { year: { category: amount, totalIncome: amount, totalExpenses: amount } }
   */
  analyzeSpendingByYear(
    transactions: Transaction[],
    startYear?: number,
    endYear?: number
  ): Record<
    number,
    {
      income: Record<string, number>;
      expenses: Record<string, number>;
      totalIncome: number;
      totalExpenses: number;
      netSavings: number;
      savingsRate: number;
    }
  > {
    const yearData: Record<
      number,
      {
        income: Record<string, number>;
        expenses: Record<string, number>;
        totalIncome: number;
        totalExpenses: number;
        netSavings: number;
        savingsRate: number;
      }
    > = {};

    // Determine year range
    const years = new Set<number>();
    for (const tx of transactions) {
      years.add(new Date(tx.date).getFullYear());
    }

    const minYear = startYear || Math.min(...Array.from(years));
    const maxYear = endYear || Math.max(...Array.from(years));

    // Initialize data for each year
    for (let year = minYear; year <= maxYear; year++) {
      yearData[year] = {
        income: {},
        expenses: {},
        totalIncome: 0,
        totalExpenses: 0,
        netSavings: 0,
        savingsRate: 0,
      };
    }

    // Categorize transactions by year
    for (const tx of transactions) {
      const year = new Date(tx.date).getFullYear();
      if (year < minYear || year > maxYear) continue;

      const category = tx.category || "Uncategorized";
      const amount = Math.abs(tx.amount);

      if (tx.amount > 0) {
        // Income
        yearData[year].income[category] =
          (yearData[year].income[category] || 0) + amount;
        yearData[year].totalIncome += amount;
      } else {
        // Expenses
        yearData[year].expenses[category] =
          (yearData[year].expenses[category] || 0) + amount;
        yearData[year].totalExpenses += amount;
      }
    }

    // Calculate net savings and savings rate
    for (let year = minYear; year <= maxYear; year++) {
      const data = yearData[year];
      data.netSavings = data.totalIncome - data.totalExpenses;
      data.savingsRate =
        data.totalIncome > 0
          ? Math.round((data.netSavings / data.totalIncome) * 10000) / 100
          : 0;
    }

    return yearData;
  }
}
