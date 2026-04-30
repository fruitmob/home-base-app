import { Role, type Role as RoleValue } from "@/generated/prisma/client";

export const ADMIN_ACCESS_ROLES = [
  Role.OWNER,
  Role.ADMIN,
] as const;

export const CUSTOMER_ENTITY_WRITE_ROLES = [
  Role.OWNER,
  Role.ADMIN,
  Role.MANAGER,
  Role.SERVICE_MANAGER,
  Role.SERVICE_WRITER,
  Role.SALES_MANAGER,
  Role.SALES_REP,
] as const;

export const VENDOR_WRITE_ROLES = [
  Role.OWNER,
  Role.ADMIN,
  Role.MANAGER,
  Role.SERVICE_MANAGER,
  Role.PARTS,
] as const;

export const SALES_WRITE_ROLES = [
  Role.OWNER,
  Role.ADMIN,
  Role.MANAGER,
  Role.SALES_MANAGER,
  Role.SALES_REP,
] as const;

export const CATALOG_WRITE_ROLES = [
  Role.OWNER,
  Role.ADMIN,
  Role.MANAGER,
  Role.PARTS,
] as const;

export const CASE_WRITE_ROLES = [
  Role.OWNER,
  Role.ADMIN,
  Role.MANAGER,
  Role.SERVICE_MANAGER,
  Role.SERVICE_WRITER,
  Role.SALES_MANAGER,
  Role.SALES_REP,
] as const;

export const SALES_GOAL_WRITE_ROLES = [
  Role.OWNER,
  Role.ADMIN,
  Role.MANAGER,
  Role.SALES_MANAGER,
] as const;

export const WORK_ORDER_WRITE_ROLES = [
  Role.OWNER,
  Role.ADMIN,
  Role.MANAGER,
  Role.SERVICE_MANAGER,
  Role.SERVICE_WRITER,
] as const;

export const TIME_ENTRY_WRITE_ROLES = [
  Role.OWNER,
  Role.ADMIN,
  Role.MANAGER,
  Role.SERVICE_MANAGER,
  Role.SERVICE_WRITER,
  Role.TECH,
] as const;

export const TIME_APPROVAL_ROLES = [
  Role.OWNER,
  Role.ADMIN,
  Role.MANAGER,
  Role.SERVICE_MANAGER,
] as const;

export const PARTS_INVENTORY_WRITE_ROLES = [
  Role.OWNER,
  Role.ADMIN,
  Role.MANAGER,
  Role.SERVICE_MANAGER,
  Role.PARTS,
] as const;

export const ESTIMATE_WRITE_ROLES = [
  Role.OWNER,
  Role.ADMIN,
  Role.MANAGER,
  Role.SERVICE_MANAGER,
  Role.SERVICE_WRITER,
] as const;

export const INSPECTION_WRITE_ROLES = [
  Role.OWNER,
  Role.ADMIN,
  Role.MANAGER,
  Role.SERVICE_MANAGER,
  Role.SERVICE_WRITER,
  Role.INSPECTOR,
  Role.TECH,
] as const;

export const WARRANTY_CLAIM_WRITE_ROLES = [
  Role.OWNER,
  Role.ADMIN,
  Role.MANAGER,
  Role.SERVICE_MANAGER,
] as const;

export const VIDEO_UPLOAD_ROLES = [
  Role.OWNER,
  Role.ADMIN,
  Role.MANAGER,
  Role.SERVICE_MANAGER,
  Role.SERVICE_WRITER,
  Role.TECH,
  Role.PARTS,
  Role.INSPECTOR,
] as const;

export const VIDEO_SHARE_WRITE_ROLES = [
  Role.OWNER,
  Role.ADMIN,
  Role.MANAGER,
  Role.SERVICE_MANAGER,
  Role.SERVICE_WRITER,
] as const;

export function canWriteCustomerEntities(role: RoleValue) {
  return CUSTOMER_ENTITY_WRITE_ROLES.includes(role as (typeof CUSTOMER_ENTITY_WRITE_ROLES)[number]);
}

export function canAccessAdmin(role: RoleValue) {
  return ADMIN_ACCESS_ROLES.includes(role as (typeof ADMIN_ACCESS_ROLES)[number]);
}

export function canWriteVendors(role: RoleValue) {
  return VENDOR_WRITE_ROLES.includes(role as (typeof VENDOR_WRITE_ROLES)[number]);
}

export function canWriteSales(role: RoleValue) {
  return SALES_WRITE_ROLES.includes(role as (typeof SALES_WRITE_ROLES)[number]);
}

export function canWriteCatalog(role: RoleValue) {
  return CATALOG_WRITE_ROLES.includes(role as (typeof CATALOG_WRITE_ROLES)[number]);
}

export function canWriteCases(role: RoleValue) {
  return CASE_WRITE_ROLES.includes(role as (typeof CASE_WRITE_ROLES)[number]);
}

export function canWriteSalesGoals(role: RoleValue) {
  return SALES_GOAL_WRITE_ROLES.includes(role as (typeof SALES_GOAL_WRITE_ROLES)[number]);
}

export function canWriteWorkOrders(role: RoleValue) {
  return WORK_ORDER_WRITE_ROLES.includes(role as (typeof WORK_ORDER_WRITE_ROLES)[number]);
}

export function canWriteTimeEntries(role: RoleValue) {
  return TIME_ENTRY_WRITE_ROLES.includes(role as (typeof TIME_ENTRY_WRITE_ROLES)[number]);
}

export function canApproveTimeEntries(role: RoleValue) {
  return TIME_APPROVAL_ROLES.includes(role as (typeof TIME_APPROVAL_ROLES)[number]);
}

export function canWritePartsInventory(role: RoleValue) {
  return PARTS_INVENTORY_WRITE_ROLES.includes(role as (typeof PARTS_INVENTORY_WRITE_ROLES)[number]);
}

export function canWriteEstimates(role: RoleValue) {
  return ESTIMATE_WRITE_ROLES.includes(role as (typeof ESTIMATE_WRITE_ROLES)[number]);
}

export function canWriteInspections(role: RoleValue) {
  return INSPECTION_WRITE_ROLES.includes(role as (typeof INSPECTION_WRITE_ROLES)[number]);
}

export function canWriteWarrantyClaims(role: RoleValue) {
  return WARRANTY_CLAIM_WRITE_ROLES.includes(role as (typeof WARRANTY_CLAIM_WRITE_ROLES)[number]);
}

export function canUploadVideos(role: RoleValue) {
  return VIDEO_UPLOAD_ROLES.includes(role as (typeof VIDEO_UPLOAD_ROLES)[number]);
}

export function canShareVideos(role: RoleValue) {
  return VIDEO_SHARE_WRITE_ROLES.includes(role as (typeof VIDEO_SHARE_WRITE_ROLES)[number]);
}
