/**
 * Tests for get_portfolio (src/moneymoney.ts).
 *
 * The parser is tested against synthetic property lists, so the suite runs
 * without MoneyMoney. Only the validation paths of getPortfolio() are exercised
 * directly — they reject before any AppleScript call is made.
 *
 * Run with: npm test
 */

const test = require("node:test");
const assert = require("node:assert");

const { parsePortfolioExport, MoneyMoneyService } = require("../dist/moneymoney");

function plistDocument(inner) {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n' +
    '<plist version="1.0"><dict><key>creator</key><string>MoneyMoney 2.5.1</string>' +
    "<key>portfolio</key><array>" +
    inner +
    "</array></dict></plist>"
  );
}

const HOLDING_EUR =
  "<dict>" +
  "<key>id</key><integer>1</integer>" +
  "<key>name</key><string>Example World ETF</string>" +
  "<key>isin</key><string>DE0001234567</string>" +
  "<key>type</key><string>share</string>" +
  "<key>market</key><string>Tradegate</string>" +
  "<key>quantity</key><real>10</real>" +
  "<key>price</key><real>100.5</real>" +
  "<key>currencyOfPrice</key><string>EUR</string>" +
  "<key>purchasePrice</key><real>80</real>" +
  "<key>currencyOfPurchasePrice</key><string>EUR</string>" +
  "<key>amount</key><real>1005</real>" +
  "<key>currencyOfAmount</key><string>EUR</string>" +
  "<key>absoluteProfit</key><real>205</real>" +
  "<key>relativeProfit</key><real>0.2562</real>" +
  "<key>currencyOfProfit</key><string>EUR</string>" +
  "<key>tradeTimestamp</key><date>2026-08-27T16:30:00Z</date>" +
  "</dict>";

const HOLDING_USD =
  "<dict>" +
  "<key>id</key><integer>2</integer>" +
  "<key>name</key><string>Example US Bond</string>" +
  "<key>isin</key><string>US0009876543</string>" +
  "<key>type</key><string>bond</string>" +
  "<key>quantity</key><real>5</real>" +
  "<key>price</key><real>200</real>" +
  "<key>amount</key><real>1000</real>" +
  "<key>currencyOfAmount</key><string>USD</string>" +
  "<key>absoluteProfit</key><real>50</real>" +
  "<key>currencyOfProfit</key><string>USD</string>" +
  "</dict>";

// Minimal position: MoneyMoney builds differ in which optional keys they emit.
const HOLDING_SPARSE =
  "<dict>" +
  "<key>name</key><string>Example Sparse Position</string>" +
  "<key>quantity</key><real>1</real>" +
  "<key>price</key><real>7.5</real>" +
  "<key>amount</key><real>7.5</real>" +
  "<key>currencyOfAmount</key><string>EUR</string>" +
  "</dict>";

test("maps a holding's fields", () => {
  const portfolio = parsePortfolioExport(plistDocument(HOLDING_EUR), "Flatex Depot");

  assert.strictEqual(portfolio.account, "Flatex Depot");
  assert.strictEqual(portfolio.holdingCount, 1);

  const holding = portfolio.holdings[0];
  assert.strictEqual(holding.name, "Example World ETF");
  assert.strictEqual(holding.isin, "DE0001234567");
  assert.strictEqual(holding.type, "share");
  assert.strictEqual(holding.market, "Tradegate");
  assert.strictEqual(holding.quantity, 10);
  assert.strictEqual(holding.price, 100.5);
  assert.strictEqual(holding.purchasePrice, 80);
  assert.strictEqual(holding.amount, 1005);
  assert.strictEqual(holding.absoluteProfit, 205);
});

test("converts the quote timestamp to an ISO string", () => {
  const portfolio = parsePortfolioExport(plistDocument(HOLDING_EUR), "Depot");
  const timestamp = portfolio.holdings[0].tradeTimestamp;
  assert.strictEqual(typeof timestamp, "string");
  assert.match(timestamp, /^2026-08-27T16:30:00/);
});

test("tolerates holdings that omit optional keys", () => {
  const portfolio = parsePortfolioExport(plistDocument(HOLDING_SPARSE), "Depot");
  const holding = portfolio.holdings[0];

  assert.strictEqual(holding.name, "Example Sparse Position");
  assert.strictEqual(holding.amount, 7.5);
  assert.strictEqual(holding.isin, undefined);
  assert.strictEqual(holding.absoluteProfit, undefined);
  assert.strictEqual(holding.tradeTimestamp, undefined);
});

test("never sums market value across currencies", () => {
  const portfolio = parsePortfolioExport(
    plistDocument(HOLDING_EUR + HOLDING_USD),
    "Mixed Depot"
  );

  assert.strictEqual(portfolio.holdingCount, 2);
  assert.strictEqual(portfolio.totals.length, 2, "one total per currency");

  const eur = portfolio.totals.find((total) => total.currency === "EUR");
  const usd = portfolio.totals.find((total) => total.currency === "USD");

  assert.strictEqual(eur.marketValue, 1005);
  assert.strictEqual(eur.absoluteProfit, 205);
  assert.strictEqual(usd.marketValue, 1000);
  assert.strictEqual(usd.absoluteProfit, 50);
});

test("totals are ordered by market value, largest first", () => {
  const portfolio = parsePortfolioExport(
    plistDocument(HOLDING_USD + HOLDING_EUR),
    "Mixed Depot"
  );
  assert.strictEqual(portfolio.totals[0].currency, "EUR");
});

test("ignores profit reported in a different currency than the position", () => {
  const mismatched =
    "<dict>" +
    "<key>name</key><string>Example Mismatch</string>" +
    "<key>quantity</key><real>1</real>" +
    "<key>price</key><real>10</real>" +
    "<key>amount</key><real>10</real>" +
    "<key>currencyOfAmount</key><string>EUR</string>" +
    "<key>absoluteProfit</key><real>3</real>" +
    "<key>currencyOfProfit</key><string>USD</string>" +
    "</dict>";

  const portfolio = parsePortfolioExport(plistDocument(mismatched), "Depot");
  const eur = portfolio.totals.find((total) => total.currency === "EUR");
  assert.strictEqual(eur.marketValue, 10);
  assert.strictEqual(eur.absoluteProfit, 0, "USD profit is not added to the EUR total");
});

test("handles an empty portfolio", () => {
  const portfolio = parsePortfolioExport(plistDocument(""), "Empty Depot");
  assert.strictEqual(portfolio.holdingCount, 0);
  assert.deepStrictEqual(portfolio.totals, []);
  assert.deepStrictEqual(portfolio.holdings, []);
});

test("rejects output that is not a property list", () => {
  assert.throws(() => parsePortfolioExport("this is not a plist", "Depot"), /Could not parse|Unexpected/);
});

test("rejects a property list without a portfolio array", () => {
  const noArray =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<plist version="1.0"><dict><key>creator</key><string>MoneyMoney</string></dict></plist>';
  assert.throws(() => parsePortfolioExport(noArray, "Depot"), /no 'portfolio' array/);
});

test("validates account_id before calling AppleScript", async () => {
  const service = new MoneyMoneyService();

  await assert.rejects(() => service.getPortfolio(""), /must not be empty/);
  await assert.rejects(() => service.getPortfolio("a".repeat(400)), /maximum length/);
  await assert.rejects(
    () => service.getPortfolio("depot" + String.fromCharCode(7)),
    /control characters/
  );
});
