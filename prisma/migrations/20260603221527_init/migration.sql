-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "countryIso2" TEXT NOT NULL,
    "cities" JSONB NOT NULL,
    "regulatorName" TEXT NOT NULL,
    "regulatorCode" TEXT NOT NULL,
    "privacyRegime" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "activeRulesetVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "RegulatoryRuleset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "changelog" JSONB,
    "activatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "RegulatoryRuleset_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuthorityRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "rulesetId" TEXT,
    "rulesetVersion" INTEGER,
    "title" TEXT NOT NULL,
    "authority" TEXT NOT NULL,
    "legalBasis" TEXT,
    "source" TEXT NOT NULL DEFAULT 'TEXT',
    "rawText" TEXT,
    "sourceDocId" TEXT,
    "intent" JSONB,
    "compliancePlan" JSONB,
    "retrievalPlan" JSONB,
    "retrievalResult" JSONB,
    "generatedReport" JSONB,
    "selfValidation" JSONB,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "statusReason" TEXT,
    "scenarioTag" TEXT,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" DATETIME,
    "processingStartedAt" DATETIME,
    "processingEndedAt" DATETIME,
    "decidedAt" DATETIME,
    "manualBaselineMinutes" INTEGER NOT NULL DEFAULT 240,
    "aiElapsedMs" INTEGER,
    "reviewedByUserId" TEXT,
    "reviewNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "AuthorityRequest_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuthorityRequest_rulesetId_fkey" FOREIGN KEY ("rulesetId") REFERENCES "RegulatoryRuleset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuthorityRequest_sourceDocId_fkey" FOREIGN KEY ("sourceDocId") REFERENCES "Document" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuthorityRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReportField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authorityRequestId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "unit" TEXT,
    "classification" TEXT NOT NULL,
    "confidence" REAL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "provenance" JSONB NOT NULL,
    "aiCallId" TEXT,
    "ordering" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReportField_authorityRequestId_fkey" FOREIGN KEY ("authorityRequestId") REFERENCES "AuthorityRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FleetPartner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradingName" TEXT,
    "partnerType" TEXT NOT NULL,
    "registrationNo" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "address" JSONB,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "decision" JSONB,
    "riskScore" INTEGER,
    "riskBand" TEXT,
    "monitoringStatus" TEXT NOT NULL DEFAULT 'COMPLIANT',
    "monitoringReason" TEXT,
    "lastAssessedAt" DATETIME,
    "lastAssessedRulesetVersion" INTEGER,
    "completenessPct" INTEGER NOT NULL DEFAULT 0,
    "scenarioTag" TEXT,
    "manualBaselineMinutes" INTEGER NOT NULL DEFAULT 360,
    "aiElapsedMs" INTEGER,
    "onboardedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "FleetPartner_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PartnerHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partnerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "detail" JSONB NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartnerHistory_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "FleetPartner" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT,
    "partnerId" TEXT,
    "docType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "storageRef" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "extractedFields" JSONB,
    "validationResult" JSONB,
    "extractionConfidence" REAL,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "issuedAt" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Document_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "FleetPartner" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentGroundTruth" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "injectedDefects" JSONB,
    "generatorSeed" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentGroundTruth_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partnerId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "nationalId" TEXT,
    "licenseNo" TEXT,
    "permitNo" TEXT,
    "licenseExpiresAt" DATETIME,
    "permitExpiresAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Driver_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "FleetPartner" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partnerId" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "vin" TEXT,
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "registrationNo" TEXT,
    "registrationValidUntil" DATETIME,
    "insuranceValidUntil" DATETIME,
    "inspectionValidUntil" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Vehicle_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "FleetPartner" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partnerId" TEXT NOT NULL,
    "driverId" TEXT,
    "vehicleId" TEXT,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "distanceKm" REAL,
    "fareMinor" INTEGER,
    "zone" TEXT,
    "city" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "Trip_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "FleetPartner" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Trip_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Trip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Validation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "documentId" TEXT,
    "partnerId" TEXT,
    "authorityRequestId" TEXT,
    "outcome" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "evidence" JSONB,
    "confidence" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Validation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Validation_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "FleetPartner" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Validation_authorityRequestId_fkey" FOREIGN KEY ("authorityRequestId") REFERENCES "AuthorityRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CrossCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partnerId" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "docAId" TEXT,
    "docBId" TEXT,
    "field" TEXT NOT NULL,
    "valueA" TEXT,
    "valueB" TEXT,
    "outcome" TEXT NOT NULL,
    "confidence" REAL,
    "message" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrossCheck_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "FleetPartner" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CrossCheck_docAId_fkey" FOREIGN KEY ("docAId") REFERENCES "Document" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CrossCheck_docBId_fkey" FOREIGN KEY ("docBId") REFERENCES "Document" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RiskAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partnerId" TEXT NOT NULL,
    "rulesetId" TEXT,
    "rulesetVersion" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "band" TEXT NOT NULL,
    "factors" JSONB NOT NULL,
    "explanation" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "RiskAssessment_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "FleetPartner" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RiskAssessment_rulesetId_fkey" FOREIGN KEY ("rulesetId") REFERENCES "RegulatoryRuleset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComplianceEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT,
    "partnerId" TEXT,
    "authorityRequestId" TEXT,
    "rulesetId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "detail" JSONB,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" DATETIME,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComplianceEvent_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ComplianceEvent_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "FleetPartner" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ComplianceEvent_authorityRequestId_fkey" FOREIGN KEY ("authorityRequestId") REFERENCES "AuthorityRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ComplianceEvent_rulesetId_fkey" FOREIGN KEY ("rulesetId") REFERENCES "RegulatoryRuleset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PipelineRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "surface" TEXT NOT NULL,
    "authorityRequestId" TEXT,
    "partnerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "statusReason" TEXT,
    "currentStage" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "elapsedMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PipelineRun_authorityRequestId_fkey" FOREIGN KEY ("authorityRequestId") REFERENCES "AuthorityRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PipelineRun_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "FleetPartner" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PipelineStage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ordering" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "progressPct" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "output" JSONB,
    "confidence" REAL,
    "blockReason" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "durationMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PipelineStage_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PipelineRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "actorType" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "aiModel" TEXT,
    "promptVersion" TEXT,
    "costMicroUsd" INTEGER,
    "confidence" REAL,
    "aiCallId" TEXT,
    "prevHash" TEXT,
    "hash" TEXT NOT NULL,
    "ts" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiCallLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authorityRequestId" TEXT,
    "partnerId" TEXT,
    "documentId" TEXT,
    "pipelineRunId" TEXT,
    "agent" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL,
    "tokensOut" INTEGER NOT NULL,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL,
    "costMicroUsd" INTEGER NOT NULL,
    "confidence" REAL,
    "requestHash" TEXT,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "errorText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiCallLog_authorityRequestId_fkey" FOREIGN KEY ("authorityRequestId") REFERENCES "AuthorityRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AiCallLog_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "FleetPartner" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AiCallLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'REVIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppMeta" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" JSONB NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Market_code_key" ON "Market"("code");

