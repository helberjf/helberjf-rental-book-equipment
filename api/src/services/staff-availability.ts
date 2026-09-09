import type { Prisma } from "@prisma/client";
export async function assertStaffAvailable(tx: Prisma.TransactionClient, ids: number[], startAt: Date, endAt: Date, rentalId?: number) {
  // Manual bookings and event confirmations share a lock namespace.
  for (const id of [...new Set(ids)].sort((a, b) => a - b)) await tx.$executeRaw`SELECT pg_advisory_xact_lock(2, ${id}::integer)`;
  const active = await tx.employee.count({ where: { id: { in: ids }, active: true } });
  if (active !== new Set(ids).size) throw new Error("One or more selected employees are unavailable");
  const overlap = { startAt: { lt: endAt }, endAt: { gt: startAt } };
  const booking = await tx.employeeBooking.findFirst({ where: { employeeId: { in: ids }, ...overlap } });
  const assignment = await tx.rentalEmployee.findFirst({ where: { employeeId: { in: ids }, rental: { ...overlap, status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] }, ...(rentalId ? { id: { not: rentalId } } : {}) } } });
  if (booking || assignment) throw new Error("Selected employee is already reserved for this time");
}
