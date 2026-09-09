import { z } from "zod";
export const employeeSchema = z.object({ name: z.string().trim().min(2).max(120), contact: z.string().trim().max(80).default("") });
export const bookingSchema = z.object({
  employeeId: z.coerce.number().int().positive(), title: z.string().trim().min(2).max(120),
  startAt: z.coerce.date(), endAt: z.coerce.date(), notes: z.string().trim().max(2000).default(""),
}).refine(v => v.endAt > v.startAt, { message: "End time must be after start time", path: ["endAt"] });
const measurement = z.number().positive().max(100000).nullable().default(null);
export const productSchema = z.object({
  name: z.string().trim().min(2).max(120), description: z.string().trim().max(2000).default(""),
  category: z.string().trim().min(2).max(80), color: z.string().trim().max(80).default(""),
  weightKg: measurement, heightCm: measurement, widthCm: measurement, lengthCm: measurement,
  defaultRateCents: z.number().int().min(0).max(100000000),
  identifiers: z.array(z.string().trim().min(1).max(60)).min(1).max(100).refine(v => new Set(v).size === v.length, "Equipment identifiers must be unique"),
});
