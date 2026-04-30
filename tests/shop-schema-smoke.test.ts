import { db } from "@/lib/db";

const expectedTables = [
  "ArrivalInspection",
  "Bay",
  "ChangeOrder",
  "ChangeOrderLineItem",
  "Estimate",
  "EstimateLineItem",
  "InspectionItem",
  "Part",
  "PartCategory",
  "PartReservation",
  "PartTransaction",
  "TimeEntry",
  "TimeEntryEvent",
  "WarrantyClaim",
  "WoTemplate",
  "WoTemplateLineItem",
  "WorkOrder",
  "WorkOrderLineItem",
  "WorkOrderStatusHistory",
];

const expectedConstraints = [
  "ChangeOrderLineItem_amounts_nonnegative",
  "ChangeOrder_totals_nonnegative",
  "EstimateLineItem_amounts_nonnegative",
  "Estimate_totals_nonnegative",
  "PartReservation_quantity_positive",
  "Part_quantities_nonnegative",
  "TimeEntryEvent_minutesDelta_nonnegative",
  "TimeEntry_active_shape",
  "TimeEntry_ended_after_started",
  "TimeEntry_minutes_nonnegative",
  "WarrantyClaim_recovery_nonnegative",
  "WoTemplateLineItem_amounts_nonnegative",
  "WorkOrderLineItem_amounts_nonnegative",
  "WorkOrderStatusHistory_status_changed",
  "WorkOrder_odometer_nonnegative",
];

const expectedIndexes = [
  "Part_low_stock_lookup_idx",
  "TimeEntry_one_active_per_user_idx",
  "WorkOrder_active_board_idx",
];

const expectedEnums = [
  "ChangeOrderStatus",
  "EstimateStatus",
  "InspectionItemResult",
  "InspectionStatus",
  "InspectionType",
  "PartReservationStatus",
  "PartTransactionType",
  "TimeEntryEventType",
  "TimeEntryStatus",
  "TimePauseReason",
  "WarrantyClaimStatus",
  "WorkOrderLineStatus",
  "WorkOrderLineType",
  "WorkOrderPriority",
  "WorkOrderStatus",
];

async function main() {
  const tables = await db.$queryRaw<Array<{ table_name: string }>>`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'ArrivalInspection', 'Bay', 'ChangeOrder', 'ChangeOrderLineItem',
        'Estimate', 'EstimateLineItem', 'InspectionItem', 'Part',
        'PartCategory', 'PartReservation', 'PartTransaction', 'TimeEntry',
        'TimeEntryEvent', 'WarrantyClaim', 'WoTemplate', 'WoTemplateLineItem',
        'WorkOrder', 'WorkOrderLineItem', 'WorkOrderStatusHistory'
      )
    order by table_name
  `;
  const constraints = await db.$queryRaw<Array<{ conname: string }>>`
    select conname
    from pg_constraint
    where conname in (
      'ChangeOrderLineItem_amounts_nonnegative',
      'ChangeOrder_totals_nonnegative',
      'EstimateLineItem_amounts_nonnegative',
      'Estimate_totals_nonnegative',
      'PartReservation_quantity_positive',
      'Part_quantities_nonnegative',
      'TimeEntryEvent_minutesDelta_nonnegative',
      'TimeEntry_active_shape',
      'TimeEntry_ended_after_started',
      'TimeEntry_minutes_nonnegative',
      'WarrantyClaim_recovery_nonnegative',
      'WoTemplateLineItem_amounts_nonnegative',
      'WorkOrderLineItem_amounts_nonnegative',
      'WorkOrderStatusHistory_status_changed',
      'WorkOrder_odometer_nonnegative'
    )
    order by conname
  `;
  const indexes = await db.$queryRaw<Array<{ indexname: string }>>`
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and indexname in (
        'Part_low_stock_lookup_idx',
        'TimeEntry_one_active_per_user_idx',
        'WorkOrder_active_board_idx'
      )
    order by indexname
  `;
  const enums = await db.$queryRaw<Array<{ typname: string }>>`
    select typname
    from pg_type
    where typtype = 'e'
      and typname in (
        'ChangeOrderStatus', 'EstimateStatus', 'InspectionItemResult',
        'InspectionStatus', 'InspectionType', 'PartReservationStatus',
        'PartTransactionType', 'TimeEntryEventType', 'TimeEntryStatus',
        'TimePauseReason', 'WarrantyClaimStatus', 'WorkOrderLineStatus',
        'WorkOrderLineType', 'WorkOrderPriority', 'WorkOrderStatus'
      )
    order by typname
  `;

  assertSet("tables", expectedTables, tables.map((row) => row.table_name));
  assertSet("constraints", expectedConstraints, constraints.map((row) => row.conname));
  assertSet("indexes", expectedIndexes, indexes.map((row) => row.indexname));
  assertSet("enums", expectedEnums, enums.map((row) => row.typname));

  console.log("Shop schema smoke test: OK");
}

function assertSet(label: string, expected: string[], actual: string[]) {
  const missing = expected.filter((item) => !actual.includes(item));

  if (missing.length > 0) {
    throw new Error(`Shop schema smoke test failed: missing ${label}: ${missing.join(", ")}`);
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
