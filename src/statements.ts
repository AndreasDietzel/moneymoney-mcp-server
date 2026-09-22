/**
 * MoneyMoney Statement Archive
 *
 * MoneyMoney stores downloaded bank statement PDFs on disk, grouped by bank:
 *
 *   ~/Library/Containers/com.moneymoney-app.retail/Data/Library/
 *       Application Support/MoneyMoney/Statements/<Bank>/<file>.pdf
 *
 * This module indexes that archive. It is filesystem-only — no AppleScript,
 * no running MoneyMoney instance, no write access. Reading the PDF content
 * itself is left to the MCP client.
 *
 * ISO 25010 notes:
 * - Security: `getStatement()` rejects path separators and traversal segments,
 *   so a filename coming from the model can never escape the archive root.
 * - Reliability: unreadable banks/files are skipped instead of aborting the walk.
 * - Functional Suitability: statement dates are recognised in the four formats
 *   German banks actually use; files whose date cannot be derived are reported
 *   rather than silently dropped.
 *
 * Credits: exposing the statement archive over MCP is an idea taken from
 *          lukasmalkmus/moneymoney (MIT). This is an independent TypeScript
 *          implementation written against the on-disk layout.
 */

import * as fs from "fs";
import * as path from "path";

export interface Statement {
  /** Bank folder name, e.g. "Deutsche Bank". */
  bank: string;
  /** File name including extension. */
  filename: string;
  /** Absolute path on disk. */
  path: string;
  /** Statement date as ISO `YYYY-MM-DD`, or null when not derivable. */
  date: string | null;
  /** Account number / IBAN fragment found in the file name, when present. */
  accountHint: string | null;
  /** File size in bytes. */
  size: number;
}

export interface ListStatementsOptions {
  /** Case-insensitive substring match on the bank folder name. */
  bank?: string;
  /** Account reference: IBAN, account number, digit fragment, or "Bank/Prefix". */
  account?: string;
  /** Only statements dated on/after this ISO date (`YYYY-MM-DD`). */
  since?: string;
  /** Only statements dated on/before this ISO date (`YYYY-MM-DD`). */
  until?: string;
  /** Maximum number of statements to return. */
  limit?: number;
}

export interface ListStatementsResult {
  /** Archive root that was scanned. */
  root: string;
  /** Statements matching every non-date filter. */
  total: number;
  /** Statements actually returned (after date filters and limit). */
  returned: number;
  /**
   * Statements excluded *only* because a date filter was active and their date
   * could not be derived from the file name. Surfaced so date-filtered results
   * are never silently incomplete.
   */
  undatedExcluded: number;
  statements: Statement[];
}

/** Days per month, index 0 = January. February is permissive (29). */
const MAX_DAY_PER_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Location of MoneyMoney's statement archive.
 * Override with MONEYMONEY_STATEMENTS_DIR (used by the test-suite).
 */
export function defaultStatementsRoot(): string {
  const override = process.env.MONEYMONEY_STATEMENTS_DIR;
  if (override && override.trim().length > 0) {
    return path.resolve(override.trim());
  }
  return path.join(
    process.env.HOME || "",
    "Library/Containers/com.moneymoney-app.retail/Data/Library/Application Support/MoneyMoney/Statements"
  );
}

function isPlausibleDate(year: number, month: number, day: number): boolean {
  if (year < 1980 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > MAX_DAY_PER_MONTH[month - 1]) return false;
  return true;
}

