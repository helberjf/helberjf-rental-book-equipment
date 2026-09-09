ALTER TABLE "Rental" ADD COLUMN "finalNotes" TEXT;
ALTER TABLE "RentalEmployee" ADD COLUMN "costCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RentalEmployee" ADD CONSTRAINT "RentalEmployee_cost_nonnegative" CHECK ("costCents" >= 0);