-- CreateIndex
CREATE INDEX "Market_deletedAt_idx" ON "Market"("deletedAt");

-- CreateIndex
CREATE INDEX "RegulatoryRuleset_marketId_isActive_idx" ON "RegulatoryRuleset"("marketId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RegulatoryRuleset_marketId_version_key" ON "RegulatoryRuleset"("marketId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AuthorityRequest_reference_key" ON "AuthorityRequest"("reference");

-- CreateIndex
CREATE INDEX "AuthorityRequest_marketId_status_idx" ON "AuthorityRequest"("marketId", "status");

-- CreateIndex
CREATE INDEX "AuthorityRequest_status_receivedAt_idx" ON "AuthorityRequest"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "AuthorityRequest_deletedAt_idx" ON "AuthorityRequest"("deletedAt");

-- CreateIndex
CREATE INDEX "ReportField_authorityRequestId_idx" ON "ReportField"("authorityRequestId");

-- CreateIndex
CREATE INDEX "ReportField_fieldKey_idx" ON "ReportField"("fieldKey");

-- CreateIndex
CREATE UNIQUE INDEX "FleetPartner_reference_key" ON "FleetPartner"("reference");

-- CreateIndex
CREATE INDEX "FleetPartner_marketId_status_idx" ON "FleetPartner"("marketId", "status");

-- CreateIndex
CREATE INDEX "FleetPartner_marketId_monitoringStatus_idx" ON "FleetPartner"("marketId", "monitoringStatus");

-- CreateIndex
CREATE INDEX "FleetPartner_deletedAt_idx" ON "FleetPartner"("deletedAt");

-- CreateIndex
CREATE INDEX "PartnerHistory_partnerId_occurredAt_idx" ON "PartnerHistory"("partnerId", "occurredAt");

-- CreateIndex
CREATE INDEX "Document_partnerId_docType_idx" ON "Document"("partnerId", "docType");

-- CreateIndex
CREATE INDEX "Document_marketId_status_idx" ON "Document"("marketId", "status");

-- CreateIndex
CREATE INDEX "Document_expiresAt_idx" ON "Document"("expiresAt");

-- CreateIndex
CREATE INDEX "Document_deletedAt_idx" ON "Document"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentGroundTruth_documentId_key" ON "DocumentGroundTruth"("documentId");

-- CreateIndex
CREATE INDEX "Driver_partnerId_idx" ON "Driver"("partnerId");

-- CreateIndex
CREATE INDEX "Driver_licenseExpiresAt_idx" ON "Driver"("licenseExpiresAt");

-- CreateIndex
CREATE INDEX "Vehicle_partnerId_idx" ON "Vehicle"("partnerId");

-- CreateIndex
CREATE INDEX "Vehicle_registrationValidUntil_idx" ON "Vehicle"("registrationValidUntil");

-- CreateIndex
CREATE INDEX "Vehicle_inspectionValidUntil_idx" ON "Vehicle"("inspectionValidUntil");

-- CreateIndex
CREATE INDEX "Trip_partnerId_startedAt_idx" ON "Trip"("partnerId", "startedAt");

-- CreateIndex
CREATE INDEX "Trip_driverId_idx" ON "Trip"("driverId");

-- CreateIndex
CREATE INDEX "Trip_vehicleId_idx" ON "Trip"("vehicleId");

-- CreateIndex
CREATE INDEX "Trip_zone_idx" ON "Trip"("zone");

-- CreateIndex
CREATE INDEX "Validation_partnerId_outcome_idx" ON "Validation"("partnerId", "outcome");

-- CreateIndex
CREATE INDEX "Validation_documentId_idx" ON "Validation"("documentId");

-- CreateIndex
CREATE INDEX "Validation_ruleId_idx" ON "Validation"("ruleId");

-- CreateIndex
CREATE INDEX "CrossCheck_partnerId_outcome_idx" ON "CrossCheck"("partnerId", "outcome");

-- CreateIndex
CREATE INDEX "RiskAssessment_partnerId_isCurrent_idx" ON "RiskAssessment"("partnerId", "isCurrent");

-- CreateIndex
CREATE INDEX "ComplianceEvent_partnerId_occurredAt_idx" ON "ComplianceEvent"("partnerId", "occurredAt");

-- CreateIndex
CREATE INDEX "ComplianceEvent_type_dueAt_idx" ON "ComplianceEvent"("type", "dueAt");

-- CreateIndex
CREATE INDEX "ComplianceEvent_marketId_occurredAt_idx" ON "ComplianceEvent"("marketId", "occurredAt");

-- CreateIndex
CREATE INDEX "PipelineRun_status_idx" ON "PipelineRun"("status");

-- CreateIndex
CREATE INDEX "PipelineRun_authorityRequestId_idx" ON "PipelineRun"("authorityRequestId");

-- CreateIndex
CREATE INDEX "PipelineRun_partnerId_idx" ON "PipelineRun"("partnerId");

-- CreateIndex
CREATE INDEX "PipelineStage_runId_idx" ON "PipelineStage"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineStage_runId_ordering_key" ON "PipelineStage"("runId", "ordering");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_ts_idx" ON "AuditLog"("ts");

-- CreateIndex
CREATE INDEX "AiCallLog_authorityRequestId_idx" ON "AiCallLog"("authorityRequestId");

-- CreateIndex
CREATE INDEX "AiCallLog_partnerId_idx" ON "AiCallLog"("partnerId");

-- CreateIndex
CREATE INDEX "AiCallLog_stage_createdAt_idx" ON "AiCallLog"("stage", "createdAt");

-- CreateIndex
CREATE INDEX "AiCallLog_model_idx" ON "AiCallLog"("model");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