function toIso(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

interface DateCandidate {
  /** Position in the file name — used to prefer the right-most date. */
  index: number;
  iso: string;
  /** Digit run the date was taken from, for compact matches only. */
  digitRun?: string;
}

/**
 * Collect every plausible date in a file name.
 *
 * Four formats occur in real archives:
 *   YYYY-MM-DD   Kontoauszug_1234567890_2020-05-30_0916.pdf
 *   YYYY_MM_DD   Kontoauszug_9876543210_Nr_2023_007_per_2023_08_01.pdf
 *   DD.MM.YYYY   Mitteilung_ueber_steigende_Sollzinssaetze_ab_01.10.2022.pdf
 *   YYYYMMDD     Ertraegnisaufstellung_20160217.pdf
 *
 * Compact dates are only read from digit runs of exactly 8 (date) or 14
 * (date + HHMMSS timestamp) characters. Longer or shorter runs are account
 * numbers and reference ids, which must never be mistaken for a date.
 */
function collectDateCandidates(filename: string): DateCandidate[] {
  const candidates: DateCandidate[] = [];

  const hyphen = /(\d{4})-(\d{2})-(\d{2})/g;
  for (let m = hyphen.exec(filename); m !== null; m = hyphen.exec(filename)) {
    const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (isPlausibleDate(year, month, day)) {
      candidates.push({ index: m.index, iso: toIso(year, month, day) });
    }
  }

  const underscore = /(\d{4})_(\d{2})_(\d{2})/g;
  for (let m = underscore.exec(filename); m !== null; m = underscore.exec(filename)) {
    const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (isPlausibleDate(year, month, day)) {
      candidates.push({ index: m.index, iso: toIso(year, month, day) });
    }
  }

  const dotted = /(\d{2})\.(\d{2})\.(\d{4})/g;
  for (let m = dotted.exec(filename); m !== null; m = dotted.exec(filename)) {
    const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (isPlausibleDate(year, month, day)) {
      candidates.push({ index: m.index, iso: toIso(year, month, day) });
    }
  }

  const digitRuns = /\d+/g;
  for (let m = digitRuns.exec(filename); m !== null; m = digitRuns.exec(filename)) {
    const run = m[0];
    if (run.length !== 8 && run.length !== 14) continue;
    const year = Number(run.slice(0, 4));
    const month = Number(run.slice(4, 6));
    const day = Number(run.slice(6, 8));
    if (isPlausibleDate(year, month, day)) {
      candidates.push({ index: m.index, iso: toIso(year, month, day), digitRun: run });
    }
  }

  return candidates.sort((a, b) => a.index - b.index);
}

/**
 * Derive the statement date from a file name.
 *
 * When a name carries several dates the right-most one wins: banks put the
 * account number first and the statement period last
 * (`Kontoauszug_9876543210_Nr_2023_007_per_2023_08_01.pdf`).
 */
export function parseStatementDate(filename: string): string | null {
  const candidates = collectDateCandidates(filename);
  if (candidates.length === 0) return null;
  return candidates[candidates.length - 1].iso;
}

/**
 * Derive an account hint (account number or IBAN fragment) from a file name:
 * the longest digit run that is not the run the date came from.
 */
export function parseAccountHint(filename: string): string | null {
  const candidates = collectDateCandidates(filename);
  const dateRun = candidates.length > 0 ? candidates[candidates.length - 1].digitRun : undefined;

  let best: string | null = null;
  const digitRuns = filename.match(/\d+/g) ?? [];
  for (const run of digitRuns) {
    if (run.length < 6) continue;
    if (dateRun !== undefined && run === dateRun) continue;
    if (best === null || run.length > best.length) best = run;
  }
  return best;
}

/** Case-insensitive substring match on the bank folder name. */
export function matchesBank(statement: Statement, needle: string): boolean {
  const trimmed = needle.trim().toLowerCase();
  if (trimmed.length === 0) return true;
  return statement.bank.toLowerCase().includes(trimmed);
}

/**
 * Match a statement against an account reference. Accepted forms:
 *   "Bank/Prefix"  — exact bank plus file-name prefix
 *   IBAN           — compared on trailing digits against the account hint
 *   account number — compared against the account hint
 *   free text      — substring of bank or file name
 */
export function matchesAccount(statement: Statement, needle: string): boolean {
  const trimmed = needle.trim();
  if (trimmed.length === 0) return true;
  const lower = trimmed.toLowerCase();

  if (trimmed.includes("/")) {
    const separator = trimmed.indexOf("/");
    const bankPart = trimmed.slice(0, separator).trim().toLowerCase();
    const namePart = trimmed.slice(separator + 1).trim().toLowerCase();
    return (
      statement.bank.toLowerCase() === bankPart &&
      statement.filename.toLowerCase().startsWith(namePart)
    );
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 4 && statement.accountHint !== null) {
    const hint = statement.accountHint;
    if (hint === digits) return true;
    if (hint.endsWith(digits)) return true;
    if (digits.endsWith(hint)) return true;
  }

  return (
    statement.filename.toLowerCase().includes(lower) ||
    statement.bank.toLowerCase().includes(lower)
  );
}

/** Walk the archive and return every statement PDF it contains. */
export function walkStatements(root: string): Statement[] {
  if (!fs.existsSync(root)) {
    throw new Error(
      `Statement archive not found at ${root}. MoneyMoney creates this folder once it has downloaded ` +
        `bank statements; set MONEYMONEY_STATEMENTS_DIR to override the location.`
    );
  }

  const statements: Statement[] = [];
  for (const bankEntry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!bankEntry.isDirectory()) continue;
    const bankDir = path.join(root, bankEntry.name);

    let files: fs.Dirent[];
    try {
      files = fs.readdirSync(bankDir, { withFileTypes: true });
    } catch {
      // Unreadable bank folder — skip it rather than failing the whole listing.
      continue;
    }

    for (const fileEntry of files) {
      if (!fileEntry.isFile()) continue;
      if (!fileEntry.name.toLowerCase().endsWith(".pdf")) continue;

      const fullPath = path.join(bankDir, fileEntry.name);
      let size = 0;
      try {
        size = fs.statSync(fullPath).size;
      } catch {
        size = 0;
      }

      statements.push({
        bank: bankEntry.name,
        filename: fileEntry.name,
        path: fullPath,
        date: parseStatementDate(fileEntry.name),
        accountHint: parseAccountHint(fileEntry.name),
        size,
      });
    }
  }
  return statements;
}

function isIsoDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (m === null) return false;
  return isPlausibleDate(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** List statements from the archive, filtered and newest first. */
export function listStatements(
  options: ListStatementsOptions = {},
  root: string = defaultStatementsRoot()
): ListStatementsResult {
  const since = options.since?.trim();
  const until = options.until?.trim();

  if (since !== undefined && since.length > 0 && !isIsoDate(since)) {
    throw new Error(`since must be an ISO date (YYYY-MM-DD), received: ${since}`);
  }
  if (until !== undefined && until.length > 0 && !isIsoDate(until)) {
    throw new Error(`until must be an ISO date (YYYY-MM-DD), received: ${until}`);
  }

  let matched = walkStatements(root);
  if (options.bank !== undefined) {
    matched = matched.filter((statement) => matchesBank(statement, options.bank as string));
  }
  if (options.account !== undefined) {
    matched = matched.filter((statement) => matchesAccount(statement, options.account as string));
  }

  const total = matched.length;
  const dateFilterActive = (since !== undefined && since.length > 0) || (until !== undefined && until.length > 0);

  let undatedExcluded = 0;
  if (dateFilterActive) {
    matched = matched.filter((statement) => {
      if (statement.date === null) {
        undatedExcluded += 1;
        return false;
      }
      if (since !== undefined && since.length > 0 && statement.date < since) return false;
      if (until !== undefined && until.length > 0 && statement.date > until) return false;
      return true;
    });
  }

  // Newest first; undated statements last; file name as a stable tie-break.
  matched.sort((a, b) => {
    if (a.date !== b.date) {
      if (a.date === null) return 1;
      if (b.date === null) return -1;
      return a.date < b.date ? 1 : -1;
    }
    return a.filename.localeCompare(b.filename);
  });

  const limit = options.limit;
  if (limit !== undefined && Number.isFinite(limit) && limit > 0) {
    matched = matched.slice(0, Math.floor(limit));
  }

  return {
    root,
    total,
    returned: matched.length,
    undatedExcluded,
    statements: matched,
  };
}

/**
 * Resolve one statement by its exact file name.
 *
 * Security: the file name must be a bare name. Path separators and traversal
 * segments are rejected, so this can only ever resolve inside the archive.
 */
export function getStatement(
  filename: string,
  root: string = defaultStatementsRoot()
): Statement {
  const trimmed = filename?.trim() ?? "";
  if (trimmed.length === 0) {
    throw new Error("filename must not be empty");
  }
  if (trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("..")) {
    throw new Error(
      "filename must be a bare file name as returned by list_statements (no path separators)"
    );
  }

  const matches = walkStatements(root).filter((statement) => statement.filename === trimmed);
  if (matches.length === 0) {
    throw new Error(`No statement named "${trimmed}" found in ${root}`);
  }
  if (matches.length > 1) {
    const banks = matches.map((statement) => statement.bank).join(", ");
    throw new Error(
      `Statement name "${trimmed}" is ambiguous — it exists for several banks: ${banks}. ` +
        `Use the "Bank/Prefix" form with list_statements to disambiguate.`
    );
  }
  return matches[0];
}
