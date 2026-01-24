import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as dotenv from "dotenv";
import { MoneyMoneyService } from "./moneymoney";

dotenv.config();

const server = new Server(
  {
    name: "moneymoney-mcp-server",
    version: "1.0.0",
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
                },
                null,
                2
              ),
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
    console.error(`Version: 1.0.0`);
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
