-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'SERVICE_MANAGER', 'SERVICE_WRITER', 'TECH', 'PARTS', 'INSPECTOR', 'SALES_MANAGER', 'SALES_REP', 'ACCOUNTANT', 'VIEWER');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('BUSINESS', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "AddressType" AS ENUM ('BILLING', 'SERVICE', 'SHIPPING', 'MAILING', 'OTHER');

-- CreateEnum
CREATE TYPE "VendorType" AS ENUM ('PARTS', 'SERVICE', 'BOTH', 'OTHER');

-- CreateEnum
CREATE TYPE "VehicleNoteType" AS ENUM ('GENERAL', 'CONDITION', 'SERVICE_HISTORY', 'WARNING');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'WORKING', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WEB', 'PHONE', 'EMAIL', 'REFERRAL', 'WALK_IN', 'EVENT', 'OTHER');

-- CreateEnum
CREATE TYPE "OpportunityStage" AS ENUM ('NEW', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'TASK', 'NOTE');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('OPEN', 'WAITING', 'RESOLVED', 'CANCELED');

-- CreateEnum
CREATE TYPE "CasePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'ON_HOLD_PARTS', 'ON_HOLD_DELAY', 'QC', 'READY_TO_BILL', 'CLOSED');

-- CreateEnum
CREATE TYPE "WorkOrderPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "WorkOrderLineType" AS ENUM ('LABOR', 'PART', 'SUBLET', 'FEE', 'NOTE');

-- CreateEnum
CREATE TYPE "WorkOrderLineStatus" AS ENUM ('OPEN', 'APPROVED', 'IN_PROGRESS', 'COMPLETE', 'CANCELED');

-- CreateEnum
CREATE TYPE "TimeEntryStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'LOCKED');

-- CreateEnum
CREATE TYPE "TimeEntryEventType" AS ENUM ('START', 'PAUSE', 'RESUME', 'STOP', 'SUBMIT', 'APPROVE', 'REJECT', 'ADJUST', 'LOCK');

-- CreateEnum
CREATE TYPE "TimePauseReason" AS ENUM ('WAITING_PARTS', 'WAITING_CUSTOMER', 'TECH_BREAK', 'SHOP_DELAY', 'OTHER');

-- CreateEnum
CREATE TYPE "PartReservationStatus" AS ENUM ('ACTIVE', 'ISSUED', 'RELEASED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PartTransactionType" AS ENUM ('RECEIVE', 'ADJUST', 'RESERVE', 'RELEASE_RESERVATION', 'ISSUE', 'RETURN_TO_STOCK');

-- CreateEnum
CREATE TYPE "EstimateStatus" AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'DECLINED', 'EXPIRED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "ChangeOrderStatus" AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'DECLINED', 'CANCELED');

-- CreateEnum
CREATE TYPE "InspectionType" AS ENUM ('ARRIVAL', 'PDI');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('DRAFT', 'COMPLETE');

-- CreateEnum
CREATE TYPE "InspectionItemResult" AS ENUM ('PASS', 'FAIL', 'ATTENTION', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "WarrantyClaimStatus" AS ENUM ('OPEN', 'SUBMITTED', 'APPROVED', 'DENIED', 'RECOVERED', 'CLOSED');

-- CreateEnum
CREATE TYPE "GaugeMessageRole" AS ENUM ('USER', 'ASSISTANT', 'TOOL');

-- CreateEnum
CREATE TYPE "GaugeToolCallStatus" AS ENUM ('REQUESTED', 'COMPLETED', 'BLOCKED', 'FAILED');

-- CreateEnum
CREATE TYPE "GaugeRetrievalSourceType" AS ENUM ('CUSTOMER', 'VEHICLE', 'PART', 'ESTIMATE', 'CASE', 'KB_ARTICLE', 'VIDEO');

-- CreateEnum
CREATE TYPE "EmailSendStatus" AS ENUM ('QUEUED', 'SENT', 'SIMULATED', 'FAILED');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'PERMANENTLY_FAILED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'UNPAID', 'PAUSED');

-- CreateEnum
CREATE TYPE "PortalAuthorType" AS ENUM ('CUSTOMER', 'STAFF');

-- CreateEnum
CREATE TYPE "PortalUploadStatus" AS ENUM ('NEW', 'TRIAGED', 'LINKED');

-- CreateEnum
CREATE TYPE "KbArticleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "userId" TEXT NOT NULL,
    "theme" TEXT,
    "defaultLandingPage" TEXT,
    "tableDensity" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "SavedFilter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "queryJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedFilter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardLayout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "widgetOrder" JSONB NOT NULL,
    "hiddenWidgets" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardLayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WidgetPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "widgetId" TEXT NOT NULL,
    "settingsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WidgetPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "variablesJson" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSend" (
    "id" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "EmailSendStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "variablesJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "eventTypesJson" JSONB NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 6,
    "lastAttemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responseStatus" INTEGER,
    "responseBody" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "hashedKey" TEXT NOT NULL,
    "lastFour" TEXT NOT NULL,
    "scopesJson" JSONB NOT NULL,
    "createdByUserId" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKeyUsage" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKeyUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "latestEventAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "customerType" "CustomerType" NOT NULL DEFAULT 'BUSINESS',
    "displayName" TEXT NOT NULL,
    "companyName" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "taxExempt" BOOLEAN NOT NULL DEFAULT false,
    "taxExemptId" TEXT,
    "defaultPaymentTerms" TEXT,
    "isWalkIn" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "defaultPricebookId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "vendorId" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "displayName" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "vendorId" TEXT,
    "type" "AddressType" NOT NULL DEFAULT 'OTHER',
    "label" TEXT,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'US',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vin" TEXT,
    "normalizedVin" TEXT,
    "year" INTEGER,
    "make" TEXT,
    "model" TEXT,
    "trim" TEXT,
    "unitNumber" TEXT,
    "licensePlate" TEXT,
    "licenseState" TEXT,
    "currentMileage" INTEGER,
    "color" TEXT,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleNote" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "type" "VehicleNoteType" NOT NULL DEFAULT 'GENERAL',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleMileageReading" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "recordedByUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleMileageReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "vendorType" "VendorType" NOT NULL DEFAULT 'PARTS',
    "name" TEXT NOT NULL,
    "accountNumber" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "defaultPaymentTerms" TEXT,
    "taxId" TEXT,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "source" "LeadSource" NOT NULL DEFAULT 'OTHER',
    "companyName" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "interest" TEXT,
    "estimatedValue" DECIMAL(18,4),
    "notes" TEXT,
    "ownerUserId" TEXT,
    "customerId" TEXT,
    "convertedOpportunityId" TEXT,
    "convertedCustomerId" TEXT,
    "convertedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "ownerUserId" TEXT,
    "name" TEXT NOT NULL,
    "stage" "OpportunityStage" NOT NULL DEFAULT 'NEW',
    "amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "probability" INTEGER NOT NULL DEFAULT 0,
    "expectedCloseDate" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "lossReason" TEXT,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "status" "ActivityStatus" NOT NULL DEFAULT 'OPEN',
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "ownerUserId" TEXT,
    "leadId" TEXT,
    "opportunityId" TEXT,
    "customerId" TEXT,
    "vehicleId" TEXT,
    "caseId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "openedByUserId" TEXT,
    "assignedUserId" TEXT,
    "status" "CaseStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "CasePriority" NOT NULL DEFAULT 'NORMAL',
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "family" TEXT,
    "isLabor" BOOLEAN NOT NULL DEFAULT false,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "defaultUnitPrice" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "defaultCost" DECIMAL(18,4),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pricebook" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pricebook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricebookEntry" (
    "id" TEXT NOT NULL,
    "pricebookId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricebookEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentQuoteId" TEXT,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "opportunityId" TEXT,
    "pricebookId" TEXT,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedAt" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "notes" TEXT,
    "subtotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "createdByUserId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteLineItem" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "productId" TEXT,
    "sku" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "lineTotal" DECIMAL(18,4) NOT NULL,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteTemplateLineItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "productId" TEXT,
    "sku" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(18,4),
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteTemplateLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "targetAmount" DECIMAL(18,4) NOT NULL,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bay" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "workOrderNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "opportunityId" TEXT,
    "quoteId" TEXT,
    "bayId" TEXT,
    "serviceWriterUserId" TEXT,
    "assignedTechUserId" TEXT,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "WorkOrderPriority" NOT NULL DEFAULT 'NORMAL',
    "title" TEXT NOT NULL,
    "complaint" TEXT,
    "internalNotes" TEXT,
    "odometerIn" INTEGER,
    "odometerOut" INTEGER,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "promisedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderLineItem" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "productId" TEXT,
    "partId" TEXT,
    "lineType" "WorkOrderLineType" NOT NULL,
    "status" "WorkOrderLineStatus" NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(18,4),
    "lineTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrderLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderStatusHistory" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "fromStatus" "WorkOrderStatus",
    "toStatus" "WorkOrderStatus" NOT NULL,
    "changedByUserId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "lineItemId" TEXT,
    "userId" TEXT NOT NULL,
    "status" "TimeEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationMinutes" INTEGER NOT NULL DEFAULT 0,
    "billableMinutes" INTEGER NOT NULL DEFAULT 0,
    "goodwillMinutes" INTEGER NOT NULL DEFAULT 0,
    "pauseReason" "TimePauseReason",
    "note" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "lockedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntryEvent" (
    "id" TEXT NOT NULL,
    "timeEntryId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "eventType" "TimeEntryEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pauseReason" "TimePauseReason",
    "minutesDelta" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeEntryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Part" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "vendorId" TEXT,
    "categoryId" TEXT,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "manufacturer" TEXT,
    "manufacturerPartNumber" TEXT,
    "binLocation" TEXT,
    "unitOfMeasure" TEXT NOT NULL DEFAULT 'each',
    "unitCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "quantityOnHand" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "quantityReserved" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reorderPoint" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartReservation" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "lineItemId" TEXT,
    "reservedByUserId" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "status" "PartReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartTransaction" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "workOrderId" TEXT,
    "lineItemId" TEXT,
    "reservationId" TEXT,
    "vendorId" TEXT,
    "createdByUserId" TEXT,
    "type" "PartTransactionType" NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4),
    "reference" TEXT,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estimate" (
    "id" TEXT NOT NULL,
    "estimateNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "opportunityId" TEXT,
    "quoteId" TEXT,
    "convertedWorkOrderId" TEXT,
    "createdByUserId" TEXT,
    "status" "EstimateStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "subtotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "validUntil" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Estimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimateLineItem" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "productId" TEXT,
    "partId" TEXT,
    "lineType" "WorkOrderLineType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(18,4),
    "lineTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstimateLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeOrder" (
    "id" TEXT NOT NULL,
    "changeOrderNumber" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "status" "ChangeOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "reason" TEXT,
    "subtotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangeOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeOrderLineItem" (
    "id" TEXT NOT NULL,
    "changeOrderId" TEXT NOT NULL,
    "productId" TEXT,
    "partId" TEXT,
    "lineType" "WorkOrderLineType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(18,4),
    "lineTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangeOrderLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WoTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WoTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WoTemplateLineItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "productId" TEXT,
    "partId" TEXT,
    "lineType" "WorkOrderLineType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(18,4),
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WoTemplateLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArrivalInspection" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "performedByUserId" TEXT,
    "type" "InspectionType" NOT NULL DEFAULT 'ARRIVAL',
    "status" "InspectionStatus" NOT NULL DEFAULT 'DRAFT',
    "performedAt" TIMESTAMP(3),
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArrivalInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionItem" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT,
    "result" "InspectionItemResult" NOT NULL,
    "notes" TEXT,
    "photoKey" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarrantyClaim" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "sourceWorkOrderId" TEXT,
    "vendorId" TEXT,
    "caseId" TEXT,
    "status" "WarrantyClaimStatus" NOT NULL DEFAULT 'OPEN',
    "claimNumber" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "recoveryAmount" DECIMAL(18,4),
    "submittedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarrantyClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "customerId" TEXT,
    "vehicleId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalMessage" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "workOrderId" TEXT,
    "authorType" "PortalAuthorType" NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalUpload" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "workOrderId" TEXT,
    "s3Key" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "status" "PortalUploadStatus" NOT NULL DEFAULT 'NEW',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimateApproval" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signature" TEXT,

    CONSTRAINT "EstimateApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KbCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KbCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KbArticle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "categoryId" TEXT,
    "authorId" TEXT NOT NULL,
    "status" "KbArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KbArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KbArticleVersion" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "editedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KbArticleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KbAttachment" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KbAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingAssignment" (
    "id" TEXT NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingCompletion" (
    "assignmentId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingCompletion_pkey" PRIMARY KEY ("assignmentId")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "cloudflareId" TEXT NOT NULL,
    "status" "VideoStatus" NOT NULL DEFAULT 'UPLOADING',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "durationSeconds" INTEGER,
    "thumbnailUrl" TEXT,
    "uploadedByUserId" TEXT NOT NULL,
    "workOrderId" TEXT,
    "vehicleId" TEXT,
    "customerId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoShareLink" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GaugeConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GaugeConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GaugeMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "GaugeMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "toolName" TEXT,
    "toolInputJson" JSONB,
    "toolOutputJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GaugeMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GaugeToolCall" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT,
    "userId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "status" "GaugeToolCallStatus" NOT NULL DEFAULT 'REQUESTED',
    "inputJson" JSONB NOT NULL,
    "outputJson" JSONB,
    "error" TEXT,
    "writeRequested" BOOLEAN NOT NULL DEFAULT false,
    "writePerformed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "GaugeToolCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Impersonation" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Impersonation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GaugeRetrievalIndex" (
    "id" TEXT NOT NULL,
    "sourceType" "GaugeRetrievalSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT NOT NULL,
    "href" TEXT,
    "metadata" JSONB,
    "sourceUpdatedAt" TIMESTAMP(3),
    "indexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GaugeRetrievalIndex_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "SavedFilter_userId_scope_idx" ON "SavedFilter"("userId", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "SavedFilter_userId_scope_name_key" ON "SavedFilter"("userId", "scope", "name");

-- CreateIndex
CREATE INDEX "DashboardLayout_userId_idx" ON "DashboardLayout"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardLayout_userId_scope_key" ON "DashboardLayout"("userId", "scope");

-- CreateIndex
CREATE INDEX "WidgetPreference_userId_idx" ON "WidgetPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WidgetPreference_userId_widgetId_key" ON "WidgetPreference"("userId", "widgetId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_key_key" ON "EmailTemplate"("key");

-- CreateIndex
CREATE INDEX "EmailTemplate_deletedAt_idx" ON "EmailTemplate"("deletedAt");

-- CreateIndex
CREATE INDEX "EmailSend_templateKey_createdAt_idx" ON "EmailSend"("templateKey", "createdAt");

-- CreateIndex
CREATE INDEX "EmailSend_recipientEmail_createdAt_idx" ON "EmailSend"("recipientEmail", "createdAt");

-- CreateIndex
CREATE INDEX "EmailSend_status_idx" ON "EmailSend"("status");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_enabled_idx" ON "WebhookEndpoint"("enabled");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_deletedAt_idx" ON "WebhookEndpoint"("deletedAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_endpointId_createdAt_idx" ON "WebhookDelivery"("endpointId", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_status_nextAttemptAt_idx" ON "WebhookDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_eventType_createdAt_idx" ON "WebhookDelivery"("eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_hashedKey_key" ON "ApiKey"("hashedKey");

-- CreateIndex
CREATE INDEX "ApiKey_revokedAt_idx" ON "ApiKey"("revokedAt");

-- CreateIndex
CREATE INDEX "ApiKey_createdByUserId_idx" ON "ApiKey"("createdByUserId");

-- CreateIndex
CREATE INDEX "ApiKeyUsage_windowStart_idx" ON "ApiKeyUsage"("windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKeyUsage_apiKeyId_windowStart_key" ON "ApiKeyUsage"("apiKeyId", "windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_stripeCustomerId_idx" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingEvent_stripeEventId_key" ON "BillingEvent"("stripeEventId");

-- CreateIndex
CREATE INDEX "BillingEvent_eventType_receivedAt_idx" ON "BillingEvent"("eventType", "receivedAt");

-- CreateIndex
CREATE INDEX "Customer_displayName_idx" ON "Customer"("displayName");

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_defaultPricebookId_idx" ON "Customer"("defaultPricebookId");

-- CreateIndex
CREATE INDEX "Customer_deletedAt_idx" ON "Customer"("deletedAt");

-- CreateIndex
CREATE INDEX "Contact_customerId_idx" ON "Contact"("customerId");

-- CreateIndex
CREATE INDEX "Contact_vendorId_idx" ON "Contact"("vendorId");

-- CreateIndex
CREATE INDEX "Contact_email_idx" ON "Contact"("email");

-- CreateIndex
CREATE INDEX "Contact_phone_idx" ON "Contact"("phone");

-- CreateIndex
CREATE INDEX "Contact_deletedAt_idx" ON "Contact"("deletedAt");

-- CreateIndex
CREATE INDEX "Address_customerId_idx" ON "Address"("customerId");

-- CreateIndex
CREATE INDEX "Address_vendorId_idx" ON "Address"("vendorId");

-- CreateIndex
CREATE INDEX "Address_type_idx" ON "Address"("type");

-- CreateIndex
CREATE INDEX "Address_deletedAt_idx" ON "Address"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_normalizedVin_key" ON "Vehicle"("normalizedVin");

-- CreateIndex
CREATE INDEX "Vehicle_customerId_idx" ON "Vehicle"("customerId");

-- CreateIndex
CREATE INDEX "Vehicle_unitNumber_idx" ON "Vehicle"("unitNumber");

-- CreateIndex
CREATE INDEX "Vehicle_licensePlate_idx" ON "Vehicle"("licensePlate");

-- CreateIndex
CREATE INDEX "Vehicle_deletedAt_idx" ON "Vehicle"("deletedAt");

-- CreateIndex
CREATE INDEX "VehicleNote_vehicleId_idx" ON "VehicleNote"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleNote_authorUserId_idx" ON "VehicleNote"("authorUserId");

-- CreateIndex
CREATE INDEX "VehicleNote_createdAt_idx" ON "VehicleNote"("createdAt");

-- CreateIndex
CREATE INDEX "VehicleMileageReading_vehicleId_idx" ON "VehicleMileageReading"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleMileageReading_recordedByUserId_idx" ON "VehicleMileageReading"("recordedByUserId");

-- CreateIndex
CREATE INDEX "VehicleMileageReading_recordedAt_idx" ON "VehicleMileageReading"("recordedAt");

-- CreateIndex
CREATE INDEX "Vendor_name_idx" ON "Vendor"("name");

-- CreateIndex
CREATE INDEX "Vendor_email_idx" ON "Vendor"("email");

-- CreateIndex
CREATE INDEX "Vendor_phone_idx" ON "Vendor"("phone");

-- CreateIndex
CREATE INDEX "Vendor_deletedAt_idx" ON "Vendor"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_convertedOpportunityId_key" ON "Lead"("convertedOpportunityId");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_source_idx" ON "Lead"("source");

-- CreateIndex
CREATE INDEX "Lead_ownerUserId_idx" ON "Lead"("ownerUserId");

-- CreateIndex
CREATE INDEX "Lead_customerId_idx" ON "Lead"("customerId");

-- CreateIndex
CREATE INDEX "Lead_deletedAt_idx" ON "Lead"("deletedAt");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE INDEX "Opportunity_customerId_idx" ON "Opportunity"("customerId");

-- CreateIndex
CREATE INDEX "Opportunity_ownerUserId_idx" ON "Opportunity"("ownerUserId");

-- CreateIndex
CREATE INDEX "Opportunity_stage_idx" ON "Opportunity"("stage");

-- CreateIndex
CREATE INDEX "Opportunity_expectedCloseDate_idx" ON "Opportunity"("expectedCloseDate");

-- CreateIndex
CREATE INDEX "Opportunity_closedAt_idx" ON "Opportunity"("closedAt");

-- CreateIndex
CREATE INDEX "Opportunity_deletedAt_idx" ON "Opportunity"("deletedAt");

-- CreateIndex
CREATE INDEX "Activity_ownerUserId_idx" ON "Activity"("ownerUserId");

-- CreateIndex
CREATE INDEX "Activity_leadId_idx" ON "Activity"("leadId");

-- CreateIndex
CREATE INDEX "Activity_opportunityId_idx" ON "Activity"("opportunityId");

-- CreateIndex
CREATE INDEX "Activity_customerId_idx" ON "Activity"("customerId");

-- CreateIndex
CREATE INDEX "Activity_vehicleId_idx" ON "Activity"("vehicleId");

-- CreateIndex
CREATE INDEX "Activity_caseId_idx" ON "Activity"("caseId");

-- CreateIndex
CREATE INDEX "Activity_dueAt_idx" ON "Activity"("dueAt");

-- CreateIndex
CREATE INDEX "Activity_status_idx" ON "Activity"("status");

-- CreateIndex
CREATE INDEX "Activity_deletedAt_idx" ON "Activity"("deletedAt");

-- CreateIndex
CREATE INDEX "Case_customerId_idx" ON "Case"("customerId");

-- CreateIndex
CREATE INDEX "Case_vehicleId_idx" ON "Case"("vehicleId");

-- CreateIndex
CREATE INDEX "Case_assignedUserId_idx" ON "Case"("assignedUserId");

-- CreateIndex
CREATE INDEX "Case_status_idx" ON "Case"("status");

-- CreateIndex
CREATE INDEX "Case_priority_idx" ON "Case"("priority");

-- CreateIndex
CREATE INDEX "Case_deletedAt_idx" ON "Case"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_family_idx" ON "Product"("family");

-- CreateIndex
CREATE INDEX "Product_active_idx" ON "Product"("active");

-- CreateIndex
CREATE INDEX "Product_deletedAt_idx" ON "Product"("deletedAt");

-- CreateIndex
CREATE INDEX "Pricebook_isDefault_idx" ON "Pricebook"("isDefault");

-- CreateIndex
CREATE INDEX "Pricebook_active_idx" ON "Pricebook"("active");

-- CreateIndex
CREATE INDEX "Pricebook_deletedAt_idx" ON "Pricebook"("deletedAt");

-- CreateIndex
CREATE INDEX "PricebookEntry_pricebookId_idx" ON "PricebookEntry"("pricebookId");

-- CreateIndex
CREATE INDEX "PricebookEntry_productId_idx" ON "PricebookEntry"("productId");

-- CreateIndex
CREATE INDEX "PricebookEntry_deletedAt_idx" ON "PricebookEntry"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_quoteNumber_key" ON "Quote"("quoteNumber");

-- CreateIndex
CREATE INDEX "Quote_customerId_idx" ON "Quote"("customerId");

-- CreateIndex
CREATE INDEX "Quote_opportunityId_idx" ON "Quote"("opportunityId");

-- CreateIndex
CREATE INDEX "Quote_status_idx" ON "Quote"("status");

-- CreateIndex
CREATE INDEX "Quote_issuedAt_idx" ON "Quote"("issuedAt");

-- CreateIndex
CREATE INDEX "Quote_parentQuoteId_idx" ON "Quote"("parentQuoteId");

-- CreateIndex
CREATE INDEX "Quote_deletedAt_idx" ON "Quote"("deletedAt");

-- CreateIndex
CREATE INDEX "QuoteLineItem_quoteId_idx" ON "QuoteLineItem"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteLineItem_productId_idx" ON "QuoteLineItem"("productId");

-- CreateIndex
CREATE INDEX "QuoteLineItem_displayOrder_idx" ON "QuoteLineItem"("displayOrder");

-- CreateIndex
CREATE INDEX "QuoteTemplate_name_idx" ON "QuoteTemplate"("name");

-- CreateIndex
CREATE INDEX "QuoteTemplate_active_idx" ON "QuoteTemplate"("active");

-- CreateIndex
CREATE INDEX "QuoteTemplate_deletedAt_idx" ON "QuoteTemplate"("deletedAt");

-- CreateIndex
CREATE INDEX "QuoteTemplateLineItem_templateId_idx" ON "QuoteTemplateLineItem"("templateId");

-- CreateIndex
CREATE INDEX "QuoteTemplateLineItem_displayOrder_idx" ON "QuoteTemplateLineItem"("displayOrder");

-- CreateIndex
CREATE INDEX "SalesGoal_userId_idx" ON "SalesGoal"("userId");

-- CreateIndex
CREATE INDEX "SalesGoal_period_idx" ON "SalesGoal"("period");

-- CreateIndex
CREATE INDEX "SalesGoal_deletedAt_idx" ON "SalesGoal"("deletedAt");

-- CreateIndex
CREATE INDEX "Bay_active_idx" ON "Bay"("active");

-- CreateIndex
CREATE INDEX "Bay_sortOrder_idx" ON "Bay"("sortOrder");

-- CreateIndex
CREATE INDEX "Bay_deletedAt_idx" ON "Bay"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_workOrderNumber_key" ON "WorkOrder"("workOrderNumber");

-- CreateIndex
CREATE INDEX "WorkOrder_customerId_idx" ON "WorkOrder"("customerId");

-- CreateIndex
CREATE INDEX "WorkOrder_vehicleId_idx" ON "WorkOrder"("vehicleId");

-- CreateIndex
CREATE INDEX "WorkOrder_opportunityId_idx" ON "WorkOrder"("opportunityId");

-- CreateIndex
CREATE INDEX "WorkOrder_quoteId_idx" ON "WorkOrder"("quoteId");

-- CreateIndex
CREATE INDEX "WorkOrder_bayId_idx" ON "WorkOrder"("bayId");

-- CreateIndex
CREATE INDEX "WorkOrder_serviceWriterUserId_idx" ON "WorkOrder"("serviceWriterUserId");

-- CreateIndex
CREATE INDEX "WorkOrder_assignedTechUserId_idx" ON "WorkOrder"("assignedTechUserId");

-- CreateIndex
CREATE INDEX "WorkOrder_status_idx" ON "WorkOrder"("status");

-- CreateIndex
CREATE INDEX "WorkOrder_priority_idx" ON "WorkOrder"("priority");

-- CreateIndex
CREATE INDEX "WorkOrder_promisedAt_idx" ON "WorkOrder"("promisedAt");

-- CreateIndex
CREATE INDEX "WorkOrder_closedAt_idx" ON "WorkOrder"("closedAt");

-- CreateIndex
CREATE INDEX "WorkOrder_deletedAt_idx" ON "WorkOrder"("deletedAt");

-- CreateIndex
CREATE INDEX "WorkOrderLineItem_workOrderId_idx" ON "WorkOrderLineItem"("workOrderId");

-- CreateIndex
CREATE INDEX "WorkOrderLineItem_productId_idx" ON "WorkOrderLineItem"("productId");

-- CreateIndex
CREATE INDEX "WorkOrderLineItem_partId_idx" ON "WorkOrderLineItem"("partId");

-- CreateIndex
CREATE INDEX "WorkOrderLineItem_lineType_idx" ON "WorkOrderLineItem"("lineType");

-- CreateIndex
CREATE INDEX "WorkOrderLineItem_status_idx" ON "WorkOrderLineItem"("status");

-- CreateIndex
CREATE INDEX "WorkOrderLineItem_displayOrder_idx" ON "WorkOrderLineItem"("displayOrder");

-- CreateIndex
CREATE INDEX "WorkOrderLineItem_deletedAt_idx" ON "WorkOrderLineItem"("deletedAt");

-- CreateIndex
CREATE INDEX "WorkOrderStatusHistory_workOrderId_idx" ON "WorkOrderStatusHistory"("workOrderId");

-- CreateIndex
CREATE INDEX "WorkOrderStatusHistory_changedByUserId_idx" ON "WorkOrderStatusHistory"("changedByUserId");

-- CreateIndex
CREATE INDEX "WorkOrderStatusHistory_toStatus_idx" ON "WorkOrderStatusHistory"("toStatus");

-- CreateIndex
CREATE INDEX "WorkOrderStatusHistory_createdAt_idx" ON "WorkOrderStatusHistory"("createdAt");

-- CreateIndex
CREATE INDEX "TimeEntry_workOrderId_idx" ON "TimeEntry"("workOrderId");

-- CreateIndex
CREATE INDEX "TimeEntry_lineItemId_idx" ON "TimeEntry"("lineItemId");

-- CreateIndex
CREATE INDEX "TimeEntry_userId_idx" ON "TimeEntry"("userId");

-- CreateIndex
CREATE INDEX "TimeEntry_approvedByUserId_idx" ON "TimeEntry"("approvedByUserId");

-- CreateIndex
CREATE INDEX "TimeEntry_status_idx" ON "TimeEntry"("status");

-- CreateIndex
CREATE INDEX "TimeEntry_active_idx" ON "TimeEntry"("active");

-- CreateIndex
CREATE INDEX "TimeEntry_startedAt_idx" ON "TimeEntry"("startedAt");

-- CreateIndex
CREATE INDEX "TimeEntry_submittedAt_idx" ON "TimeEntry"("submittedAt");

-- CreateIndex
CREATE INDEX "TimeEntry_approvedAt_idx" ON "TimeEntry"("approvedAt");

-- CreateIndex
CREATE INDEX "TimeEntry_deletedAt_idx" ON "TimeEntry"("deletedAt");

-- CreateIndex
CREATE INDEX "TimeEntryEvent_timeEntryId_idx" ON "TimeEntryEvent"("timeEntryId");

-- CreateIndex
CREATE INDEX "TimeEntryEvent_workOrderId_idx" ON "TimeEntryEvent"("workOrderId");

-- CreateIndex
CREATE INDEX "TimeEntryEvent_userId_idx" ON "TimeEntryEvent"("userId");

-- CreateIndex
CREATE INDEX "TimeEntryEvent_createdByUserId_idx" ON "TimeEntryEvent"("createdByUserId");

-- CreateIndex
CREATE INDEX "TimeEntryEvent_eventType_idx" ON "TimeEntryEvent"("eventType");

-- CreateIndex
CREATE INDEX "TimeEntryEvent_occurredAt_idx" ON "TimeEntryEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "PartCategory_name_idx" ON "PartCategory"("name");

-- CreateIndex
CREATE INDEX "PartCategory_deletedAt_idx" ON "PartCategory"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Part_productId_key" ON "Part"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Part_sku_key" ON "Part"("sku");

-- CreateIndex
CREATE INDEX "Part_vendorId_idx" ON "Part"("vendorId");

-- CreateIndex
CREATE INDEX "Part_categoryId_idx" ON "Part"("categoryId");

-- CreateIndex
CREATE INDEX "Part_name_idx" ON "Part"("name");

-- CreateIndex
CREATE INDEX "Part_manufacturerPartNumber_idx" ON "Part"("manufacturerPartNumber");

-- CreateIndex
CREATE INDEX "Part_binLocation_idx" ON "Part"("binLocation");

-- CreateIndex
CREATE INDEX "Part_active_idx" ON "Part"("active");

-- CreateIndex
CREATE INDEX "Part_deletedAt_idx" ON "Part"("deletedAt");

-- CreateIndex
CREATE INDEX "PartReservation_partId_idx" ON "PartReservation"("partId");

-- CreateIndex
CREATE INDEX "PartReservation_workOrderId_idx" ON "PartReservation"("workOrderId");

-- CreateIndex
CREATE INDEX "PartReservation_lineItemId_idx" ON "PartReservation"("lineItemId");

-- CreateIndex
CREATE INDEX "PartReservation_reservedByUserId_idx" ON "PartReservation"("reservedByUserId");

-- CreateIndex
CREATE INDEX "PartReservation_status_idx" ON "PartReservation"("status");

-- CreateIndex
CREATE INDEX "PartReservation_reservedAt_idx" ON "PartReservation"("reservedAt");

-- CreateIndex
CREATE INDEX "PartReservation_deletedAt_idx" ON "PartReservation"("deletedAt");

-- CreateIndex
CREATE INDEX "PartTransaction_partId_idx" ON "PartTransaction"("partId");

-- CreateIndex
CREATE INDEX "PartTransaction_workOrderId_idx" ON "PartTransaction"("workOrderId");

-- CreateIndex
CREATE INDEX "PartTransaction_lineItemId_idx" ON "PartTransaction"("lineItemId");

-- CreateIndex
CREATE INDEX "PartTransaction_reservationId_idx" ON "PartTransaction"("reservationId");

-- CreateIndex
CREATE INDEX "PartTransaction_vendorId_idx" ON "PartTransaction"("vendorId");

-- CreateIndex
CREATE INDEX "PartTransaction_createdByUserId_idx" ON "PartTransaction"("createdByUserId");

-- CreateIndex
CREATE INDEX "PartTransaction_type_idx" ON "PartTransaction"("type");

-- CreateIndex
CREATE INDEX "PartTransaction_occurredAt_idx" ON "PartTransaction"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Estimate_estimateNumber_key" ON "Estimate"("estimateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Estimate_convertedWorkOrderId_key" ON "Estimate"("convertedWorkOrderId");

-- CreateIndex
CREATE INDEX "Estimate_customerId_idx" ON "Estimate"("customerId");

-- CreateIndex
CREATE INDEX "Estimate_vehicleId_idx" ON "Estimate"("vehicleId");

-- CreateIndex
CREATE INDEX "Estimate_opportunityId_idx" ON "Estimate"("opportunityId");

-- CreateIndex
CREATE INDEX "Estimate_quoteId_idx" ON "Estimate"("quoteId");

-- CreateIndex
CREATE INDEX "Estimate_createdByUserId_idx" ON "Estimate"("createdByUserId");

-- CreateIndex
CREATE INDEX "Estimate_status_idx" ON "Estimate"("status");

-- CreateIndex
CREATE INDEX "Estimate_sentAt_idx" ON "Estimate"("sentAt");

-- CreateIndex
CREATE INDEX "Estimate_approvedAt_idx" ON "Estimate"("approvedAt");

-- CreateIndex
CREATE INDEX "Estimate_deletedAt_idx" ON "Estimate"("deletedAt");

-- CreateIndex
CREATE INDEX "EstimateLineItem_estimateId_idx" ON "EstimateLineItem"("estimateId");

-- CreateIndex
CREATE INDEX "EstimateLineItem_productId_idx" ON "EstimateLineItem"("productId");

-- CreateIndex
CREATE INDEX "EstimateLineItem_partId_idx" ON "EstimateLineItem"("partId");

-- CreateIndex
CREATE INDEX "EstimateLineItem_lineType_idx" ON "EstimateLineItem"("lineType");

-- CreateIndex
CREATE INDEX "EstimateLineItem_displayOrder_idx" ON "EstimateLineItem"("displayOrder");

-- CreateIndex
CREATE INDEX "EstimateLineItem_deletedAt_idx" ON "EstimateLineItem"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChangeOrder_changeOrderNumber_key" ON "ChangeOrder"("changeOrderNumber");

-- CreateIndex
CREATE INDEX "ChangeOrder_workOrderId_idx" ON "ChangeOrder"("workOrderId");

-- CreateIndex
CREATE INDEX "ChangeOrder_requestedByUserId_idx" ON "ChangeOrder"("requestedByUserId");

-- CreateIndex
CREATE INDEX "ChangeOrder_status_idx" ON "ChangeOrder"("status");

-- CreateIndex
CREATE INDEX "ChangeOrder_sentAt_idx" ON "ChangeOrder"("sentAt");

-- CreateIndex
CREATE INDEX "ChangeOrder_approvedAt_idx" ON "ChangeOrder"("approvedAt");

-- CreateIndex
CREATE INDEX "ChangeOrder_deletedAt_idx" ON "ChangeOrder"("deletedAt");

-- CreateIndex
CREATE INDEX "ChangeOrderLineItem_changeOrderId_idx" ON "ChangeOrderLineItem"("changeOrderId");

-- CreateIndex
CREATE INDEX "ChangeOrderLineItem_productId_idx" ON "ChangeOrderLineItem"("productId");

-- CreateIndex
CREATE INDEX "ChangeOrderLineItem_partId_idx" ON "ChangeOrderLineItem"("partId");

-- CreateIndex
CREATE INDEX "ChangeOrderLineItem_lineType_idx" ON "ChangeOrderLineItem"("lineType");

-- CreateIndex
CREATE INDEX "ChangeOrderLineItem_displayOrder_idx" ON "ChangeOrderLineItem"("displayOrder");

-- CreateIndex
CREATE INDEX "ChangeOrderLineItem_deletedAt_idx" ON "ChangeOrderLineItem"("deletedAt");

-- CreateIndex
CREATE INDEX "WoTemplate_name_idx" ON "WoTemplate"("name");

-- CreateIndex
CREATE INDEX "WoTemplate_active_idx" ON "WoTemplate"("active");

-- CreateIndex
CREATE INDEX "WoTemplate_deletedAt_idx" ON "WoTemplate"("deletedAt");

-- CreateIndex
CREATE INDEX "WoTemplateLineItem_templateId_idx" ON "WoTemplateLineItem"("templateId");

-- CreateIndex
CREATE INDEX "WoTemplateLineItem_productId_idx" ON "WoTemplateLineItem"("productId");

-- CreateIndex
CREATE INDEX "WoTemplateLineItem_partId_idx" ON "WoTemplateLineItem"("partId");

-- CreateIndex
CREATE INDEX "WoTemplateLineItem_displayOrder_idx" ON "WoTemplateLineItem"("displayOrder");

-- CreateIndex
CREATE INDEX "ArrivalInspection_workOrderId_idx" ON "ArrivalInspection"("workOrderId");

-- CreateIndex
CREATE INDEX "ArrivalInspection_customerId_idx" ON "ArrivalInspection"("customerId");

-- CreateIndex
CREATE INDEX "ArrivalInspection_vehicleId_idx" ON "ArrivalInspection"("vehicleId");

-- CreateIndex
CREATE INDEX "ArrivalInspection_performedByUserId_idx" ON "ArrivalInspection"("performedByUserId");

-- CreateIndex
CREATE INDEX "ArrivalInspection_type_idx" ON "ArrivalInspection"("type");

-- CreateIndex
CREATE INDEX "ArrivalInspection_status_idx" ON "ArrivalInspection"("status");

-- CreateIndex
CREATE INDEX "ArrivalInspection_performedAt_idx" ON "ArrivalInspection"("performedAt");

-- CreateIndex
CREATE INDEX "ArrivalInspection_deletedAt_idx" ON "ArrivalInspection"("deletedAt");

-- CreateIndex
CREATE INDEX "InspectionItem_inspectionId_idx" ON "InspectionItem"("inspectionId");

-- CreateIndex
CREATE INDEX "InspectionItem_result_idx" ON "InspectionItem"("result");

-- CreateIndex
CREATE INDEX "InspectionItem_displayOrder_idx" ON "InspectionItem"("displayOrder");

-- CreateIndex
CREATE INDEX "WarrantyClaim_workOrderId_idx" ON "WarrantyClaim"("workOrderId");

-- CreateIndex
CREATE INDEX "WarrantyClaim_sourceWorkOrderId_idx" ON "WarrantyClaim"("sourceWorkOrderId");

-- CreateIndex
CREATE INDEX "WarrantyClaim_vendorId_idx" ON "WarrantyClaim"("vendorId");

-- CreateIndex
CREATE INDEX "WarrantyClaim_caseId_idx" ON "WarrantyClaim"("caseId");

-- CreateIndex
CREATE INDEX "WarrantyClaim_status_idx" ON "WarrantyClaim"("status");

-- CreateIndex
CREATE INDEX "WarrantyClaim_submittedAt_idx" ON "WarrantyClaim"("submittedAt");

-- CreateIndex
CREATE INDEX "WarrantyClaim_resolvedAt_idx" ON "WarrantyClaim"("resolvedAt");

-- CreateIndex
CREATE INDEX "WarrantyClaim_deletedAt_idx" ON "WarrantyClaim"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PortalToken_token_key" ON "PortalToken"("token");

-- CreateIndex
CREATE INDEX "PortalToken_token_idx" ON "PortalToken"("token");

-- CreateIndex
CREATE INDEX "PortalToken_customerId_idx" ON "PortalToken"("customerId");

-- CreateIndex
CREATE INDEX "PortalToken_vehicleId_idx" ON "PortalToken"("vehicleId");

-- CreateIndex
CREATE INDEX "PortalToken_expiresAt_idx" ON "PortalToken"("expiresAt");

-- CreateIndex
CREATE INDEX "PortalMessage_customerId_idx" ON "PortalMessage"("customerId");

-- CreateIndex
CREATE INDEX "PortalMessage_workOrderId_idx" ON "PortalMessage"("workOrderId");

-- CreateIndex
CREATE INDEX "PortalMessage_createdAt_idx" ON "PortalMessage"("createdAt");

-- CreateIndex
CREATE INDEX "PortalUpload_customerId_idx" ON "PortalUpload"("customerId");

-- CreateIndex
CREATE INDEX "PortalUpload_workOrderId_idx" ON "PortalUpload"("workOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "EstimateApproval_estimateId_key" ON "EstimateApproval"("estimateId");

-- CreateIndex
CREATE UNIQUE INDEX "KbArticle_slug_key" ON "KbArticle"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Video_cloudflareId_key" ON "Video"("cloudflareId");

-- CreateIndex
CREATE INDEX "Video_cloudflareId_idx" ON "Video"("cloudflareId");

-- CreateIndex
CREATE INDEX "Video_workOrderId_idx" ON "Video"("workOrderId");

-- CreateIndex
CREATE INDEX "Video_vehicleId_idx" ON "Video"("vehicleId");

-- CreateIndex
CREATE INDEX "Video_customerId_idx" ON "Video"("customerId");

-- CreateIndex
CREATE INDEX "Video_uploadedByUserId_idx" ON "Video"("uploadedByUserId");

-- CreateIndex
CREATE INDEX "Video_deletedAt_idx" ON "Video"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VideoShareLink_token_key" ON "VideoShareLink"("token");

-- CreateIndex
CREATE INDEX "VideoShareLink_videoId_idx" ON "VideoShareLink"("videoId");

-- CreateIndex
CREATE INDEX "VideoShareLink_token_idx" ON "VideoShareLink"("token");

-- CreateIndex
CREATE INDEX "GaugeConversation_userId_idx" ON "GaugeConversation"("userId");

-- CreateIndex
CREATE INDEX "GaugeConversation_archivedAt_idx" ON "GaugeConversation"("archivedAt");

-- CreateIndex
CREATE INDEX "GaugeConversation_createdAt_idx" ON "GaugeConversation"("createdAt");

-- CreateIndex
CREATE INDEX "GaugeMessage_conversationId_idx" ON "GaugeMessage"("conversationId");

-- CreateIndex
CREATE INDEX "GaugeMessage_role_idx" ON "GaugeMessage"("role");

-- CreateIndex
CREATE INDEX "GaugeMessage_createdAt_idx" ON "GaugeMessage"("createdAt");

-- CreateIndex
CREATE INDEX "GaugeToolCall_conversationId_idx" ON "GaugeToolCall"("conversationId");

-- CreateIndex
CREATE INDEX "GaugeToolCall_messageId_idx" ON "GaugeToolCall"("messageId");

-- CreateIndex
CREATE INDEX "GaugeToolCall_userId_idx" ON "GaugeToolCall"("userId");

-- CreateIndex
CREATE INDEX "GaugeToolCall_toolName_idx" ON "GaugeToolCall"("toolName");

-- CreateIndex
CREATE INDEX "GaugeToolCall_status_idx" ON "GaugeToolCall"("status");

-- CreateIndex
CREATE INDEX "GaugeToolCall_createdAt_idx" ON "GaugeToolCall"("createdAt");

-- CreateIndex
CREATE INDEX "Impersonation_actorUserId_idx" ON "Impersonation"("actorUserId");

-- CreateIndex
CREATE INDEX "Impersonation_targetUserId_idx" ON "Impersonation"("targetUserId");

-- CreateIndex
CREATE INDEX "Impersonation_endedAt_idx" ON "Impersonation"("endedAt");

-- CreateIndex
CREATE INDEX "Impersonation_startedAt_idx" ON "Impersonation"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "FeatureFlag_key_idx" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "FeatureFlag_enabled_idx" ON "FeatureFlag"("enabled");

-- CreateIndex
CREATE INDEX "GaugeRetrievalIndex_sourceType_idx" ON "GaugeRetrievalIndex"("sourceType");

-- CreateIndex
CREATE INDEX "GaugeRetrievalIndex_sourceUpdatedAt_idx" ON "GaugeRetrievalIndex"("sourceUpdatedAt");

-- CreateIndex
CREATE INDEX "GaugeRetrievalIndex_indexedAt_idx" ON "GaugeRetrievalIndex"("indexedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GaugeRetrievalIndex_sourceType_sourceId_key" ON "GaugeRetrievalIndex"("sourceType", "sourceId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedFilter" ADD CONSTRAINT "SavedFilter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardLayout" ADD CONSTRAINT "DashboardLayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WidgetPreference" ADD CONSTRAINT "WidgetPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSend" ADD CONSTRAINT "EmailSend_templateKey_fkey" FOREIGN KEY ("templateKey") REFERENCES "EmailTemplate"("key") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyUsage" ADD CONSTRAINT "ApiKeyUsage_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_defaultPricebookId_fkey" FOREIGN KEY ("defaultPricebookId") REFERENCES "Pricebook"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleNote" ADD CONSTRAINT "VehicleNote_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleNote" ADD CONSTRAINT "VehicleNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleMileageReading" ADD CONSTRAINT "VehicleMileageReading_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleMileageReading" ADD CONSTRAINT "VehicleMileageReading_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedOpportunityId_fkey" FOREIGN KEY ("convertedOpportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedCustomerId_fkey" FOREIGN KEY ("convertedCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricebookEntry" ADD CONSTRAINT "PricebookEntry_pricebookId_fkey" FOREIGN KEY ("pricebookId") REFERENCES "Pricebook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricebookEntry" ADD CONSTRAINT "PricebookEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_pricebookId_fkey" FOREIGN KEY ("pricebookId") REFERENCES "Pricebook"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_parentQuoteId_fkey" FOREIGN KEY ("parentQuoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLineItem" ADD CONSTRAINT "QuoteLineItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLineItem" ADD CONSTRAINT "QuoteLineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteTemplateLineItem" ADD CONSTRAINT "QuoteTemplateLineItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "QuoteTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteTemplateLineItem" ADD CONSTRAINT "QuoteTemplateLineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesGoal" ADD CONSTRAINT "SalesGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_bayId_fkey" FOREIGN KEY ("bayId") REFERENCES "Bay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_serviceWriterUserId_fkey" FOREIGN KEY ("serviceWriterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_assignedTechUserId_fkey" FOREIGN KEY ("assignedTechUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderLineItem" ADD CONSTRAINT "WorkOrderLineItem_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderLineItem" ADD CONSTRAINT "WorkOrderLineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderLineItem" ADD CONSTRAINT "WorkOrderLineItem_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderStatusHistory" ADD CONSTRAINT "WorkOrderStatusHistory_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderStatusHistory" ADD CONSTRAINT "WorkOrderStatusHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_lineItemId_fkey" FOREIGN KEY ("lineItemId") REFERENCES "WorkOrderLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntryEvent" ADD CONSTRAINT "TimeEntryEvent_timeEntryId_fkey" FOREIGN KEY ("timeEntryId") REFERENCES "TimeEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntryEvent" ADD CONSTRAINT "TimeEntryEvent_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntryEvent" ADD CONSTRAINT "TimeEntryEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntryEvent" ADD CONSTRAINT "TimeEntryEvent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PartCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartReservation" ADD CONSTRAINT "PartReservation_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartReservation" ADD CONSTRAINT "PartReservation_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartReservation" ADD CONSTRAINT "PartReservation_lineItemId_fkey" FOREIGN KEY ("lineItemId") REFERENCES "WorkOrderLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartReservation" ADD CONSTRAINT "PartReservation_reservedByUserId_fkey" FOREIGN KEY ("reservedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartTransaction" ADD CONSTRAINT "PartTransaction_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartTransaction" ADD CONSTRAINT "PartTransaction_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartTransaction" ADD CONSTRAINT "PartTransaction_lineItemId_fkey" FOREIGN KEY ("lineItemId") REFERENCES "WorkOrderLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartTransaction" ADD CONSTRAINT "PartTransaction_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "PartReservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartTransaction" ADD CONSTRAINT "PartTransaction_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartTransaction" ADD CONSTRAINT "PartTransaction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_convertedWorkOrderId_fkey" FOREIGN KEY ("convertedWorkOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateLineItem" ADD CONSTRAINT "EstimateLineItem_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateLineItem" ADD CONSTRAINT "EstimateLineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateLineItem" ADD CONSTRAINT "EstimateLineItem_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeOrder" ADD CONSTRAINT "ChangeOrder_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeOrder" ADD CONSTRAINT "ChangeOrder_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeOrderLineItem" ADD CONSTRAINT "ChangeOrderLineItem_changeOrderId_fkey" FOREIGN KEY ("changeOrderId") REFERENCES "ChangeOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeOrderLineItem" ADD CONSTRAINT "ChangeOrderLineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeOrderLineItem" ADD CONSTRAINT "ChangeOrderLineItem_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WoTemplateLineItem" ADD CONSTRAINT "WoTemplateLineItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WoTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WoTemplateLineItem" ADD CONSTRAINT "WoTemplateLineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WoTemplateLineItem" ADD CONSTRAINT "WoTemplateLineItem_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArrivalInspection" ADD CONSTRAINT "ArrivalInspection_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArrivalInspection" ADD CONSTRAINT "ArrivalInspection_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArrivalInspection" ADD CONSTRAINT "ArrivalInspection_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArrivalInspection" ADD CONSTRAINT "ArrivalInspection_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionItem" ADD CONSTRAINT "InspectionItem_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "ArrivalInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_sourceWorkOrderId_fkey" FOREIGN KEY ("sourceWorkOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalToken" ADD CONSTRAINT "PortalToken_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalToken" ADD CONSTRAINT "PortalToken_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalMessage" ADD CONSTRAINT "PortalMessage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalMessage" ADD CONSTRAINT "PortalMessage_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalMessage" ADD CONSTRAINT "PortalMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalUpload" ADD CONSTRAINT "PortalUpload_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalUpload" ADD CONSTRAINT "PortalUpload_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateApproval" ADD CONSTRAINT "EstimateApproval_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbCategory" ADD CONSTRAINT "KbCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "KbCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbArticle" ADD CONSTRAINT "KbArticle_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "KbCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbArticle" ADD CONSTRAINT "KbArticle_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbArticleVersion" ADD CONSTRAINT "KbArticleVersion_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "KbArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbArticleVersion" ADD CONSTRAINT "KbArticleVersion_editedByUserId_fkey" FOREIGN KEY ("editedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbAttachment" ADD CONSTRAINT "KbAttachment_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "KbArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "KbArticle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCompletion" ADD CONSTRAINT "TrainingCompletion_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TrainingAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoShareLink" ADD CONSTRAINT "VideoShareLink_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GaugeConversation" ADD CONSTRAINT "GaugeConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GaugeMessage" ADD CONSTRAINT "GaugeMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "GaugeConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GaugeToolCall" ADD CONSTRAINT "GaugeToolCall_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "GaugeConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GaugeToolCall" ADD CONSTRAINT "GaugeToolCall_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "GaugeMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GaugeToolCall" ADD CONSTRAINT "GaugeToolCall_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Impersonation" ADD CONSTRAINT "Impersonation_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Impersonation" ADD CONSTRAINT "Impersonation_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- =============================================
-- Raw SQL invariants (CHECK constraints + partial indexes)
-- These can't be expressed in prisma/schema.prisma directly.
-- =============================================

-- Core: Address/Contact must have exactly one owner (customer XOR vendor)
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_exactly_one_owner_check" CHECK (
    (("customerId" IS NOT NULL AND "vendorId" IS NULL) OR
     ("customerId" IS NULL AND "vendorId" IS NOT NULL))
);
ALTER TABLE "Address" ADD CONSTRAINT "Address_exactly_one_owner_check" CHECK (
    (("customerId" IS NOT NULL AND "vendorId" IS NULL) OR
     ("customerId" IS NULL AND "vendorId" IS NOT NULL))
);

-- Core: at most one primary contact/address per owner (and per type for addresses)
CREATE UNIQUE INDEX "Contact_customer_primary_unique" ON "Contact"("customerId")
WHERE "customerId" IS NOT NULL AND "isPrimary" = true AND "deletedAt" IS NULL;
CREATE UNIQUE INDEX "Contact_vendor_primary_unique" ON "Contact"("vendorId")
WHERE "vendorId" IS NOT NULL AND "isPrimary" = true AND "deletedAt" IS NULL;
CREATE UNIQUE INDEX "Address_customer_primary_type_unique" ON "Address"("customerId", "type")
WHERE "customerId" IS NOT NULL AND "isPrimary" = true AND "deletedAt" IS NULL;
CREATE UNIQUE INDEX "Address_vendor_primary_type_unique" ON "Address"("vendorId", "type")
WHERE "vendorId" IS NOT NULL AND "isPrimary" = true AND "deletedAt" IS NULL;

-- Sales: Activity attaches to exactly one parent; Opportunity probability in [0, 100]
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_exactly_one_parent_check" CHECK (
    (CASE WHEN "leadId"        IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN "opportunityId" IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN "customerId"    IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN "vehicleId"     IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN "caseId"        IS NOT NULL THEN 1 ELSE 0 END) = 1
);
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_probability_range_check" CHECK (
    "probability" >= 0 AND "probability" <= 100
);

-- Sales: at most one default pricebook; one entry per (pricebook, product); one goal per (user, period)
CREATE UNIQUE INDEX "Pricebook_single_default_unique" ON "Pricebook" ((1))
WHERE "isDefault" = true AND "deletedAt" IS NULL;
CREATE UNIQUE INDEX "PricebookEntry_pricebook_product_unique" ON "PricebookEntry" ("pricebookId", "productId")
WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "SalesGoal_user_period_unique" ON "SalesGoal" ("userId", "period")
WHERE "deletedAt" IS NULL;

-- Shop: at most one active timer per user; active-board lookup; low-stock lookup
CREATE UNIQUE INDEX "TimeEntry_one_active_per_user_idx" ON "TimeEntry"("userId") WHERE "active" = true AND "deletedAt" IS NULL;
CREATE INDEX "WorkOrder_active_board_idx" ON "WorkOrder"("status", "promisedAt") WHERE "deletedAt" IS NULL AND "status" <> 'CLOSED';
CREATE INDEX "Part_low_stock_lookup_idx" ON "Part"("active", "quantityOnHand", "quantityReserved", "reorderPoint") WHERE "deletedAt" IS NULL;

-- Shop: nonnegative amounts and sane ordering
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_odometer_nonnegative" CHECK (
  ("odometerIn" IS NULL OR "odometerIn" >= 0)
  AND ("odometerOut" IS NULL OR "odometerOut" >= 0)
  AND ("odometerIn" IS NULL OR "odometerOut" IS NULL OR "odometerOut" >= "odometerIn")
);
ALTER TABLE "WorkOrderLineItem" ADD CONSTRAINT "WorkOrderLineItem_amounts_nonnegative" CHECK (
  "quantity" >= 0
  AND "unitPrice" >= 0
  AND ("unitCost" IS NULL OR "unitCost" >= 0)
  AND "lineTotal" >= 0
);
ALTER TABLE "WorkOrderStatusHistory" ADD CONSTRAINT "WorkOrderStatusHistory_status_changed" CHECK (
  "fromStatus" IS NULL OR "fromStatus" <> "toStatus"
);
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_minutes_nonnegative" CHECK (
  "durationMinutes" >= 0
  AND "billableMinutes" >= 0
  AND "goodwillMinutes" >= 0
);
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_active_shape" CHECK (
  "active" = false OR ("startedAt" IS NOT NULL AND "endedAt" IS NULL AND "deletedAt" IS NULL)
);
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_ended_after_started" CHECK (
  "startedAt" IS NULL OR "endedAt" IS NULL OR "endedAt" >= "startedAt"
);
ALTER TABLE "TimeEntryEvent" ADD CONSTRAINT "TimeEntryEvent_minutesDelta_nonnegative" CHECK (
  "minutesDelta" IS NULL OR "minutesDelta" >= 0
);
ALTER TABLE "Part" ADD CONSTRAINT "Part_quantities_nonnegative" CHECK (
  "unitCost" >= 0
  AND "quantityOnHand" >= 0
  AND "quantityReserved" >= 0
  AND "reorderPoint" >= 0
  AND "quantityReserved" <= "quantityOnHand"
);
ALTER TABLE "PartReservation" ADD CONSTRAINT "PartReservation_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_totals_nonnegative" CHECK (
  "subtotal" >= 0
  AND "taxTotal" >= 0
  AND "total" >= 0
);
ALTER TABLE "EstimateLineItem" ADD CONSTRAINT "EstimateLineItem_amounts_nonnegative" CHECK (
  "quantity" >= 0
  AND "unitPrice" >= 0
  AND ("unitCost" IS NULL OR "unitCost" >= 0)
  AND "lineTotal" >= 0
);
ALTER TABLE "ChangeOrder" ADD CONSTRAINT "ChangeOrder_totals_nonnegative" CHECK (
  "subtotal" >= 0
  AND "taxTotal" >= 0
  AND "total" >= 0
);
ALTER TABLE "ChangeOrderLineItem" ADD CONSTRAINT "ChangeOrderLineItem_amounts_nonnegative" CHECK (
  "quantity" >= 0
  AND "unitPrice" >= 0
  AND ("unitCost" IS NULL OR "unitCost" >= 0)
  AND "lineTotal" >= 0
);
ALTER TABLE "WoTemplateLineItem" ADD CONSTRAINT "WoTemplateLineItem_amounts_nonnegative" CHECK (
  "quantity" >= 0
  AND ("unitPrice" IS NULL OR "unitPrice" >= 0)
);
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_recovery_nonnegative" CHECK (
  "recoveryAmount" IS NULL OR "recoveryAmount" >= 0
);
