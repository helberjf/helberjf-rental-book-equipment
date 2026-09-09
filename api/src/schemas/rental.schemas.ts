import { z } from "zod";

const positiveId = z.coerce.number().int().positive();
const moneyInCents = z.coerce.number().int().nonnegative();

export const paymentSchema = z.object({
  amountCents: z.coerce.number().int().positive(),
  method: z.enum(["CASH", "PIX", "CARD", "TRANSFER", "OTHER"]).default("PIX"),
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED"]).default("CONFIRMED"),
  paidAt: z.coerce.date().default(() => new Date()),
  notes: z.string().trim().max(500).optional(),
});

export const rentalItemSchema = z.object({
  productId: positiveId,
  quantity: z.coerce.number().int().positive(),
  productUnitIds: z.array(positiveId).default([]),
  unitPriceCents: moneyInCents.default(0),
});

export const createRentalSchema = z.object({
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  responsibleName: z.string().trim().min(2).max(120),
  responsibleContact: z.string().trim().min(5).max(80),
  responsibleEmail: z.union([z.email(), z.literal("")]).optional(),
  venue: z.string().trim().max(250).optional(),
  notes: z.string().trim().max(2000).optional(),
  finalAmountCents: moneyInCents,
  employeeIds: z.array(positiveId).min(1),
  items: z.array(rentalItemSchema).default([]),
  initialPayment: paymentSchema.optional(),
  confirm: z.boolean().default(true),
}).refine((value) => value.endAt > value.startAt, {
  message: "End time must be after start time",
  path: ["endAt"],
});

export const rentalListQuerySchema = z.object({
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional(),
  status: z.enum(["DRAFT", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  search: z.string().trim().max(120).optional(),
});

export const monthlyReportQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

export const rentalIdSchema = z.coerce.number().int().positive();
