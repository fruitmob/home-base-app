import assert from "node:assert/strict";
import { formatCurrency, lineTotal, round, sum, toNumber } from "@/lib/core/money";
import {
  isTerminalStage,
  nextAllowedStages,
  normalizePeriod,
  normalizeSku,
  stageOrder,
} from "@/lib/sales/normalize";
import {
  parseActivityInput,
  parseLeadInput,
  parseOpportunityInput,
  parsePricebookEntryInput,
  parsePricebookInput,
  parseProductInput,
  parseQuoteInput,
  parseQuoteLineInput,
  parseQuoteStatusInput,
  parseSalesGoalInput,
  validateQuoteNumberFormat,
} from "@/lib/sales/validators";
import { ValidationError } from "@/lib/core/validators";

function assertValidationError(callback: () => unknown, messageIncludes: string) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof ValidationError);
    assert.match(error.message, new RegExp(messageIncludes));
    return true;
  });
}

assert.equal(toNumber("19.995"), 19.995);
assert.equal(toNumber({ toNumber: () => 7.5 }), 7.5);
assert.equal(toNumber(null), 0);
assert.equal(toNumber(""), 0);

assert.equal(round(0.005, 2), 0.01);
assert.equal(round(0.125, 2), 0.13);
assert.equal(round(-0.005, 2), -0.01);

assert.equal(sum([1.1, 2.2, 3.3]), 6.6);
assert.equal(lineTotal(3, 4.995), 14.985);
assert.equal(lineTotal("2.5", "10"), 25);

assert.equal(formatCurrency(1234.5), "$1,234.50");
assert.equal(formatCurrency(0), "$0.00");

assert.equal(normalizeSku("  ab-123 "), "AB-123");
assert.equal(normalizeSku(""), null);
assert.equal(normalizePeriod("2026-04"), "2026-04");
assert.equal(normalizePeriod("2026-4"), null);
assert.equal(normalizePeriod("2026-13"), null);

assert.equal(stageOrder("NEW"), 0);
assert.equal(stageOrder("WON"), 4);
assert.equal(stageOrder("NONSENSE"), -1);
assert.equal(isTerminalStage("WON"), true);
assert.equal(isTerminalStage("NEW"), false);
assert.deepEqual(nextAllowedStages("NEW"), ["QUALIFIED", "LOST"]);
assert.deepEqual(nextAllowedStages("WON"), []);

const lead = parseLeadInput({
  companyName: "  Clearwater Transit  ",
  firstName: "Jordan",
  lastName: "Pham",
  email: "JORDAN@clearwater.example",
  phone: "(555) 100-2000",
  status: "working",
  source: "referral",
  estimatedValue: 12500,
});
assert.equal(lead.status, "WORKING");
assert.equal(lead.source, "REFERRAL");
assert.equal(lead.displayName, "Clearwater Transit");
assert.equal(lead.email, "jordan@clearwater.example");
assert.equal(lead.estimatedValue, 12500);

const opportunity = parseOpportunityInput({
  customerId: "cust_1",
  name: "Fleet Refresh",
  stage: "proposal",
  amount: "48000.00",
  probability: 60,
});
assert.equal(opportunity.stage, "PROPOSAL");
assert.equal(opportunity.amount, 48000);
assert.equal(opportunity.probability, 60);

assertValidationError(
  () => parseOpportunityInput({ customerId: "c", name: "n", probability: 150 }),
  "no more than",
);
assertValidationError(() => parseOpportunityInput({ name: "n" }), "customerId");

const activity = parseActivityInput({
  type: "call",
  subject: "Follow up on proposal",
  opportunityId: "opp_1",
});
assert.equal(activity.type, "CALL");
assert.equal(activity.status, "OPEN");
assert.equal(activity.opportunityId, "opp_1");

assertValidationError(
  () => parseActivityInput({ type: "call", subject: "Orphan" }),
  "exactly one parent",
);
assertValidationError(
  () => parseActivityInput({ type: "call", subject: "Two parents", leadId: "l", customerId: "c" }),
  "exactly one parent",
);

const product = parseProductInput({
  sku: "  eng-oil-5w30  ",
  name: "5W-30 Engine Oil",
  defaultUnitPrice: "7.99",
  taxable: true,
});
assert.equal(product.sku, "ENG-OIL-5W30");
assert.equal(product.defaultUnitPrice, 7.99);

const pricebook = parsePricebookInput({
  name: "Fleet Tier A",
  isDefault: true,
});
assert.equal(pricebook.name, "Fleet Tier A");
assert.equal(pricebook.isDefault, true);
assert.equal(pricebook.active, true);

const pricebookEntry = parsePricebookEntryInput({
  productId: "prod_1",
  unitPrice: 6.5,
});
assert.equal(pricebookEntry.productId, "prod_1");
assert.equal(pricebookEntry.unitPrice, 6.5);

const quote = parseQuoteInput({
  customerId: "cust_1",
  opportunityId: "opp_1",
  validUntil: "2026-05-30T00:00:00.000Z",
});
assert.equal(quote.customerId, "cust_1");
assert.equal(quote.opportunityId, "opp_1");
assert.equal(quote.validUntil?.toISOString(), "2026-05-30T00:00:00.000Z");

const quoteLine = parseQuoteLineInput({
  description: "Brake pad set",
  quantity: 2,
  unitPrice: "45.50",
});
assert.equal(quoteLine.quantity, 2);
assert.equal(quoteLine.unitPrice, 45.5);
assert.equal(quoteLine.lineTotal, 91);

const quoteStatus = parseQuoteStatusInput({ status: "sent", issuedAt: "2026-04-19T10:00:00.000Z" });
assert.equal(quoteStatus.status, "SENT");
assert.equal(quoteStatus.issuedAt?.toISOString(), "2026-04-19T10:00:00.000Z");

const quoteStatusDraft = parseQuoteStatusInput({ status: "draft" });
assert.equal(quoteStatusDraft.issuedAt, null);

const goal = parseSalesGoalInput({
  userId: "user_1",
  period: "2026-04",
  targetAmount: "50000",
});
assert.equal(goal.period, "2026-04");
assert.equal(goal.targetAmount, 50000);

assertValidationError(
  () => parseSalesGoalInput({ userId: "u", period: "2026-4", targetAmount: 10 }),
  "YYYY-MM",
);

assert.equal(validateQuoteNumberFormat("Q-202604-0001"), "Q-202604-0001");
assert.equal(validateQuoteNumberFormat(null), null);
assert.equal(validateQuoteNumberFormat(""), null);
assertValidationError(() => validateQuoteNumberFormat("BAD-FORMAT"), "Q-YYYYMM");

console.log("Sales normalize test: OK");
