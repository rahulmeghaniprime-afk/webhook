-- CreateTable
CREATE TABLE "AppData" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "appdata_shop_idx" ON "AppData"("shop");
