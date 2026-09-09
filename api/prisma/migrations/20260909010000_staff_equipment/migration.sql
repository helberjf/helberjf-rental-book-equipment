ALTER TABLE "Product" ADD COLUMN "weightKg" DOUBLE PRECISION,
 ADD COLUMN "heightCm" DOUBLE PRECISION, ADD COLUMN "widthCm" DOUBLE PRECISION,
 ADD COLUMN "lengthCm" DOUBLE PRECISION, ADD COLUMN "color" TEXT;
CREATE TABLE "EmployeeBooking" (
 "id" SERIAL PRIMARY KEY, "employeeId" INTEGER NOT NULL, "title" TEXT NOT NULL,
 "startAt" TIMESTAMP(3) NOT NULL, "endAt" TIMESTAMP(3) NOT NULL, "notes" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "EmployeeBooking_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "EmployeeBooking_valid_range" CHECK ("endAt" > "startAt")
);
CREATE INDEX "EmployeeBooking_employeeId_startAt_endAt_idx" ON "EmployeeBooking"("employeeId", "startAt", "endAt");
