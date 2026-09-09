import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { assertStaffAvailable } from "../services/staff-availability";
import { buildReservations } from "../services/rental.service";
import type {
  AddPaymentInput,
  CreateRentalInput,
  RentalListFilters,
  RentalRecord,
  RentalRepository,
  ReservationDraft,
} from "../services/rental.service";

const rentalInclude = {
  customer: true,
  employees: { include: { employee: true } },
  items: {
    include: {
      product: true,
      units: { include: { productUnit: true } },
    },
  },
  payments: true,
} satisfies Prisma.RentalInclude;

type RentalWithRelations = Prisma.RentalGetPayload<{
  include: typeof rentalInclude;
}>;

const toRecord = (rental: RentalWithRelations): RentalRecord => ({
  id: rental.id,
  code: rental.code,
  status: rental.status,
  startAt: rental.startAt,
  endAt: rental.endAt,
  venue: rental.venue,
  notes: rental.notes,
  finalNotes: rental.finalNotes,
  finalAmountCents: rental.finalAmountCents,
  customer: {
    id: rental.customer.id,
    name: rental.customer.name,
    contact: rental.customer.contact,
    email: rental.customer.email,
  },
  employees: rental.employees.map(({ employee, costCents }) => ({
    id: employee.id,
    name: employee.name,
    contact: employee.contact,
    costCents,
  })),
  items: rental.items.map((item) => ({
    id: item.id,
    productId: item.productId,
    productName: item.product.name,
    quantity: item.quantity,
    bufferBeforeMinutes: item.product.bufferBeforeMinutes,
    bufferAfterMinutes: item.product.bufferAfterMinutes,
    units: item.units.map(({ productUnit }) => ({
      id: productUnit.id,
      identifier: productUnit.identifier,
    })),
  })),
  payments: rental.payments.map((payment) => ({
    amountCents: payment.amountCents,
    status: payment.status,
    method: payment.method,
    paidAt: payment.paidAt,
  })),
});

const createCode = () =>
  `EVT-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID()
    .slice(0, 6)
    .toUpperCase()}`;

export class PrismaRentalRepository implements RentalRepository {
  constructor(private readonly client: PrismaClient) {}

  async createDraft(input: CreateRentalInput): Promise<RentalRecord> {
    const unitIds = input.items.flatMap((item) => item.productUnitIds);
    const [validUnits, validEmployees] = await Promise.all([
      unitIds.length === 0
        ? Promise.resolve(0)
        : this.client.productUnit.count({
            where: { id: { in: unitIds }, active: true, status: "AVAILABLE" },
          }),
      this.client.employee.count({
        where: { id: { in: input.employeeIds }, active: true },
      }),
    ]);

    if (validUnits !== new Set(unitIds).size) {
      throw new Error("One or more selected equipment units are unavailable");
    }
    if (validEmployees !== new Set(input.employeeIds).size) {
      throw new Error("One or more selected employees are unavailable");
    }

    const rental = await this.client.rental.create({
      data: {
        code: createCode(),
        startAt: input.startAt,
        endAt: input.endAt,
        ...(input.venue ? { venue: input.venue } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
        ...(input.finalNotes ? { finalNotes: input.finalNotes } : {}),
        finalAmountCents: input.finalAmountCents,
        customer: {
          create: {
            name: input.responsibleName,
            contact: input.responsibleContact,
            ...(input.responsibleEmail ? { email: input.responsibleEmail } : {}),
          },
        },
        employees: {
          create: [...new Set(input.employeeIds)].map((employeeId) => ({ employeeId, costCents: input.employeeFees?.find(fee => fee.employeeId === employeeId)?.costCents ?? 0 })),
        },
        items: {
          create: input.items.map((item) => ({
            product: { connect: { id: item.productId } },
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents ?? 0,
            ...(item.productUnitIds.length
              ? {
                  units: {
                    create: [...new Set(item.productUnitIds)].map((productUnitId) => ({
                      productUnitId,
                    })),
                  },
                }
              : {}),
          })),
        },
        ...(input.initialPayment
          ? {
              payments: {
                create: {
                  amountCents: input.initialPayment.amountCents,
                  method: input.initialPayment.method,
                  status: input.initialPayment.status,
                  paidAt: input.initialPayment.paidAt,
                  ...(input.initialPayment.notes
                    ? { notes: input.initialPayment.notes }
                    : {}),
                },
              },
            }
          : {}),
      },
      include: rentalInclude,
    });

    return toRecord(rental);
  }

  async getById(id: number): Promise<RentalRecord | null> {
    const rental = await this.client.rental.findUnique({
      where: { id },
      include: rentalInclude,
    });
    return rental ? toRecord(rental) : null;
  }

  async list(filters: RentalListFilters = {}): Promise<RentalRecord[]> {
    const where: Prisma.RentalWhereInput = {};
    if (filters.startAt || filters.endAt) {
      where.AND = [
        ...(filters.endAt ? [{ startAt: { lt: filters.endAt } }] : []),
        ...(filters.startAt ? [{ endAt: { gt: filters.startAt } }] : []),
      ];
    }
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.OR = [
        { code: { contains: filters.search, mode: "insensitive" } },
        { customer: { name: { contains: filters.search, mode: "insensitive" } } },
        { customer: { contact: { contains: filters.search, mode: "insensitive" } } },
      ];
    }

    const rentals = await this.client.rental.findMany({
      where,
      include: rentalInclude,
      orderBy: { startAt: "asc" },
    });
    return rentals.map(toRecord);
  }

