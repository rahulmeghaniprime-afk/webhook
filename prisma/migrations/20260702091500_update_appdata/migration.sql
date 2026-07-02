/*
  Warnings:

  - You are about to drop the column `key` on the `AppData` table. All the data in the column will be lost.
  - You are about to drop the column `value` on the `AppData` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[shop,customerId]` on the table `AppData` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `customerId` to the `AppData` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AppData" DROP COLUMN "key",
DROP COLUMN "value",
ADD COLUMN     "customerId" BIGINT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "AppData_shop_customerId_key" ON "AppData"("shop", "customerId");
