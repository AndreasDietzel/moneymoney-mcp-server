/**
 * Tests for create_batch_transfer input validation (src/moneymoney.ts).
 *
 * These cover the rejection paths only. No test ever supplies a valid batch
 * with a matching mode, because that would hand the file to MoneyMoney and
 * open a real payment window.
 *
 * Run with: npm test
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { MoneyMoneyService } = require("../dist/moneymoney");

const service = new MoneyMoneyService();

const PAIN_001 =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03"><CstmrCdtTrfInitn/></Document>\n';
const PAIN_008 =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02"><CstmrDrctDbtInitn/></Document>\n';

function writeTemp(filename, contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mm-sepa-"));
  const target = path.join(dir, filename);
  fs.writeFileSync(target, contents);
  return target;
}

test("rejects an empty path", async () => {
  const result = await service.createBatchTransfer("");
  assert.strictEqual(result.success, false);
  assert.match(result.error, /must not be empty/);
});

test("rejects an over-long path", async () => {
  const result = await service.createBatchTransfer("/tmp/" + "a".repeat(1100) + ".xml");
  assert.strictEqual(result.success, false);
  assert.match(result.error, /maximum length/);
});

test("rejects control characters in the path", async () => {
  // Built from a char code so no raw control byte appears in this source file.
  const hostile = "/tmp/pay" + String.fromCharCode(7) + "ment.xml";
  const result = await service.createBatchTransfer(hostile);
  assert.strictEqual(result.success, false);
  assert.match(result.error, /control characters/);
});

test("rejects a missing file", async () => {
  const result = await service.createBatchTransfer(
    path.join(os.tmpdir(), "definitely-not-here-12345.xml")
  );
  assert.strictEqual(result.success, false);
  assert.match(result.error, /not found/);
});

test("rejects a directory", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mm-sepa-dir-"));
  const result = await service.createBatchTransfer(dir);
  assert.strictEqual(result.success, false);
  // A directory has no .xml suffix, so either guard is an acceptable rejection.
  assert.match(result.error, /not a file|\.xml file/);
});

test("rejects a non-xml extension", async () => {
  const target = writeTemp("payment.txt", PAIN_001);
  const result = await service.createBatchTransfer(target);
  assert.strictEqual(result.success, false);
  assert.match(result.error, /\.xml file/);
});

test("rejects a file that is not a SEPA payment instruction", async () => {
  const target = writeTemp("payment.xml", '<?xml version="1.0"?><nonsense/>');
  const result = await service.createBatchTransfer(target);
  assert.strictEqual(result.success, false);
  assert.match(result.error, /pain\.001 or pain\.008/);
});

test("refuses to load a credit transfer as a direct debit", async () => {
  const target = writeTemp("credit.xml", PAIN_001);
  const result = await service.createBatchTransfer(target, true);
  assert.strictEqual(result.success, false);
  assert.match(result.error, /credit transfer/);
});

test("refuses to load a direct debit as a credit transfer", async () => {
  const target = writeTemp("debit.xml", PAIN_008);
  const result = await service.createBatchTransfer(target, false);
  assert.strictEqual(result.success, false);
  assert.match(result.error, /direct debit/);
});

test("rejects an implausibly large batch file", async () => {
  const target = writeTemp("huge.xml", PAIN_001 + "<!-- " + "x".repeat(600 * 1024) + " -->");
  const result = await service.createBatchTransfer(target);
  assert.strictEqual(result.success, false);
  assert.match(result.error, /larger than/);
});
