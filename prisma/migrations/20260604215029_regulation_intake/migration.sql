-- AlterTable
ALTER TABLE "PipelineRun" ADD COLUMN "rulesetImportId" TEXT;

-- CreateTable
CREATE TABLE "RulesetImport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "storageRef" TEXT,
    "sha256" TEXT,
    "byteSize" INTEGER,
    "rawText" TEXT,
    "detectedCountry" TEXT,
    "detectedRegion" TEXT,
    "detectedRegulator" TEXT,
    "detectedRegime" TEXT,
    "targetMarketCode" TEXT,
    "targetMarketId" TEXT,
    "isNewMarket" BOOLEAN NOT NULL DEFAULT false,
    "proposedVersion" INTEGER,
    "reading" JSONB,
    "classification" JSONB,
    "draftRuleset" JSONB,
    "validation" JSONB,
    "diff" JSONB,
    "confidence" REAL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "statusReason" TEXT,
    "scenarioTag" TEXT,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingStartedAt" DATETIME,
    "processingEndedAt" DATETIME,
    "decidedAt" DATETIME,
    "aiElapsedMs" INTEGER,
    "manualBaselineMinutes" INTEGER NOT NULL DEFAULT 480,
    "reviewedByUserId" TEXT,
    "reviewNote" TEXT,
    "activatedRulesetId" TEXT,
    "activatedMarketId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RegulatoryRuleset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "changelog" JSONB,
    "content" JSONB,
    "source" TEXT NOT NULL DEFAULT 'SEED',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "activatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "RegulatoryRuleset_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RegulatoryRuleset" ("activatedAt", "changelog", "contentHash", "createdAt", "deletedAt", "filePath", "id", "isActive", "marketId", "summary", "updatedAt", "version") SELECT "activatedAt", "changelog", "contentHash", "createdAt", "deletedAt", "filePath", "id", "isActive", "marketId", "summary", "updatedAt", "version" FROM "RegulatoryRuleset";
DROP TABLE "RegulatoryRuleset";
ALTER TABLE "new_RegulatoryRuleset" RENAME TO "RegulatoryRuleset";
CREATE INDEX "RegulatoryRuleset_marketId_isActive_idx" ON "RegulatoryRuleset"("marketId", "isActive");
CREATE UNIQUE INDEX "RegulatoryRuleset_marketId_version_key" ON "RegulatoryRuleset"("marketId", "version");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "RulesetImport_reference_key" ON "RulesetImport"("reference");

-- CreateIndex
CREATE INDEX "RulesetImport_status_receivedAt_idx" ON "RulesetImport"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "RulesetImport_deletedAt_idx" ON "RulesetImport"("deletedAt");

-- CreateIndex
CREATE INDEX "PipelineRun_rulesetImportId_idx" ON "PipelineRun"("rulesetImportId");
