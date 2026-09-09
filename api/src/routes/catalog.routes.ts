import { Router, type Request, type Response, type NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { bookingSchema, employeeSchema, productSchema } from "../schemas/catalog.schemas";
import { assertStaffAvailable } from "../services/staff-availability";
export const catalogRouter = Router();
const handle = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => { void fn(req, res).catch(next); };
catalogRouter.post("/employees", handle(async (req, res) => {
  const result = await prisma.employee.create({ data: employeeSchema.parse(req.body) });
  res.status(201).json({ success: true, result });
}));
catalogRouter.get("/staff-bookings", handle(async (_req, res) => {
  const result = await prisma.employeeBooking.findMany({ include: { employee: true }, orderBy: { startAt: "asc" } });
  res.json({ success: true, result });
}));
catalogRouter.post("/staff-bookings", handle(async (req, res) => {
  const data = bookingSchema.parse(req.body);
  const result = await prisma.$transaction(async tx => {
    await assertStaffAvailable(tx, [data.employeeId], data.startAt, data.endAt);
    return tx.employeeBooking.create({ data, include: { employee: true } });
  }, { timeout: 15000 });
  res.status(201).json({ success: true, result });
}));
catalogRouter.delete("/staff-bookings/:id", handle(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid booking id");
  await prisma.employeeBooking.delete({ where: { id } });
  res.json({ success: true });
}));
catalogRouter.post("/products", handle(async (req, res) => {
  const { category, identifiers, ...data } = productSchema.parse(req.body);
  const result = await prisma.product.create({ data: { ...data, quantity: identifiers.length, trackIndividualUnits: true,
    category: { connectOrCreate: { where: { name: category }, create: { name: category } } },
    units: { create: identifiers.map(identifier => ({ identifier })) },
  }, include: { units: true } });
  res.status(201).json({ success: true, result });
}));
catalogRouter.patch("/products/:id", handle(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid equipment id");
  const { category, ...data } = productSchema.omit({ identifiers: true }).parse(req.body);
  const result = await prisma.product.update({ where: { id }, data: { ...data,
    category: { connectOrCreate: { where: { name: category }, create: { name: category } } },
  } });
  res.json({ success: true, result });
}));
