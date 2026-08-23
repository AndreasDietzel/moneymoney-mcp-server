/**
 * Tests for the MoneyMoney statement archive (src/statements.ts).
 *
 * Uses the Node built-in test runner — no extra dependencies.
 * Run with: npm test
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  parseStatementDate,
  parseAccountHint,
  matchesAccount,
  listStatements,
  getStatement,
} = require("../dist/statements");

/** Build a throwaway archive: { "Bank": ["file.pdf", ...] }. */
function buildFixture(layout) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mm-statements-"));
  for (const [bank, files] of Object.entries(layout)) {
    const bankDir = path.join(root, bank);
    fs.mkdirSync(bankDir);
    for (const file of files) {
      fs.writeFileSync(path.join(bankDir, file), "%PDF-1.4 test fixture");
    }
  }
  return root;
}

test("parses all four date formats found in real archives", () => {
  assert.strictEqual(
    parseStatementDate("Kontoauszug_1234567890_2020-05-30_0916.pdf"),
    "2020-05-30",
    "hyphenated YYYY-MM-DD"
  );
  assert.strictEqual(
    parseStatementDate("Kontoauszug_9876543210_Nr_2023_007_per_2023_08_01.pdf"),
    "2023-08-01",
    "underscored YYYY_MM_DD"
  );
  assert.strictEqual(
    parseStatementDate("Mitteilung_ueber_steigende_Sollzinssaetze_ab_01.10.2022.pdf"),
    "2022-10-01",
    "dotted DD.MM.YYYY"
  );
  assert.strictEqual(
    parseStatementDate("Ertraegnisaufstellung_20160217.pdf"),
    "2016-02-17",
    "compact YYYYMMDD"
  );
});

test("reads the date out of a 14-digit timestamp run", () => {
  assert.strictEqual(
    parseStatementDate("INV_200_003_527_551_IPP_SUTOR_DOCUMENT_20260429215022.pdf"),
    "2026-04-29"
  );
});

test("never mistakes an account or reference number for a date", () => {
  // 12-digit account number, 9-digit reference: neither is a date.
  assert.strictEqual(parseStatementDate("Kontoauszug_1234567890.pdf"), null);
  assert.strictEqual(parseStatementDate("Beleg_444555666.pdf"), null);
  assert.strictEqual(parseStatementDate("Bitte_um_Zustimmung_zu_den_Vertragsbedingungen.pdf"), null);
});

test("rejects impossible dates", () => {
  assert.strictEqual(parseStatementDate("Auszug_2021-13-05.pdf"), null, "month 13");
  assert.strictEqual(parseStatementDate("Auszug_2021-02-32.pdf"), null, "day 32");
});

test("the right-most date wins when a name carries several", () => {
  assert.strictEqual(
    parseStatementDate("Abrechnung_2019-01-01_bis_2019-12-31.pdf"),
    "2019-12-31"
  );
});

test("extracts an account hint without swallowing the date", () => {
  assert.strictEqual(
    parseAccountHint("Kontoauszug_1234567890_2020-05-30_0916.pdf"),
    "1234567890"
  );
  // Longest digit run wins: the account number, not the shorter reference number.
  assert.strictEqual(parseAccountHint("20260405_Kontoauszug_5551234567_444555666.pdf"), "5551234567");
  assert.strictEqual(parseAccountHint("Jahresuebersicht.pdf"), null);
});

test("matches an account by IBAN trailing digits", () => {
  const statement = {
    bank: "ING",
    filename: "Kontoauszug_1234567890_2020-05-30_0916.pdf",
    path: "/tmp/x.pdf",
    date: "2020-05-30",
    accountHint: "1234567890",
    size: 1,
  };
  assert.ok(matchesAccount(statement, "DE02500105171234567890"), "IBAN containing the number");
  assert.ok(matchesAccount(statement, "1234567890"), "bare account number");
  assert.ok(matchesAccount(statement, "ING"), "bank name");
  assert.ok(!matchesAccount(statement, "999888777666"), "unrelated number");
});

test("lists newest first and filters by bank", () => {
  const root = buildFixture({
    ING: ["Kontoauszug_1234567890_2020-05-30_0916.pdf", "Kontoauszug_1234567890_2021-06-30_0916.pdf"],
    DKB: ["Kontoauszug_9876543210_per_2023_08_01.pdf"],
  });

  const all = listStatements({}, root);
  assert.strictEqual(all.total, 3);
  assert.strictEqual(all.statements[0].date, "2023-08-01", "newest first");

  const ing = listStatements({ bank: "ing" }, root);
  assert.strictEqual(ing.total, 2, "bank filter is case-insensitive");
});

test("date filtering reports undated statements instead of dropping them silently", () => {
  const root = buildFixture({
    ING: [
      "Kontoauszug_1234567890_2021-06-30_0916.pdf",
      "Bitte_um_Zustimmung_zu_den_Vertragsbedingungen.pdf",
    ],
  });

  const filtered = listStatements({ since: "2021-01-01" }, root);
  assert.strictEqual(filtered.returned, 1);
  assert.strictEqual(filtered.undatedExcluded, 1, "the undated file is reported, not hidden");

  const unfiltered = listStatements({}, root);
  assert.strictEqual(unfiltered.returned, 2, "without a date filter nothing is excluded");
  assert.strictEqual(unfiltered.undatedExcluded, 0);
});

test("rejects an invalid since value", () => {
  const root = buildFixture({ ING: ["Kontoauszug_2021-06-30.pdf"] });
  assert.throws(() => listStatements({ since: "30.06.2021" }, root), /ISO date/);
});

test("honours limit", () => {
  const root = buildFixture({
    ING: ["A_2021-01-01.pdf", "B_2021-02-01.pdf", "C_2021-03-01.pdf"],
  });
  assert.strictEqual(listStatements({ limit: 2 }, root).returned, 2);
});

test("get_statement refuses path traversal", () => {
  const root = buildFixture({ ING: ["Kontoauszug_2021-06-30.pdf"] });
  assert.throws(() => getStatement("../../../etc/passwd", root), /bare file name/);
  assert.throws(() => getStatement("ING/Kontoauszug_2021-06-30.pdf", root), /bare file name/);
  assert.throws(() => getStatement("", root), /must not be empty/);
});

test("get_statement resolves a unique name and flags ambiguity", () => {
  const root = buildFixture({
    ING: ["Kontoauszug_2021-06-30.pdf"],
    DKB: ["Kontoauszug_2021-06-30.pdf", "Nur_DKB_2021-07-31.pdf"],
  });

  const unique = getStatement("Nur_DKB_2021-07-31.pdf", root);
  assert.strictEqual(unique.bank, "DKB");
  assert.ok(path.isAbsolute(unique.path));

  assert.throws(() => getStatement("Kontoauszug_2021-06-30.pdf", root), /ambiguous/);
  assert.throws(() => getStatement("Gibt_es_nicht.pdf", root), /No statement named/);
});

test("a missing archive fails with an actionable message", () => {
  assert.throws(
    () => listStatements({}, path.join(os.tmpdir(), "mm-statements-does-not-exist")),
    /Statement archive not found/
  );
});
