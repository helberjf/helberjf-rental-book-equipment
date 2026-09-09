import { Router, type Request, type Response, type NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { bookingSchema, employeeSchema, productSchema } from "../schemas/catalog.schemas";
import { assertStaffAvailable } from "../services/staff-availability";
import { rentalIdSchema, eventOperationsSchema } from "../schemas/rental.schemas";
import { PrismaRentalRepository } from "../repositories/rental.repository";
import { RentalService } from "../services/rental.service";
export const catalogRouter = Router();
const handle = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => { void fn(req, res).catch(next); };
catalogRouter.post("/employees", handle(async (req, res) => {
  const result = await prisma.employee.create({ data: employeeSchema.parse(req.body) });
  res.status(201).json({ success: true, result });
}));
catalogRouter.patch("/employees/:id", handle(async (req, res) => {
  const id = rentalIdSchema.parse(req.params.id);
  const result = await prisma.employee.update({ where: { id, active: true }, data: employeeSchema.parse(req.body) });
  res.json({ success: true, result });
}));
catalogRouter.delete("/employees/:id", handle(async (req, res) => {
  const id = rentalIdSchema.parse(req.params.id);
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(2, ${id}::integer)`;
    const now = new Date();
    const assignment = await tx.rentalEmployee.findFirst({ where: { employeeId: id, rental: { status: { not: 'CANCELLED' }, endAt: { gt: now } } } });
    const booking = await tx.employeeBooking.findFirst({ where: { employeeId: id, endAt: { gt: now } } });
    if (assignment || booking) throw new Error('Cannot delete employee with upcoming bookings');
    await tx.employee.update({ where: { id }, data: { active: false } });
  }, { timeout: 20000 });
  res.json({ success: true });
}));
catalogRouter.delete("/products/:id", handle(async (req, res) => {
  const id = rentalIdSchema.parse(req.params.id);
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(4, ${id}::integer)`;
    const units = await tx.productUnit.findMany({ where: { productId: id }, orderBy: { id: 'asc' }, select: { id: true } });
    for (const unit of units) await tx.$executeRaw`SELECT pg_advisory_xact_lock(${unit.id})`;
    const now = new Date();
    const assignment = await tx.rentalItem.findFirst({ where: { productId: id, rental: { status: { not: 'CANCELLED' }, endAt: { gt: now } } } });
    const reservation = await tx.equipmentReservation.findFirst({ where: { productId: id, status: 'ACTIVE', blockedUntil: { gt: now } } });
    if (assignment || reservation) throw new Error('Cannot delete equipment with upcoming bookings');
    await tx.product.update({ where: { id }, data: { active: false } });
    await tx.productUnit.updateMany({ where: { productId: id }, data: { active: false } });
  }, { timeout: 20000 });
  res.json({ success: true });
}));
catalogRouter.patch('/rentals/:id/operations', handle(async (req, res) => {
  const id = rentalIdSchema.parse(req.params.id);
  const data = eventOperationsSchema.parse(req.body);
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(3, ${id}::integer)`;
    const event = await tx.rental.findUniqueOrThrow({ where: { id }, include: { employees: true } });
    if (data.employeeFees?.some(fee => !event.employees.some(e => e.employeeId === fee.employeeId))) throw new Error('Employee fee must belong to an assigned employee');
    for (const fee of data.employeeFees ?? []) await tx.rentalEmployee.update({ where: { rentalId_employeeId: { rentalId: id, employeeId: fee.employeeId } }, data: { costCents: fee.costCents } });
    if (data.finalNotes !== undefined) await tx.rental.update({ where: { id }, data: { finalNotes: data.finalNotes } });
  }, { timeout: 20000 });
  const service = new RentalService(new PrismaRentalRepository(prisma));
  res.json({ success: true, result: await service.getRentalById(id) });
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
  const result = await prisma.product.update({ where: { id, active: true }, data: { ...data,
    category: { connectOrCreate: { where: { name: category }, create: { name: category } } },
  } });
  res.json({ success: true, result });
}));
