import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as dotenv from "dotenv";
import { MoneyMoneyService } from "./moneymoney";

dotenv.config({ quiet: true });

const server = new Server(
  {
    name: "moneymoney-mcp-server",
    version: "1.2.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Initialize MoneyMoney Integration
const moneyMoney = new MoneyMoneyService();

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_status",
        description: "Get MCP server status, data loading state, and data freshness",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_accounts",
        description: "Fetch all MoneyMoney accounts",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_transactions",
        description: "Fetch transactions from a specific account or year. By default returns all available transactions.",
        inputSchema: {
          type: "object",
          properties: {
            account_id: {
              type: "string",
              description: "The account ID (optional - returns all accounts if not specified)",
            },
            limit: {
              type: "number",
              description: "Maximum number of transactions to return (default: all)",
            },
            year: {
              type: "number",
              description: "Filter by year (e.g., 2025)",
            },
          },
        },
      },
      {
        name: "analyze_spending",
        description: "Analyze spending patterns by period (week/month/quarter/year) or compare multiple years (2020-2025). Shows income, expenses, and savings rate.",
        inputSchema: {
          type: "object",
          properties: {
            account_id: {
              type: "string",
              description: "The account ID to analyze (required for period-based analysis)",
            },
            period: {
              type: "string",
              enum: ["week", "month", "quarter", "year"],
              description: "Time period for analysis (required if not doing year-range comparison)",
            },
            start_year: {
              type: "number",
              description: "Start year for multi-year comparison (e.g., 2020)",
            },
            end_year: {
              type: "number",
              description: "End year for multi-year comparison (e.g., 2025)",
            },
          },
        },
      },
      {
        name: "get_categories",
        description: "Get hierarchical category structure with spending totals. Returns all categories with their full paths (e.g., Ausgaben > Verbrauchsgüter > Gastronomie) and spending amounts.",
        inputSchema: {
          type: "object",
          properties: {
            account_id: {
              type: "string",
              description: "Optional: Filter by account ID",
            },
            include_income: {
              type: "boolean",
              description: "Include income categories (default: false, only expenses)",
            },
          },
        },
      },
      {
        name: "search_categories",
        description: "Search the MoneyMoney category catalog by UUID, path, or name. Useful before categorizing transactions.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Optional free-text query, path fragment, or category name",
            },
            include_income: {
              type: "boolean",
              description: "Include income categories in the results (default: false)",
            },
            limit: {
              type: "number",
              description: "Maximum number of categories to return (default: all)",
            },
          },
        },
      },
      {
        name: "categorize_transaction",
        description: "Assign a MoneyMoney category to a single transaction by transaction ID. Accepts category UUID, full path, or category name. Supports dry-run previews.",
        inputSchema: {
          type: "object",
          properties: {
            transaction_id: {
              type: "string",
              description: "Transaction ID from get_transactions (tx-...) or the raw MoneyMoney transaction ID",
            },
            category_uuid: {
              type: "string",
              description: "Preferred: target category UUID from search_categories",
            },
            category_path: {
              type: "string",
              description: "Target category path, e.g. Ausgaben > Konsum > Shopping",
            },
            category_name: {
              type: "string",
              description: "Fallback category name if UUID/path are not known",
            },
            dry_run: {
              type: "boolean",
              description: "Preview the category change without writing to MoneyMoney",
            },
          },
          required: ["transaction_id"],
        },
      },
      {
        name: "batch_categorize_transactions",
        description: "Assign categories to multiple transactions in one request. Supports dry-run previews and partial success reporting.",
        inputSchema: {
          type: "object",
          properties: {
            dry_run: {
              type: "boolean",
              description: "Preview all requested changes without writing to MoneyMoney",
            },
            updates: {
              type: "array",
              description: "List of categorization requests",
              items: {
                type: "object",
                properties: {
                  transaction_id: {
                    type: "string",
                    description: "Transaction ID from get_transactions",
                  },
                  category_uuid: {
                    type: "string",
                    description: "Target category UUID",
                  },
                  category_path: {
                    type: "string",
                    description: "Target category path",
                  },
                  category_name: {
                    type: "string",
                    description: "Target category name",
                  },
                },
                required: ["transaction_id"],
              },
            },
          },
          required: ["updates"],
        },
      },
      {
        name: "suggest_categories_for_transaction",
        description: "Suggest likely categories for a transaction based on similar historical transactions.",
        inputSchema: {
          type: "object",
          properties: {
            transaction_id: {
              type: "string",
              description: "Transaction ID from get_transactions",
            },
            limit: {
              type: "number",
              description: "Maximum number of suggestions to return (default: 5)",
            },
          },
          required: ["transaction_id"],
        },
      },
      {
        name: "create_rule",
        description:
          "Create a persistent categorization rule in MoneyMoney. " +
          "Transactions whose payee/sender name contains the given pattern will automatically " +
          "be assigned the specified category — both for past and future transactions. " +
          "Uses GUI automation (requires Accessibility permission). " +
          "Prefer this over categorize_transaction when the same payee recurs regularly.",
        inputSchema: {
          type: "object",
          properties: {
            payee_contains: {
              type: "string",
              description:
                "Text that the payee/sender name must contain for the rule to match (max 200 characters)",
            },
            category: {
              type: "string",
              description:
                "Full category path to assign, e.g. \"Ausgaben > Urlaub\" (max 300 characters)",
            },
          },
          required: ["payee_contains", "category"],
        },
      },
      {
        name: "list_statements",
        description:
          "List bank statement PDFs from MoneyMoney's on-disk statement archive. " +
          "Filter by bank, account (IBAN / account number / 'Bank/Prefix'), and date range. " +
          "Returns {bank, filename, path, date, accountHint, size}, newest first. " +
          "Note: the file name alone rarely answers a question — pass the returned path to a PDF reader " +
          "to see balances, bookings, and fees.",
        inputSchema: {
          type: "object",
          properties: {
            bank: {
              type: "string",
              description: "Optional: case-insensitive substring of the bank name, e.g. \"ING\"",
            },
            account: {
              type: "string",
              description:
                "Optional: account reference — IBAN, account number, digit fragment, or \"Bank/Prefix\"",
            },
            since: {
              type: "string",
              description: "Optional: only statements dated on/after this ISO date (YYYY-MM-DD)",
            },
            until: {
              type: "string",
              description: "Optional: only statements dated on/before this ISO date (YYYY-MM-DD)",
            },
            limit: {
              type: "number",
              description: "Optional: maximum number of statements to return",
            },
          },
        },
      },
      {
        name: "get_statement",
        description:
          "Resolve a single bank statement by its exact file name (as returned by list_statements) " +
          "and return its absolute path on disk. Read that path to answer questions about the " +
          "statement's contents — do not stop at the file name.",
        inputSchema: {
          type: "object",
          properties: {
            filename: {
              type: "string",
              description: "Exact file name from list_statements, e.g. \"Kontoauszug_1234567890_2020-05-30_0916.pdf\"",
            },
          },
          required: ["filename"],
        },
      },
      {
        name: "create_batch_transfer",
        description:
          "Load a SEPA XML batch file (pain.001 credit transfer, or pain.008 direct debit with " +
          "direct_debit=true) into MoneyMoney. MoneyMoney opens the batch for review and the user " +
          "must confirm it and enter a TAN — this tool DRAFTS ONLY and can never send a payment by " +
          "itself. Note that MoneyMoney is sandboxed: if it cannot read the file, move the XML to a " +
          "location MoneyMoney may access.",
        inputSchema: {
          type: "object",
          properties: {
            xml_path: {
              type: "string",
              description: "Path to the SEPA XML file (max 1024 characters, must end in .xml)",
            },
            direct_debit: {
              type: "boolean",
              description:
                "Set to true for a pain.008 direct-debit batch (default: false, pain.001 credit transfer)",
            },
          },
          required: ["xml_path"],
        },
      },
      {
        name: "get_portfolio",
        description:
          "List the securities held in a portfolio (Depot) account. Returns each holding with " +
          "name, ISIN, instrument type, trading venue, quantity, current price, purchase price, " +
          "market value and profit, plus totals grouped by currency. Read-only.",
        inputSchema: {
          type: "object",
          properties: {
            account_id: {
              type: "string",
              description:
                "Portfolio account to read: UUID, account number or account name (from get_accounts)",
            },
          },
          required: ["account_id"],
        },
      },
    ],
  };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: toolArgs } = request.params;

  try {
    switch (name) {
      case "get_status": {
        const status = moneyMoney.getStatus();
        const statusMessage = status.isLoading 
          ? "⏳ Data update in progress..." 
          : status.hasData 
            ? "✅ Data loaded and available"
            : "⚠️ No data available yet";
        
        const ageMessage = status.dataAge 
          ? `Last updated ${Math.floor(status.dataAge / 1000 / 60)} minutes ago`
          : "No data file found";
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: statusMessage,
                  isLoading: status.isLoading,
                  hasData: status.hasData,
                  dataAge: status.dataAge,
                  ageMessage,
                  mode: status.isProduction ? "production" : "development",
                  categoryCount: status.categoryCount,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_accounts": {
        const accounts = await moneyMoney.getAccounts();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "success",
                  data: accounts,
                  count: Array.isArray(accounts) ? accounts.length : 0,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_transactions": {
        const args = toolArgs as { account_id?: string; limit?: number; year?: number } | undefined;
        const accountId = args?.account_id;
        const limit = typeof args?.limit === "number" ? args.limit : 10000; // Default to all transactions
        const year = typeof args?.year === "number" ? args.year : undefined;
        
        let allTransactions = await moneyMoney.getTransactions(accountId);
        
        // Filter by year if specified
        if (year) {
          allTransactions = allTransactions.filter(t => new Date(t.date).getFullYear() === year);
        }
        
        const transactions = allTransactions.slice(0, limit);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "success",
                  accountId: accountId || "all",
                  year: year || "all",
                  filteredCount: allTransactions.length,
                  returnedCount: transactions.length,
                  data: transactions,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "analyze_spending": {
        const args = toolArgs as {
          account_id?: string;
          period?: "week" | "month" | "quarter" | "year";
          start_year?: number;
          end_year?: number;
        } | undefined;

        if (!args) throw new Error("Missing arguments");

        // Multi-year comparison mode
        if (args.start_year !== undefined || args.end_year !== undefined) {
          const allTransactions = await moneyMoney.getTransactions();
          const yearAnalysis = moneyMoney.analyzeSpendingByYear(
            allTransactions,
            args.start_year,
            args.end_year
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    status: "success",
                    mode: "year-comparison",
                    startYear: args.start_year,
                    endYear: args.end_year,
                    data: yearAnalysis,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // Period-based analysis
        if (!args.account_id || !args.period) {
          throw new Error("For period-based analysis, account_id and period are required");
        }

        const accountId = String(args.account_id);
        const period = args.period as "week" | "month" | "quarter" | "year";

        // Get transactions for the account
        const allTransactions = await moneyMoney.getTransactions(accountId);

        // Filter by period
        const now = new Date();
        const daysMap = { week: 7, month: 30, quarter: 90, year: 365 };
        const cutoffDate = new Date(
          now.getTime() - daysMap[period] * 24 * 60 * 60 * 1000
        );
        const transactions = allTransactions.filter(
          (t) => new Date(t.date) >= cutoffDate
        );

        // Analyze spending
        const analysis = moneyMoney.analyzeSpending(transactions);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "success",
                  accountId,
                  period,
                  transactionsAnalyzed: transactions.length,
                  data: analysis,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_categories": {
        const args = toolArgs as { account_id?: string; include_income?: boolean } | undefined;
        const accountId = args?.account_id;
        const includeIncome = args?.include_income ?? false;
        
        // Get all transactions (optionally filtered by account)
        const transactions = await moneyMoney.getTransactions(accountId);
        
        // Build category hierarchy with totals
        interface CategoryNode {
          name: string;
          path: string[];
          total: number;
          count: number;
          children: Map<string, CategoryNode>;
        }
        
        const rootCategories = new Map<string, CategoryNode>();
        
        for (const tx of transactions) {
          // Skip income unless explicitly included
          if (!includeIncome && tx.amount >= 0) continue;
          
          if (!tx.categoryPath || tx.categoryPath.length === 0) continue;
          
          let currentLevel = rootCategories;
          let currentPath: string[] = [];
          
          for (let i = 0; i < tx.categoryPath.length; i++) {
            const categoryName = tx.categoryPath[i];
            currentPath = tx.categoryPath.slice(0, i + 1);
            
            if (!currentLevel.has(categoryName)) {
              currentLevel.set(categoryName, {
                name: categoryName,
                path: currentPath,
                total: 0,
                count: 0,
                children: new Map(),
              });
            }
            
            const node = currentLevel.get(categoryName)!;
            node.total += Math.abs(tx.amount);
            node.count++;
            
            currentLevel = node.children;
          }
        }
        
        // Convert Map structure to JSON-friendly format
        function mapToArray(map: Map<string, CategoryNode>): any[] {
          return Array.from(map.values()).map(node => ({
            name: node.name,
            path: node.path.join(" > "),
            total: Math.round(node.total * 100) / 100,
            count: node.count,
            children: node.children.size > 0 ? mapToArray(node.children) : undefined,
          })).sort((a, b) => b.total - a.total);
        }
        
        const categoryTree = mapToArray(rootCategories);
        const flatCategoryCount = new Set(
          transactions
            .filter((tx) => tx.categoryPath.length > 0)
            .map((tx) => tx.categoryPath.join(" > "))
        ).size;
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "success",
                  accountId: accountId || "all",
                  includeIncome,
                  categories: categoryTree,
                  totalCategories: categoryTree.length,
                  flatCategoryCount,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "search_categories": {
        const args = toolArgs as {
          query?: string;
          include_income?: boolean;
          limit?: number;
        } | undefined;
        const categories = await moneyMoney.getCategoriesCatalog({
          query: args?.query,
          includeIncome: args?.include_income ?? false,
          limit: typeof args?.limit === "number" ? args.limit : undefined,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "success",
                  query: args?.query || null,
                  includeIncome: args?.include_income ?? false,
                  count: categories.length,
                  data: categories,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "categorize_transaction": {
        const args = toolArgs as {
          transaction_id: string;
          category_uuid?: string;
          category_path?: string;
          category_name?: string;
          dry_run?: boolean;
        } | undefined;

        if (!args?.transaction_id) {
          throw new Error("transaction_id is required");
        }

        const result = await moneyMoney.categorizeTransaction({
          transactionId: args.transaction_id,
          categoryUuid: args.category_uuid,
          categoryPath: args.category_path,
          categoryName: args.category_name,
          dryRun: args.dry_run ?? false,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "batch_categorize_transactions": {
        const args = toolArgs as {
          dry_run?: boolean;
          updates?: Array<{
            transaction_id: string;
            category_uuid?: string;
            category_path?: string;
            category_name?: string;
          }>;
        } | undefined;

        if (!args?.updates || !Array.isArray(args.updates) || args.updates.length === 0) {
          throw new Error("updates must be a non-empty array");
        }

        const result = await moneyMoney.categorizeTransactions(
          args.updates.map((update) => ({
            transactionId: update.transaction_id,
            categoryUuid: update.category_uuid,
            categoryPath: update.category_path,
            categoryName: update.category_name,
          })),
          {
            dryRun: args.dry_run ?? false,
          }
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "suggest_categories_for_transaction": {
        const args = toolArgs as { transaction_id?: string; limit?: number } | undefined;

        if (!args?.transaction_id) {
          throw new Error("transaction_id is required");
        }

        const suggestions = await moneyMoney.suggestCategoriesForTransaction(
          args.transaction_id,
          typeof args.limit === "number" ? args.limit : 5
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "success",
                  transactionId: args.transaction_id,
                  count: suggestions.length,
                  suggestions,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "create_rule": {
        const args = toolArgs as {
          payee_contains: string;
          category: string;
        };

        if (!args?.payee_contains || !args?.category) {
          throw new Error("payee_contains and category are required");
        }

        const result = await moneyMoney.createRule(
          args.payee_contains,
          args.category
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "list_statements": {
        const args = (toolArgs ?? {}) as {
          bank?: string;
          account?: string;
          since?: string;
          until?: string;
          limit?: number;
        };

        const result = await moneyMoney.listStatements({
          bank: args.bank,
          account: args.account,
          since: args.since,
          until: args.until,
          limit: args.limit,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_statement": {
        const args = toolArgs as { filename: string };

        if (!args?.filename) {
          throw new Error("filename is required");
        }

        const statement = await moneyMoney.getStatement(args.filename);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(statement, null, 2),
            },
          ],
        };
      }

      case "create_batch_transfer": {
        const args = toolArgs as {
          xml_path: string;
          direct_debit?: boolean;
        };

        if (!args?.xml_path) {
          throw new Error("xml_path is required");
        }

        const result = await moneyMoney.createBatchTransfer(
          args.xml_path,
          args.direct_debit === true
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_portfolio": {
        const args = toolArgs as { account_id: string };

        if (!args?.account_id) {
          throw new Error("account_id is required");
        }

        const portfolio = await moneyMoney.getPortfolio(args.account_id);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(portfolio, null, 2),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: `Unknown tool: ${name}` }),
            },
          ],
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: error instanceof Error ? error.message : "Unknown error",
            status: "error",
          }),
        },
      ],
    };
  }
});

/**
 * Start server
 */
async function main() {
  try {
    console.error("Starting MoneyMoney MCP Server");
    console.error(`Version: 1.1.0`);
    console.error("Connecting via stdio...");
    
    const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error("MoneyMoney MCP Server ready for connections");
  } catch (error) {
    console.error("Startup error:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
