import { db } from "@/lib/db";

const expectedTables = [
  "Activity",
  "Case",
  "Lead",
  "Opportunity",
  "Pricebook",
  "PricebookEntry",
  "Product",
  "Quote",
  "QuoteLineItem",
  "QuoteTemplate",
  "QuoteTemplateLineItem",
  "SalesGoal",
];

const expectedConstraints = [
  "Activity_exactly_one_parent_check",
  "Opportunity_probability_range_check",
];

const expectedIndexes = [
  "Pricebook_single_default_unique",
  "PricebookEntry_pricebook_product_unique",
  "SalesGoal_user_period_unique",
];

const expectedEnums = [
  "ActivityStatus",
  "ActivityType",
  "CasePriority",
  "CaseStatus",
  "LeadSource",
  "LeadStatus",
  "OpportunityStage",
  "QuoteStatus",
];

async function main() {
  const tables = await db.$queryRaw<Array<{ table_name: string }>>`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'Lead', 'Opportunity', 'Activity', 'Case', 'Product',
        'Pricebook', 'PricebookEntry', 'Quote', 'QuoteLineItem',
        'QuoteTemplate', 'QuoteTemplateLineItem', 'SalesGoal'
      )
    order by table_name
  `;
  const constraints = await db.$queryRaw<Array<{ conname: string }>>`
    select conname
    from pg_constraint
    where conname in (
      'Activity_exactly_one_parent_check',
      'Opportunity_probability_range_check'
    )
    order by conname
  `;
  const indexes = await db.$queryRaw<Array<{ indexname: string }>>`
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and indexname in (
        'Pricebook_single_default_unique',
        'PricebookEntry_pricebook_product_unique',
        'SalesGoal_user_period_unique'
      )
    order by indexname
  `;
  const enums = await db.$queryRaw<Array<{ typname: string }>>`
    select typname
    from pg_type
    where typtype = 'e'
      and typname in (
        'LeadStatus', 'LeadSource', 'OpportunityStage', 'ActivityType',
        'ActivityStatus', 'CaseStatus', 'CasePriority', 'QuoteStatus'
      )
    order by typname
  `;

  assertSet("tables", expectedTables, tables.map((row) => row.table_name));
  assertSet("constraints", expectedConstraints, constraints.map((row) => row.conname));
  assertSet("indexes", expectedIndexes, indexes.map((row) => row.indexname));
  assertSet("enums", expectedEnums, enums.map((row) => row.typname));

  const customerColumn = await db.$queryRaw<Array<{ column_name: string }>>`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'Customer'
      and column_name = 'defaultPricebookId'
  `;

  if (customerColumn.length !== 1) {
    throw new Error("Sales schema smoke test failed: Customer.defaultPricebookId missing");
  }

  console.log("Sales schema smoke test: OK");
}

function assertSet(label: string, expected: string[], actual: string[]) {
  const missing = expected.filter((item) => !actual.includes(item));

  if (missing.length > 0) {
    throw new Error(`Sales schema smoke test failed: missing ${label}: ${missing.join(", ")}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
