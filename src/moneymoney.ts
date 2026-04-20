/**
 * MoneyMoney API Integration
 *
 * Uses official MoneyMoney AppleScript API to export transactions and categories
 * as XML Property Lists. Falls back to mock data in development mode.
 */

import * as fs from "fs";
import * as path from "path";
import * as plist from "plist";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
}

export interface Transaction {
  id: string;
  moneyMoneyId: string;
  accountId: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  categoryPath: string[];
  categoryId?: number | string;
  categoryUuid?: string;
  payee: string;
  booked?: boolean;
  bookingText?: string;
}

export type CategoryKind = "expense" | "income" | "neutral";

export interface Category {
  name: string;
  uuid?: string;
  id?: number | string;
  path: string[];
  fullPath: string;
  level: number;
  kind: CategoryKind;
}

interface AccountMapping {
  name: string;
  type: string;
}

interface AccountMappingsConfig {
  accountMappings: Record<string, AccountMapping>;
}

interface CategoryResolution {
  category: Category;
  matchType: "uuid" | "path" | "name" | "fuzzy";
  confidence: number;
}

interface CategorizeTransactionInput {
  transactionId: string;
  categoryUuid?: string;
  categoryPath?: string;
  categoryName?: string;
  dryRun?: boolean;
}

interface BatchCategorizeInput extends CategorizeTransactionInput {}

interface BatchCategorizeOptions {
  dryRun?: boolean;
}

interface PreparedCategorization {
  transaction: Transaction;
  resolution: CategoryResolution;
  previousCategory: string;
  targetCategory: string;
  alreadyAssigned: boolean;
}

interface CategoryTemplate {
  name: string;
  path: string[];
  uuid: string;
  payees: string[];
  avgAmount: number;
}

export class MoneyMoneyService {
  private plistPath = path.join(
    process.env.HOME || "",
    "Projects/moneymoney-mcp-server/data/transactions.plist"
  );
  private categoriesPlistPath = path.join(
    process.env.HOME || "",
    "Projects/moneymoney-mcp-server/data/categories.plist"
  );
  private accountMappingsPath = path.join(
    process.env.HOME || "",
    "Projects/moneymoney-mcp-server/account-mappings.json"
  );
  private accountsJsonPath = path.join(
    process.env.HOME || "",
    "Projects/moneymoney-mcp-server/data/accounts.json"
  );
  private autoExportScriptPath = path.join(
    process.env.HOME || "",
    "Projects/moneymoney-mcp-server/scripts/auto-export.scpt"
  );
  private exportCategoriesScriptPath = path.join(
    process.env.HOME || "",
    "Projects/moneymoney-mcp-server/scripts/export-categories.scpt"
  );
  private setTransactionCategoryScriptPath = path.join(
    process.env.HOME || "",
    "Projects/moneymoney-mcp-server/scripts/set-transaction-category.scpt"
  );
  private createRuleScriptPath = path.join(
    process.env.HOME || "",
    "Projects/moneymoney-mcp-server/scripts/create-rule.applescript"
  );
  private realTransactions: Transaction[] = [];
  private realCategories: Category[] = [];
  private mockTransactionsCache: Transaction[] | null = null;
  private isLoading = false;
  private lastLoadAttempt = 0;
  private lastCategoryLoadAttempt = 0;
  private isProduction = process.env.NODE_ENV === "production";
  private accountMappings: Record<string, AccountMapping> = {};
  private realBalances: Record<string, number> = {};

