import { db } from "@/lib/db";

const expectedTables = [
  "Address",
  "Contact",
  "Customer",
  "Vehicle",
  "VehicleMileageReading",
  "VehicleNote",
  "Vendor",
];

const expectedConstraints = [
  "Address_exactly_one_owner_check",
  "Contact_exactly_one_owner_check",
];

const expectedIndexes = [
  "Address_customer_primary_type_unique",
  "Address_vendor_primary_type_unique",
  "Contact_customer_primary_unique",
  "Contact_vendor_primary_unique",
];

async function main() {
  const tables = await db.$queryRaw<Array<{ table_name: string }>>`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('Customer', 'Contact', 'Address', 'Vehicle', 'VehicleNote', 'VehicleMileageReading', 'Vendor')
    order by table_name
  `;
  const constraints = await db.$queryRaw<Array<{ conname: string }>>`
    select conname
    from pg_constraint
    where conname in ('Contact_exactly_one_owner_check', 'Address_exactly_one_owner_check')
    order by conname
  `;
  const indexes = await db.$queryRaw<Array<{ indexname: string }>>`
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and indexname in (
        'Contact_customer_primary_unique',
        'Contact_vendor_primary_unique',
        'Address_customer_primary_type_unique',
        'Address_vendor_primary_type_unique'
      )
    order by indexname
  `;

  assertSet("tables", expectedTables, tables.map((row) => row.table_name));
  assertSet("constraints", expectedConstraints, constraints.map((row) => row.conname));
  assertSet("indexes", expectedIndexes, indexes.map((row) => row.indexname));

  console.log("Core schema smoke test: OK");
}

function assertSet(label: string, expected: string[], actual: string[]) {
  const missing = expected.filter((item) => !actual.includes(item));

  if (missing.length > 0) {
    throw new Error(`Core schema smoke test failed: missing ${label}: ${missing.join(", ")}`);
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