  async findConflictingUnitIds(
    reservations: ReservationDraft[],
    excludeRentalId?: number | undefined,
  ): Promise<number[]> {
    const individual = reservations.filter(
      (reservation): reservation is ReservationDraft & { productUnitId: number } =>
        reservation.productUnitId !== null,
    );

    const conflicts = await Promise.all(
      individual.map(async (reservation) => {
        const existing = await this.client.equipmentReservation.findFirst({
          where: {
            status: "ACTIVE",
            productUnitId: reservation.productUnitId,
            ...(excludeRentalId ? { rentalId: { not: excludeRentalId } } : {}),
            blockedFrom: { lt: reservation.blockedUntil },
            blockedUntil: { gt: reservation.blockedFrom },
          },
          select: { productUnitId: true },
        });
        return existing?.productUnitId ?? null;
      }),
    );

    return [...new Set(conflicts.filter((id): id is number => id !== null))];
  }

  async confirm(id: number, reservations: ReservationDraft[]): Promise<RentalRecord> {
    return this.client.$transaction(tx => this.confirmInTransaction(tx, id, reservations), { timeout: 20000 });
  }

  async createConfirmed(input: CreateRentalInput): Promise<RentalRecord> {
    return this.client.$transaction(async tx => {
      const repository = new PrismaRentalRepository(tx as PrismaClient);
      const draft = await repository.createDraft(input);
      return this.confirmInTransaction(tx, draft.id, buildReservations(draft));
    }, { timeout: 20000 });
  }

  private async confirmInTransaction(transaction: Prisma.TransactionClient, id: number, reservations: ReservationDraft[]): Promise<RentalRecord> {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(3, ${id}::integer)`;
      const current = await transaction.rental.findUniqueOrThrow({ where: { id }, include: rentalInclude });
      if (current.status === "CONFIRMED" || current.status === "IN_PROGRESS") return toRecord(current);
      if (current.status !== "DRAFT") throw new Error("Only draft rentals can be confirmed");
      // Product lifecycle and confirmation share locks, preventing deletion races.
      const productIds = [...new Set(current.items.map(item => item.productId))].sort((a,b) => a-b);
      for (const productId of productIds) await transaction.$executeRaw`SELECT pg_advisory_xact_lock(4, ${productId}::integer)`;
      if (await transaction.product.count({where:{id:{in:productIds},active:true}}) !== productIds.length) throw new Error("Selected equipment is unavailable");
      await assertStaffAvailable(transaction, current.employees.map(e => e.employeeId), current.startAt, current.endAt, id);
      const individualReservations = reservations
        .filter(
          (reservation): reservation is ReservationDraft & { productUnitId: number } =>
            reservation.productUnitId !== null,
        )
        .sort((left, right) => left.productUnitId - right.productUnitId);

      // A transaction-scoped lock per physical unit serializes concurrent confirmations.
      for (const reservation of individualReservations) {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${reservation.productUnitId})`;
      }

      if (individualReservations.length > 0) {
        const conflict = await transaction.equipmentReservation.findFirst({
          where: {
            status: "ACTIVE",
            rentalId: { not: id },
            OR: individualReservations.map((reservation) => ({
              productUnitId: reservation.productUnitId,
              blockedFrom: { lt: reservation.blockedUntil },
              blockedUntil: { gt: reservation.blockedFrom },
            })),
          },
          select: { id: true },
        });
        if (conflict) {
          throw new Error("Selected equipment is already reserved for this time");
        }
      }

      await transaction.equipmentReservation.createMany({
        data: reservations.map((reservation) => ({
          rentalId: id,
          ...reservation,
        })),
      });
      const rental = await transaction.rental.update({
        where: { id },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
        include: rentalInclude,
      });
      return toRecord(rental);
  }

  async addPayment(id: number, payment: AddPaymentInput): Promise<RentalRecord> {
    await this.client.payment.create({
      data: {
        rentalId: id,
        amountCents: payment.amountCents,
        method: payment.method,
        status: payment.status,
        paidAt: payment.paidAt,
        ...(payment.notes ? { notes: payment.notes } : {}),
      },
    });
    const rental = await this.getById(id);
    if (!rental) throw new Error("Rental not found");
    return rental;
  }

  async cancel(id: number): Promise<RentalRecord> {
    return this.client.$transaction(async (transaction) => {
      await transaction.equipmentReservation.updateMany({
        where: { rentalId: id, status: "ACTIVE" },
        data: { status: "CANCELLED" },
      });
      const rental = await transaction.rental.update({
        where: { id },
        data: { status: "CANCELLED", cancelledAt: new Date() },
        include: rentalInclude,
      });
      return toRecord(rental);
    });
  }
}