  private normalizeValue(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, " ");
  }

  private normalizePathInput(value: string | string[]): string[] {
    if (Array.isArray(value)) {
      return value.map((segment) => segment.trim()).filter((segment) => segment.length > 0);
    }

    return value
      .split(/\\|>|\//)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);
  }

  private normalizePathKey(value: string | string[]): string {
    return this.normalizePathInput(value)
      .map((segment) => this.normalizeValue(segment))
      .join(" > ");
  }

  private tokenize(value: string): string[] {
    const normalized = this.normalizeValue(value);
    return normalized.split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 3);
  }

  private determineCategoryKind(pathSegments: string[]): CategoryKind {
    const topLevel = this.normalizeValue(pathSegments[0] || "");
    if (topLevel === "ausgaben" || topLevel === "expenses") {
      return "expense";
    }
    if (topLevel === "einnahmen" || topLevel === "income") {
      return "income";
    }
    return "neutral";
  }

  private buildCategoryFromPath(
    pathSegments: string[],
    uuid?: string,
    id?: number | string
  ): Category {
    const path = this.normalizePathInput(pathSegments);
    const name = path[path.length - 1] || "Uncategorized";
    return {
      name,
      uuid,
      id,
      path,
      fullPath: path.join(" > "),
      level: Math.max(path.length - 1, 0),
      kind: this.determineCategoryKind(path),
    };
  }

  private async runAppleScript(scriptPath: string, args: string[] = []): Promise<string> {
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`AppleScript not found: ${scriptPath}`);
    }

    const { stdout, stderr } = await execFileAsync("osascript", [scriptPath, ...args]);

    if (stderr && stderr.trim().length > 0) {
      console.error("AppleScript stderr:", stderr.trim());
    }

    return stdout.trim();
  }

  private invalidateCaches(options?: { transactions?: boolean; categories?: boolean }): void {
    if (options?.transactions ?? true) {
      this.realTransactions = [];
      this.mockTransactionsCache = null;
    }
    if (options?.categories ?? true) {
      this.realCategories = [];
    }
  }

  /**
   * Automatically trigger MoneyMoney transaction export via AppleScript.
   */
  private async triggerMoneyMoneyExport(): Promise<boolean> {
    try {
      console.error("🔄 Starting automatic MoneyMoney export via official API...");

      const output = await this.runAppleScript(this.autoExportScriptPath);

      if (output.includes("✅")) {
        console.error("✅ Automatic export completed:", output);
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
   * Export the MoneyMoney category catalog via AppleScript.
   */
  private async triggerCategoriesExport(): Promise<boolean> {
    try {
      console.error("🔄 Exporting MoneyMoney categories...");

      const output = await this.runAppleScript(this.exportCategoriesScriptPath);

      if (output.includes("✅")) {
        console.error("✅ Category export completed:", output);
        return true;
      }

      return false;
    } catch (error) {
      console.error("❌ Category export failed:", error);
      return false;
    }
  }

  /**
   * Load transaction data from the MoneyMoney plist export.
   */
  private async loadPlistData(forceRefresh: boolean = false): Promise<boolean> {
    try {
      if (this.isLoading) {
        console.error("⏳ Data load already in progress, please wait...");
        return false;
      }

      const existingStats = fs.existsSync(this.plistPath) ? fs.statSync(this.plistPath) : null;
      const existingFileAge = existingStats ? Date.now() - existingStats.mtimeMs : Number.POSITIVE_INFINITY;
      const oneHour = 60 * 60 * 1000;

      if (!forceRefresh && this.realTransactions.length > 0 && existingFileAge <= oneHour) {
        return true;
      }

      const now = Date.now();
      if (now - this.lastLoadAttempt < 30 * 1000 && this.realTransactions.length === 0) {
        console.error("⏳ Recent load attempt failed, please wait before retrying");
        return false;
      }

      this.isLoading = true;
      this.lastLoadAttempt = now;

      const stats = existingStats;
      const fileAge = existingFileAge;
      const needsExport = forceRefresh || !stats || fileAge > oneHour;

      if (needsExport) {
        console.error("🔄 Plist data is stale or missing - triggering automatic export...");
        const exportSuccess = await this.triggerMoneyMoneyExport();

        if (!exportSuccess) {
          console.error("❌ Automatic export failed");

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

      const plistContent = fs.readFileSync(this.plistPath, "utf-8");
      const data = plist.parse(plistContent) as { transactions?: Array<Record<string, unknown>> };

      if (!data || !Array.isArray(data.transactions)) {
        console.error("❌ Invalid plist format: no transactions found");
        this.isLoading = false;
        return false;
      }

      const parsedTransactions: Array<Transaction | null> = data.transactions.map((tx) => {
          if (!tx.bookingDate) {
            return null;
          }

          const rawTransactionId = tx.id !== undefined && tx.id !== null
            ? String(tx.id)
            : `generated-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          const dateValue = tx.bookingDate instanceof Date
            ? tx.bookingDate
            : new Date(String(tx.bookingDate));
          const categoryPath = this.normalizePathInput(String(tx.category || ""));
          const categoryDisplay = categoryPath.length > 0
            ? categoryPath[categoryPath.length - 1]
            : (Number(tx.amount || 0) < 0 ? "Expenses" : "Income");

          return {
            id: `tx-${rawTransactionId}`,
            moneyMoneyId: rawTransactionId,
            accountId: String(tx.accountUuid || tx.accountNumber || tx.accountId || "unknown"),
            date: dateValue.toISOString().split("T")[0],
            description: String(tx.purpose || tx.name || "Unknown"),
            amount: Number(tx.amount || 0),
            currency: String(tx.currency || "EUR"),
            category: categoryDisplay,
            categoryPath,
            categoryId: tx.categoryId as number | string | undefined,
            categoryUuid: tx.categoryUuid ? String(tx.categoryUuid) : undefined,
            payee: String(tx.name || "Unknown"),
            booked: tx.booked === undefined ? undefined : Boolean(tx.booked),
            bookingText: tx.bookingText ? String(tx.bookingText) : undefined,
          };
        });

      this.realTransactions = parsedTransactions
        .filter((transaction): transaction is Transaction => transaction !== null)
        .sort((left, right) => right.date.localeCompare(left.date));

      console.error(`✅ Loaded ${this.realTransactions.length} real transactions from MoneyMoney API`);
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

  private extractCategoriesFromTransactions(transactions: Transaction[]): Category[] {
    const categories = new Map<string, Category>();

    for (const transaction of transactions) {
      if (!transaction.categoryPath || transaction.categoryPath.length === 0) {
        continue;
      }

      const category = this.buildCategoryFromPath(
        transaction.categoryPath,
        transaction.categoryUuid,
        transaction.categoryId
      );
      const key = category.uuid || this.normalizePathKey(category.path);

      if (!categories.has(key)) {
        categories.set(key, category);
      }
    }

    return Array.from(categories.values()).sort((left, right) => left.fullPath.localeCompare(right.fullPath));
  }

  private parseCategoryNode(
    node: unknown,
    parentPath: string[],
    categories: Map<string, Category>
  ): void {
    if (Array.isArray(node)) {
      for (const item of node) {
        this.parseCategoryNode(item, parentPath, categories);
      }
      return;
    }

    if (!node || typeof node !== "object") {
      return;
    }

    const record = node as Record<string, unknown>;
    const nameValue = [record.name, record.title, record.label, record.category]
      .find((value) => typeof value === "string") as string | undefined;
    const uuidValue = [record.uuid, record.categoryUuid, record.identifier, record.uid]
      .find((value) => typeof value === "string") as string | undefined;
    const idValue = [record.id, record.categoryId, record.number]
      .find((value) => typeof value === "string" || typeof value === "number") as string | number | undefined;
    const explicitPathValue = [record.path, record.categoryPath, record.fullPath, record.breadcrumb]
      .find((value) => typeof value === "string" || Array.isArray(value)) as string | string[] | undefined;
    const currentPath = explicitPathValue
      ? this.normalizePathInput(explicitPathValue)
      : nameValue
        ? [...parentPath, nameValue]
        : parentPath;

    if (currentPath.length > 0 && (nameValue || uuidValue || idValue !== undefined)) {
      const category = this.buildCategoryFromPath(currentPath, uuidValue, idValue);
      const key = category.uuid || this.normalizePathKey(category.path);

      if (!categories.has(key)) {
        categories.set(key, category);
      }
    }

    const childKeys = ["children", "categories", "subcategories", "items", "nodes"];
    let traversedChildCollection = false;

    for (const key of childKeys) {
      if (record[key] !== undefined) {
        traversedChildCollection = true;
        this.parseCategoryNode(record[key], currentPath, categories);
      }
    }

    if (traversedChildCollection) {
      return;
    }

    for (const value of Object.values(record)) {
      if (typeof value === "object" && value !== null) {
        this.parseCategoryNode(value, currentPath, categories);
      }
    }
  }

  private async loadCategoriesData(forceRefresh: boolean = false): Promise<boolean> {
    const now = Date.now();

    if (!forceRefresh && this.realCategories.length > 0) {
      return true;
    }

    if (!forceRefresh && now - this.lastCategoryLoadAttempt < 30 * 1000 && this.realCategories.length === 0) {
      return false;
    }

    this.lastCategoryLoadAttempt = now;

    const stats = fs.existsSync(this.categoriesPlistPath) ? fs.statSync(this.categoriesPlistPath) : null;
    const fileAge = stats ? Date.now() - stats.mtimeMs : Number.POSITIVE_INFINITY;
    const sixHours = 6 * 60 * 60 * 1000;
    const needsExport = forceRefresh || !stats || fileAge > sixHours;

    if (needsExport) {
      await this.triggerCategoriesExport();
    }

    if (fs.existsSync(this.categoriesPlistPath)) {
      try {
        const categoriesContent = fs.readFileSync(this.categoriesPlistPath, "utf-8");
        const parsed = plist.parse(categoriesContent) as unknown;
        const categories = new Map<string, Category>();

        this.parseCategoryNode(parsed, [], categories);
        this.realCategories = Array.from(categories.values()).sort((left, right) => left.fullPath.localeCompare(right.fullPath));

        if (this.realCategories.length > 0) {
          console.error(`✅ Loaded ${this.realCategories.length} categories from MoneyMoney API`);
          return true;
        }
      } catch (error) {
        console.error("⚠️ Failed to parse categories.plist:", error);
      }
    }

    await this.loadPlistData();

    if (this.realTransactions.length > 0) {
      this.realCategories = this.extractCategoriesFromTransactions(this.realTransactions);
      if (this.realCategories.length > 0) {
        console.error(`✅ Derived ${this.realCategories.length} categories from transactions`);
        return true;
      }
    }

    if (!this.isProduction) {
      this.realCategories = this.getMockCategories();
      console.error(`⚠️ Development mode: Using ${this.realCategories.length} mock categories`);
      return true;
    }

    return false;
  }

  private async findTransactionById(transactionId: string): Promise<Transaction> {
    const transactions = await this.getTransactions();
    const normalizedId = String(transactionId).trim();

    const transaction = transactions.find((candidate) => {
      return candidate.id === normalizedId
        || candidate.moneyMoneyId === normalizedId
        || candidate.id === `tx-${normalizedId}`
        || candidate.id.replace(/^tx-/, "") === normalizedId;
    });

    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    return transaction;
  }

  private getDisplayCategory(transaction: Transaction): string {
    return transaction.categoryPath.length > 0
      ? transaction.categoryPath.join(" > ")
      : transaction.category || "Uncategorized";
  }

  private async prepareCategorization(input: CategorizeTransactionInput): Promise<PreparedCategorization> {
    const transaction = await this.findTransactionById(input.transactionId);
    const resolution = await this.resolveCategory({
      categoryUuid: input.categoryUuid,
      categoryPath: input.categoryPath,
      categoryName: input.categoryName,
    });

    const previousCategory = this.getDisplayCategory(transaction);
    const targetCategory = resolution.category.fullPath;
    const alreadyAssigned = previousCategory === targetCategory
      || (transaction.categoryUuid !== undefined && transaction.categoryUuid === resolution.category.uuid);

    return {
      transaction,
      resolution,
      previousCategory,
      targetCategory,
      alreadyAssigned,
    };
  }

  private buildCategorizeResult(
    prepared: PreparedCategorization,
    options: {
      dryRun?: boolean;
      applied?: boolean;
      skipped?: boolean;
      currentCategory?: string;
      reason?: string;
    } = {}
  ): Record<string, unknown> {
    const { transaction, resolution, previousCategory, targetCategory, alreadyAssigned } = prepared;

    if (options.dryRun) {
      return {
        status: "success",
        mode: "dry-run",
        transactionId: transaction.id,
        moneyMoneyId: transaction.moneyMoneyId,
        date: transaction.date,
        payee: transaction.payee,
        amount: transaction.amount,
        previousCategory,
        targetCategory,
        matchType: resolution.matchType,
        confidence: resolution.confidence,
        wouldChange: !alreadyAssigned,
      };
    }

    return {
      status: "success",
      transactionId: transaction.id,
      moneyMoneyId: transaction.moneyMoneyId,
      previousCategory,
      currentCategory: options.currentCategory || previousCategory,
      targetCategory,
      applied: options.applied ?? false,
      skipped: options.skipped ?? false,
      reason: options.reason,
      matchType: resolution.matchType,
      confidence: resolution.confidence,
    };
  }

  private async resolveCategory(input: {
    categoryUuid?: string;
    categoryPath?: string;
    categoryName?: string;
  }): Promise<CategoryResolution> {
    const categories = await this.getCategoriesCatalog({ includeIncome: true });

    if (categories.length === 0) {
      throw new Error("No categories available");
    }

    if (input.categoryUuid) {
      const normalizedUuid = this.normalizeValue(input.categoryUuid);
      const category = categories.find(
        (candidate) => candidate.uuid && this.normalizeValue(candidate.uuid) === normalizedUuid
      );

      if (!category) {
        throw new Error(`Unknown category UUID: ${input.categoryUuid}`);
      }

      return { category, matchType: "uuid", confidence: 1 };
    }

    if (input.categoryPath) {
      const normalizedPath = this.normalizePathKey(input.categoryPath);
      const category = categories.find(
        (candidate) => this.normalizePathKey(candidate.path) === normalizedPath
      );

      if (category) {
        return { category, matchType: "path", confidence: 1 };
      }
    }

    const query = input.categoryName || input.categoryPath;
    if (!query) {
      throw new Error("Provide category_uuid, category_path, or category_name");
    }

    const normalizedQuery = this.normalizePathKey(query);
    const queryTokens = this.tokenize(normalizedQuery);
    const scored = categories
      .map((category) => {
        const pathKey = this.normalizePathKey(category.path);
        const nameKey = this.normalizeValue(category.name);
        let score = 0;

        if (pathKey === normalizedQuery) {
          score = 100;
        } else if (nameKey === normalizedQuery) {
          score = 95;
        } else if (pathKey.endsWith(normalizedQuery)) {
          score = 90;
        } else if (pathKey.includes(normalizedQuery)) {
          score = 80;
        } else if (nameKey.includes(normalizedQuery)) {
          score = 70;
        }

        if (queryTokens.length > 0) {
          const tokenMatches = queryTokens.filter(
            (token) => pathKey.includes(token) || nameKey.includes(token)
          ).length;
          score += tokenMatches * 5;
        }

        return { category, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return left.category.fullPath.localeCompare(right.category.fullPath);
      });

    if (scored.length === 0) {
      throw new Error(`No matching category found for: ${query}`);
    }

    return {
      category: scored[0].category,
      matchType: scored[0].score >= 95 ? "name" : "fuzzy",
      confidence: Math.min(scored[0].score / 100, 0.99),
    };
  }

  private async applyCategoryToTransaction(transaction: Transaction, category: Category): Promise<void> {
    const categoryIdentifier = category.uuid || (category.id !== undefined ? String(category.id) : undefined);

    if (!categoryIdentifier) {
      throw new Error(`Category ${category.fullPath} has no writable identifier`);
    }

    if (transaction.moneyMoneyId.startsWith("mock-") || transaction.moneyMoneyId.startsWith("generated-")) {
      throw new Error("Cannot persist category changes for mock transactions");
    }

    const output = await this.runAppleScript(this.setTransactionCategoryScriptPath, [
      transaction.moneyMoneyId,
      categoryIdentifier,
    ]);

    if (!output.includes("✅")) {
      throw new Error(`Categorization failed for transaction ${transaction.id}`);
    }
  }

  private transactionMatchesCategory(transaction: Transaction, category: Category): boolean {
    if (category.uuid && transaction.categoryUuid === category.uuid) {
      return true;
    }

    return this.normalizePathKey(transaction.categoryPath) === this.normalizePathKey(category.path);
  }

  private async refreshTransactionsAfterWrite(): Promise<void> {
    this.invalidateCaches({ transactions: true, categories: false });

    const exportSuccess = await this.triggerMoneyMoneyExport();
    if (!exportSuccess) {
      throw new Error("Transaction export after categorization failed. Please verify that MoneyMoney is running.");
    }

    const loadSuccess = await this.loadPlistData(true);
    if (!loadSuccess) {
      throw new Error("Could not reload transactions after categorization.");
    }
  }

  /**
   * Load account mappings from config file.
   */
  private loadAccountMappings(): void {
    try {
      if (fs.existsSync(this.accountMappingsPath)) {
        const configContent = fs.readFileSync(this.accountMappingsPath, "utf-8");
        const config: AccountMappingsConfig = JSON.parse(configContent);
        this.accountMappings = config.accountMappings || {};
        console.error(`✅ Loaded ${Object.keys(this.accountMappings).length} account mappings from config`);
      } else {
        console.error("⚠️ No account-mappings.json found - using generic account names");
        console.error(`   Create ${this.accountMappingsPath} to customize account names`);
      }
    } catch (error) {
      console.error("⚠️ Error loading account mappings:", error);
      console.error("   Using generic account names");
    }
  }

  /**
   * Load real account balances from accounts.json if available.
   */
  private loadRealBalances(): void {
    try {
      if (fs.existsSync(this.accountsJsonPath)) {
        const accountsContent = fs.readFileSync(this.accountsJsonPath, "utf-8");
        const accountsData = JSON.parse(accountsContent) as Record<string, unknown>;

        for (const [uuid, data] of Object.entries(accountsData)) {
          if (typeof data === "object" && data !== null && "balance" in data) {
            this.realBalances[uuid] = Number((data as { balance: unknown }).balance);
          }
        }

        console.error(`✅ Loaded real balances for ${Object.keys(this.realBalances).length} accounts`);
      }
    } catch {
      console.error("⚠️ Could not load real balances from accounts.json");
    }
  }

  /**
   * Map account UUID to friendly name and type.
   */
  private getAccountInfo(accountId: string): { name: string; type: string } {
    if (Object.keys(this.accountMappings).length === 0 && fs.existsSync(this.accountMappingsPath)) {
      this.loadAccountMappings();
    }

    if (this.accountMappings[accountId]) {
      return this.accountMappings[accountId];
    }

    return { name: `Konto ${accountId.substring(0, 8)}...`, type: "Checking" };
  }

  /**
   * Get all accounts.
   */
  async getAccounts(): Promise<Account[]> {
    await this.loadPlistData();

    if (Object.keys(this.accountMappings).length === 0) {
      this.loadAccountMappings();
    }
    if (Object.keys(this.realBalances).length === 0) {
      this.loadRealBalances();
    }

    if (this.realTransactions.length > 0) {
      const accountMap = new Map<string, Account>();

      for (const transaction of this.realTransactions) {
        if (!accountMap.has(transaction.accountId)) {
          const accountInfo = this.getAccountInfo(transaction.accountId);
          accountMap.set(transaction.accountId, {
            id: transaction.accountId,
            name: accountInfo.name,
            type: accountInfo.type,
            balance: 0,
            currency: transaction.currency,
          });
        }

        const account = accountMap.get(transaction.accountId);
        if (account) {
          account.balance += transaction.amount;
        }
      }

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

      for (const account of accountMap.values()) {
        if (this.realBalances[account.id] !== undefined) {
          account.balance = this.realBalances[account.id];
        } else if (accountMap.size > 1) {
          console.error(`⚠️ Using calculated balance for ${account.name} (only transaction sum from export period)`);
        }
      }

      console.error(`✅ Using ${accountMap.size} real accounts from MoneyMoney API`);
      return Array.from(accountMap.values());
    }

    if (this.isProduction) {
      throw new Error(
        "No real MoneyMoney data available. Please ensure MoneyMoney is running and accessible."
      );
    }

    console.error("⚠️ Development mode: Using mock accounts");
    return this.getMockAccounts();
  }

  /**
   * Get transactions, optionally filtered by account.
   */
  async getTransactions(accountId?: string): Promise<Transaction[]> {
    await this.loadPlistData();

    if (this.realTransactions.length > 0) {
      console.error("✅ Using real transaction data from MoneyMoney API");
      return accountId
        ? this.realTransactions.filter((transaction) => transaction.accountId === accountId)
        : this.realTransactions;
    }

    if (this.isProduction) {
      throw new Error(
        "No real MoneyMoney data available. Please ensure MoneyMoney is running and accessible."
      );
    }

    console.error("⚠️ Development mode: Using mock transactions");
    if (!this.mockTransactionsCache) {
      this.mockTransactionsCache = this.generateMockTransactions();
    }

    return accountId
      ? this.mockTransactionsCache.filter((transaction) => transaction.accountId === accountId)
      : this.mockTransactionsCache;
  }

  async getCategoriesCatalog(options?: {
    query?: string;
    includeIncome?: boolean;
    limit?: number;
  }): Promise<Category[]> {
    await this.loadCategoriesData();

    let categories = this.realCategories.length > 0 ? [...this.realCategories] : [];

    if (!options?.includeIncome) {
      categories = categories.filter((category) => category.kind !== "income");
    }

    if (options?.query) {
      const normalizedQuery = this.normalizePathKey(options.query);
      categories = categories.filter((category) => {
        const pathKey = this.normalizePathKey(category.path);
        const nameKey = this.normalizeValue(category.name);
        return pathKey.includes(normalizedQuery) || nameKey.includes(this.normalizeValue(options.query || ""));
      });
    }

    const limit = options?.limit && options.limit > 0 ? options.limit : categories.length;
    return categories.slice(0, limit);
  }

  async categorizeTransaction(input: CategorizeTransactionInput): Promise<Record<string, unknown>> {
    const prepared = await this.prepareCategorization(input);

    if (input.dryRun) {
      return this.buildCategorizeResult(prepared, { dryRun: true });
    }

    if (prepared.alreadyAssigned) {
      return this.buildCategorizeResult(prepared, {
        currentCategory: prepared.previousCategory,
        skipped: true,
        reason: "Transaction already uses the requested category",
      });
    }

    await this.applyCategoryToTransaction(prepared.transaction, prepared.resolution.category);
    await this.refreshTransactionsAfterWrite();

    const updatedTransaction = await this.findTransactionById(prepared.transaction.id);

    if (!this.transactionMatchesCategory(updatedTransaction, prepared.resolution.category)) {
      throw new Error(
        `Categorization could not be verified for transaction ${prepared.transaction.id}. MoneyMoney still reports ${this.getDisplayCategory(updatedTransaction)}.`
      );
    }

    return this.buildCategorizeResult(prepared, {
      applied: true,
      currentCategory: this.getDisplayCategory(updatedTransaction),
    });
  }

  async categorizeTransactions(
    updates: BatchCategorizeInput[],
    options?: BatchCategorizeOptions
  ): Promise<Record<string, unknown>> {
    if (updates.length > 100) {
      throw new Error("Batch categorization is limited to 100 updates per request to protect system resources");
    }

    const dryRun = options?.dryRun ?? false;
    const results: Array<Record<string, unknown>> = [];
    const preparedUpdates: PreparedCategorization[] = [];

    for (const update of updates) {
      try {
        const prepared = await this.prepareCategorization({
          ...update,
          dryRun,
        });
        preparedUpdates.push(prepared);

        if (dryRun) {
          results.push(this.buildCategorizeResult(prepared, { dryRun: true }));
          continue;
        }

        if (prepared.alreadyAssigned) {
          results.push(this.buildCategorizeResult(prepared, {
            currentCategory: prepared.previousCategory,
            skipped: true,
            reason: "Transaction already uses the requested category",
          }));
          continue;
        }

        await this.applyCategoryToTransaction(prepared.transaction, prepared.resolution.category);
        results.push(this.buildCategorizeResult(prepared, {
          applied: true,
          currentCategory: prepared.targetCategory,
        }));
      } catch (error) {
        results.push({
          status: "error",
          transactionId: update.transactionId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (!dryRun && preparedUpdates.some((prepared) => !prepared.alreadyAssigned)) {
      await this.refreshTransactionsAfterWrite();

      for (const result of results) {
        if (result.status !== "success" || result.applied !== true || typeof result.transactionId !== "string") {
          continue;
        }

        try {
          const updatedTransaction = await this.findTransactionById(result.transactionId);
          const prepared = preparedUpdates.find((entry) => entry.transaction.id === result.transactionId);
          if (prepared && !this.transactionMatchesCategory(updatedTransaction, prepared.resolution.category)) {
            result.status = "error";
            result.applied = false;
            result.message = `Categorization could not be verified. MoneyMoney still reports ${this.getDisplayCategory(updatedTransaction)}.`;
            delete result.reason;
            continue;
          }

          result.currentCategory = this.getDisplayCategory(updatedTransaction);
        } catch {
          // Keep optimistic targetCategory if the refresh result cannot be resolved.
        }
      }
    }

    const successCount = results.filter((result) => result.status === "success").length;
    const errorCount = results.length - successCount;

    return {
      status: errorCount === 0 ? "success" : "partial",
      dryRun,
      total: updates.length,
      successCount,
      errorCount,
      results,
    };
  }

  /**
   * Create a categorization rule in MoneyMoney via GUI automation.
   *
   * ISO 25010 – Security: inputs are validated for length and character set
   * before being forwarded to AppleScript. execFileAsync passes arguments as
   * a separate argv array (no shell interpolation), preventing injection.
   *
   * Credits: Rule-creation concept based on community contribution;
   *          adapted and hardened for ISO 25010 compliance.
   *
   * @param payeeContains  Substring the payee/sender name must match.
   * @param category       Full category path, e.g. "Ausgaben > Urlaub".
   */
  async createRule(
    payeeContains: string,
    category: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    // --- Input validation (ISO 25010 Security / Functional Suitability) ---
    const trimmedPayee = payeeContains?.trim() ?? "";
    const trimmedCategory = category?.trim() ?? "";

    if (trimmedPayee.length === 0) {
      return { success: false, error: "payee_contains must not be empty" };
    }
    if (trimmedCategory.length === 0) {
      return { success: false, error: "category must not be empty" };
    }
    if (trimmedPayee.length > 200) {
      return { success: false, error: "payee_contains exceeds maximum length of 200 characters" };
    }
    if (trimmedCategory.length > 300) {
      return { success: false, error: "category exceeds maximum length of 300 characters" };
    }
    // Reject null bytes and ASCII control characters (prevent injection via special sequences)
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x08\x0B-\x1F\x7F]/.test(trimmedPayee) || /[\x00-\x08\x0B-\x1F\x7F]/.test(trimmedCategory)) {
      return { success: false, error: "Input contains invalid control characters" };
    }

    try {
      // execFileAsync forwards args as separate argv entries — no shell interpolation.
      const output = await this.runAppleScript(this.createRuleScriptPath, [
        trimmedPayee,
        trimmedCategory,
      ]);

      try {
        const result = JSON.parse(output) as { success: boolean; message?: string; error?: string };
        return result;
      } catch {
        // AppleScript returned non-JSON (unexpected output)
        return { success: false, error: `Unexpected AppleScript output: ${output}` };
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);

      if (errMsg.includes("assistive") || errMsg.includes("accessibility")) {
        return {
          success: false,
          error:
            "Accessibility permission required. Go to System Settings > Privacy & Security > Accessibility and enable Terminal or Node.js.",
        };
      }
      if (errMsg.includes("MoneyMoney") || errMsg.includes("not running")) {
        return {
          success: false,
          error: "MoneyMoney must be running and visible. Please open MoneyMoney and try again.",
        };
      }

      return { success: false, error: errMsg };
    }
  }

  async suggestCategoriesForTransaction(
    transactionId: string,
    limit: number = 5
  ): Promise<Array<Record<string, unknown>>> {
    const target = await this.findTransactionById(transactionId);
    const transactions = await this.getTransactions();
    const suggestions = new Map<string, {
      category: Category;
      score: number;
      matchCount: number;
      reasons: Set<string>;
    }>();
    const targetPayee = this.normalizeValue(target.payee);
    const targetDescription = this.normalizeValue(target.description);
    const targetBookingText = this.normalizeValue(target.bookingText || "");
    const targetTokens = new Set(this.tokenize(`${target.payee} ${target.description} ${target.bookingText || ""}`));

    for (const candidate of transactions) {
      if (candidate.id === target.id || candidate.categoryPath.length === 0) {
        continue;
      }

      let score = 0;
      const reasons = new Set<string>();
      const candidatePayee = this.normalizeValue(candidate.payee);
      const candidateDescription = this.normalizeValue(candidate.description);
      const candidateBookingText = this.normalizeValue(candidate.bookingText || "");

      if (candidatePayee === targetPayee && targetPayee.length > 0) {
        score += 6;
        reasons.add("same payee");
      }

      if (candidateDescription === targetDescription && targetDescription.length > 0) {
        score += 4;
        reasons.add("same description");
      }

      if (candidateBookingText.length > 0 && candidateBookingText === targetBookingText) {
        score += 3;
        reasons.add("same booking text");
      }

      const candidateTokens = this.tokenize(`${candidate.payee} ${candidate.description} ${candidate.bookingText || ""}`);
      const tokenOverlap = candidateTokens.filter((token) => targetTokens.has(token)).length;
      if (tokenOverlap > 0) {
        score += tokenOverlap;
        reasons.add("text similarity");
      }

      if (Math.sign(candidate.amount) === Math.sign(target.amount)) {
        score += 0.5;
      }

      if (Math.abs(Math.abs(candidate.amount) - Math.abs(target.amount)) <= 5) {
        score += 1;
        reasons.add("similar amount");
      }

      if (score <= 0) {
        continue;
      }

      const category = this.buildCategoryFromPath(
        candidate.categoryPath,
        candidate.categoryUuid,
        candidate.categoryId
      );
      const key = category.uuid || this.normalizePathKey(category.path);
      const existing = suggestions.get(key);

      if (existing) {
        existing.score += score;
        existing.matchCount += 1;
        for (const reason of reasons) {
          existing.reasons.add(reason);
        }
      } else {
        suggestions.set(key, {
          category,
          score,
          matchCount: 1,
          reasons,
        });
      }
    }

    return Array.from(suggestions.values())
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        if (right.matchCount !== left.matchCount) {
          return right.matchCount - left.matchCount;
        }
        return left.category.fullPath.localeCompare(right.category.fullPath);
      })
      .slice(0, limit)
      .map((entry) => ({
        category: entry.category.fullPath,
        categoryUuid: entry.category.uuid,
        score: Math.round(entry.score * 100) / 100,
        matchCount: entry.matchCount,
        reasons: Array.from(entry.reasons),
      }));
  }

  /**
   * Get loading status and data availability.
   */
  getStatus(): {
    isLoading: boolean;
    hasData: boolean;
    dataAge: number | null;
    isProduction: boolean;
    categoryCount: number;
  } {
    const stats = fs.existsSync(this.plistPath) ? fs.statSync(this.plistPath) : null;
    const dataAge = stats ? Date.now() - stats.mtimeMs : null;

    return {
      isLoading: this.isLoading,
      hasData: this.realTransactions.length > 0,
      dataAge,
      isProduction: this.isProduction,
      categoryCount: this.realCategories.length,
    };
  }

  /**
   * Get mock accounts for testing.
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

  private getMockCategoryTemplates(): CategoryTemplate[] {
    return [
      {
        name: "Groceries",
        path: ["Ausgaben", "Lebensmittel", "Groceries"],
        uuid: "mock-expenses-groceries",
        payees: ["REWE", "Edeka", "Aldi", "Lidl", "Kaufland"],
        avgAmount: -45,
      },
      {
        name: "Restaurants",
        path: ["Ausgaben", "Freizeit", "Restaurants"],
        uuid: "mock-expenses-restaurants",
        payees: ["Restaurant", "Café", "McDonald's", "Burger King"],
        avgAmount: -25,
      },
      {
        name: "Transportation",
        path: ["Ausgaben", "Mobilität", "Transportation"],
        uuid: "mock-expenses-transportation",
        payees: ["DB", "Shell", "Tankstelle", "MVG"],
        avgAmount: -60,
      },
      {
        name: "Utilities",
        path: ["Ausgaben", "Wohnen", "Utilities"],
        uuid: "mock-expenses-utilities",
        payees: ["Stadtwerke", "Telekom", "Vodafone"],
        avgAmount: -80,
      },
      {
        name: "Rent",
        path: ["Ausgaben", "Wohnen", "Rent"],
        uuid: "mock-expenses-rent",
        payees: ["Vermieter"],
        avgAmount: -950,
      },
      {
        name: "Insurance",
        path: ["Ausgaben", "Fixkosten", "Insurance"],
        uuid: "mock-expenses-insurance",
        payees: ["Allianz", "HUK"],
        avgAmount: -120,
      },
      {
        name: "Shopping",
        path: ["Ausgaben", "Konsum", "Shopping"],
        uuid: "mock-expenses-shopping",
        payees: ["Amazon", "Zalando", "H&M", "MediaMarkt"],
        avgAmount: -85,
      },
      {
        name: "Entertainment",
        path: ["Ausgaben", "Freizeit", "Entertainment"],
        uuid: "mock-expenses-entertainment",
        payees: ["Netflix", "Spotify", "Kino"],
        avgAmount: -15,
      },
      {
        name: "Healthcare",
        path: ["Ausgaben", "Gesundheit", "Healthcare"],
        uuid: "mock-expenses-healthcare",
        payees: ["Apotheke", "Arzt"],
        avgAmount: -40,
      },
      {
        name: "Salary",
        path: ["Einnahmen", "Arbeit", "Salary"],
        uuid: "mock-income-salary",
        payees: ["Employer GmbH"],
        avgAmount: 3500,
      },
    ];
  }

  private getMockCategories(): Category[] {
    return this.getMockCategoryTemplates()
      .map((template) => this.buildCategoryFromPath(template.path, template.uuid))
      .sort((left, right) => left.fullPath.localeCompare(right.fullPath));
  }

  /**
   * Generate realistic mock transactions for testing.
   */
  private generateMockTransactions(accountId?: string): Transaction[] {
    const transactions: Transaction[] = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 365);
    const categories = this.getMockCategoryTemplates();
    const accountIds = accountId ? [accountId] : ["acc-1", "acc-2", "acc-3"];

    for (let day = 0; day < 365; day++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + day);
      const numberOfTransactions = Math.floor(Math.random() * 3) + 1;

      for (let index = 0; index < numberOfTransactions; index++) {
        const category = categories[Math.floor(Math.random() * categories.length)];
        const payee = category.payees[Math.floor(Math.random() * category.payees.length)];
        const variance = (Math.random() - 0.5) * 0.4;
        const amount = Math.round(category.avgAmount * (1 + variance) * 100) / 100;
        const moneyMoneyId = `mock-${day}-${index}`;

        transactions.push({
          id: `tx-${moneyMoneyId}`,
          moneyMoneyId,
          accountId: accountIds[Math.floor(Math.random() * accountIds.length)],
          date: date.toISOString().split("T")[0],
          description: `${payee} - ${category.name}`,
          amount,
          currency: "EUR",
          category: category.name,
          categoryPath: category.path,
          categoryUuid: category.uuid,
          payee,
          booked: true,
        });
      }
    }

    return transactions.sort((left, right) => right.date.localeCompare(left.date));
  }

  /**
   * Analyze spending by category.
   */
  analyzeSpending(transactions: Transaction[]): Record<string, number> {
    const spending: Record<string, number> = {};

    for (const transaction of transactions) {
      if (transaction.amount < 0) {
        const category = transaction.category || "Uncategorized";
        spending[category] = (spending[category] || 0) + Math.abs(transaction.amount);
      }
    }

    return spending;
  }

  /**
   * Analyze spending by year for multi-year comparisons.
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
    const years = new Set<number>();

    for (const transaction of transactions) {
      years.add(new Date(transaction.date).getFullYear());
    }

    const minYear = startYear || Math.min(...Array.from(years));
    const maxYear = endYear || Math.max(...Array.from(years));

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

    for (const transaction of transactions) {
      const year = new Date(transaction.date).getFullYear();
      if (year < minYear || year > maxYear) {
        continue;
      }

      const category = transaction.category || "Uncategorized";
      const amount = Math.abs(transaction.amount);

      if (transaction.amount > 0) {
        yearData[year].income[category] = (yearData[year].income[category] || 0) + amount;
        yearData[year].totalIncome += amount;
      } else {
        yearData[year].expenses[category] = (yearData[year].expenses[category] || 0) + amount;
        yearData[year].totalExpenses += amount;
      }
    }

    for (let year = minYear; year <= maxYear; year++) {
      const data = yearData[year];
      data.netSavings = data.totalIncome - data.totalExpenses;
      data.savingsRate = data.totalIncome > 0
        ? Math.round((data.netSavings / data.totalIncome) * 10000) / 100
        : 0;
    }

    return yearData;
  }
}
