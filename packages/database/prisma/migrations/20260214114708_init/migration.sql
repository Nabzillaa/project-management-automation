/*
  Warnings:

  - A unique constraint covering the columns `[organizationId,integrationType]` on the table `integration_credentials` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "sync_configurations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationType" TEXT NOT NULL,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "syncInterval" INTEGER NOT NULL DEFAULT 900,
    "lastSyncAt" TIMESTAMP(3),
    "statusMapping" JSONB,
    "priorityMapping" JSONB,
    "autoExport" BOOLEAN NOT NULL DEFAULT false,
    "autoImport" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sync_configurations_organizationId_idx" ON "sync_configurations"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "sync_configurations_organizationId_integrationType_key" ON "sync_configurations"("organizationId", "integrationType");

-- CreateIndex
CREATE UNIQUE INDEX "integration_credentials_organizationId_integrationType_key" ON "integration_credentials"("organizationId", "integrationType");

-- AddForeignKey
ALTER TABLE "sync_configurations" ADD CONSTRAINT "sync_configurations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
