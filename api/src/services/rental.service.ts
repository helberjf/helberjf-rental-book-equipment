import { calculateRentalFinancials } from "../domain/rentals/rental-financials";

export type RentalStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type PaymentStatus = "PENDING" | "CONFIRMED" | "CANCELLED";
export type PaymentMethod = "CASH" | "PIX" | "CARD" | "TRANSFER" | "OTHER";

export interface CreateRentalInput {
  startAt: Date;
  endAt: Date;
  responsibleName: string;
  responsibleContact: string;
  responsibleEmail?: string | undefined;
  venue?: string | undefined;
  notes?: string | undefined;
  finalAmountCents: number;
  employeeIds: number[];
  items: Array<{
    productId: number;
    quantity: number;
    productUnitIds: number[];
    unitPriceCents?: number | undefined;
  }>;
  initialPayment?: AddPaymentInput | undefined;
}

export interface AddPaymentInput {
  amountCents: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt: Date;
  notes?: string | undefined;
}

export interface RentalRecord {
  id: number;
  code: string;
  status: RentalStatus;
  startAt: Date;
  endAt: Date;
  venue?: string | null | undefined;
  notes?: string | null | undefined;
  finalAmountCents: number;
  customer: {
    id: number;
    name: string;
    contact: string;
    email?: string | null | undefined;
  };
  employees: Array<{ id: number; name: string; contact?: string | null | undefined }>;
  items: Array<{
    id: number;
    productId: number;
    productName?: string | undefined;
    quantity: number;
    bufferBeforeMinutes: number;
    bufferAfterMinutes: number;
    units: Array<{ id: number; identifier: string }>;
  }>;
  payments: Array<{
    amountCents: number;
    status: PaymentStatus;
    method?: PaymentMethod | undefined;
    paidAt?: Date | undefined;
  }>;
}

export interface ReservationDraft {
  rentalItemId: number;
  productId: number;
  productUnitId: number | null;
  quantity: number;
  blockedFrom: Date;
  blockedUntil: Date;
}

export interface RentalListFilters {
  startAt?: Date | undefined;
  endAt?: Date | undefined;
  status?: RentalStatus | undefined;
  search?: string | undefined;
}

export interface RentalRepository {
  createDraft(input: CreateRentalInput): Promise<RentalRecord>;
  getById(id: number): Promise<RentalRecord | null>;
  list(filters?: RentalListFilters): Promise<RentalRecord[]>;
  findConflictingUnitIds(
    reservations: ReservationDraft[],
  excludeRentalId?: number | undefined,
  ): Promise<number[]>;
  confirm(id: number, reservations: ReservationDraft[]): Promise<RentalRecord>;
  addPayment(id: number, payment: AddPaymentInput): Promise<RentalRecord>;
  update?(id: number, input: CreateRentalInput): Promise<RentalRecord>;
  cancel?(id: number): Promise<RentalRecord>;
}

export type RentalView = RentalRecord & {
  receivedAmountCents: number;
  remainingAmountCents: number;
};

const addMinutes = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * 60_000);

const isValidDate = (date: Date) =>
  date instanceof Date && Number.isFinite(date.getTime());

const assertCreateInput = (input: CreateRentalInput) => {
  if (!isValidDate(input.startAt)) throw new Error("A valid start date is required");
  if (!isValidDate(input.endAt)) throw new Error("A valid end date is required");
  if (input.endAt <= input.startAt) throw new Error("End time must be after start time");
  if (!input.responsibleName.trim()) throw new Error("Responsible name is required");
  if (!input.responsibleContact.trim()) throw new Error("Responsible contact is required");
  if (!Number.isInteger(input.finalAmountCents) || input.finalAmountCents < 0) {
    throw new Error("Final amount must be a non-negative integer");
  }
  if (input.items.length === 0) throw new Error("At least one product is required");
  if (input.employeeIds.length === 0) throw new Error("At least one employee is required");

  for (const item of input.items) {
    if (!Number.isInteger(item.productId) || item.productId <= 0) {
      throw new Error("Each product must have a valid id");
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error("Each product quantity must be greater than zero");
    }
    if (item.productUnitIds.length > 0 && item.productUnitIds.length !== item.quantity) {
      throw new Error("Selected unit count must match product quantity");
    }
  }
};

const withFinancials = (rental: RentalRecord): RentalView => ({
  ...rental,
  ...calculateRentalFinancials({
    finalAmountCents: rental.finalAmountCents,
    payments: rental.payments,
  }),
});

const buildReservations = (rental: RentalRecord): ReservationDraft[] =>
  rental.items.flatMap<ReservationDraft>((item): ReservationDraft[] => {
    const blockedFrom = addMinutes(rental.startAt, -item.bufferBeforeMinutes);
    const blockedUntil = addMinutes(rental.endAt, item.bufferAfterMinutes);

    if (item.units.length === 0) {
      return [{
        rentalItemId: item.id,
        productId: item.productId,
        productUnitId: null,
        quantity: item.quantity,
        blockedFrom,
        blockedUntil,
      }];
    }

    return item.units.map((unit) => ({
      rentalItemId: item.id,
      productId: item.productId,
      productUnitId: unit.id,
      quantity: 1,
      blockedFrom,
      blockedUntil,
    }));
  });

export class RentalService {
  constructor(private readonly repository: RentalRepository) {}

  async createDraftRental(input: CreateRentalInput): Promise<RentalView> {
    assertCreateInput(input);
    return withFinancials(await this.repository.createDraft(input));
  }

  async confirmRental(id: number): Promise<RentalView> {
    const rental = await this.repository.getById(id);
    if (!rental) throw new Error("Rental not found");
    if (rental.status === "CANCELLED") throw new Error("Cancelled rentals cannot be confirmed");
    if (rental.status === "COMPLETED") throw new Error("Completed rentals cannot be confirmed");
    if (rental.status === "CONFIRMED" || rental.status === "IN_PROGRESS") {
      return withFinancials(rental);
    }

    const reservations = buildReservations(rental);
    const conflicts = await this.repository.findConflictingUnitIds(
      reservations,
      rental.id,
    );
    if (conflicts.length > 0) {
      throw new Error("Selected equipment is already reserved for this time");
    }

    return withFinancials(await this.repository.confirm(id, reservations));
  }

  async addPayment(id: number, payment: AddPaymentInput): Promise<RentalView> {
    if (!Number.isInteger(payment.amountCents) || payment.amountCents <= 0) {
      throw new Error("Payment amount must be greater than zero");
    }
    if (!isValidDate(payment.paidAt)) throw new Error("A valid payment date is required");
    const rental = await this.repository.addPayment(id, payment);
    return withFinancials(rental);
  }

  async getRentalById(id: number): Promise<RentalView> {
    const rental = await this.repository.getById(id);
    if (!rental) throw new Error("Rental not found");
    return withFinancials(rental);
  }

  async listRentals(filters: RentalListFilters = {}): Promise<RentalView[]> {
    return (await this.repository.list(filters)).map(withFinancials);
  }

  async listCalendarEvents(filters: RentalListFilters = {}) {
    const rentals = await this.listRentals(filters);
    return rentals
      .filter((rental) => rental.status !== "CANCELLED")
      .map((rental) => ({
        id: rental.id,
        title: `${rental.customer.name} · ${rental.status}`,
        start: rental.startAt,
        end: rental.endAt,
        status: rental.status,
        responsibleName: rental.customer.name,
        responsibleContact: rental.customer.contact,
        employeeNames: rental.employees.map((employee) => employee.name),
        equipment: rental.items.flatMap((item) =>
          item.units.length > 0
            ? item.units.map((unit) => unit.identifier)
            : [`${item.quantity} × ${item.productName ?? "Equipment"}`],
        ),
      }));
  }

  async getMonthlyReport(startAt: Date, endAt: Date, now = new Date()) {
    const rentals = await this.listRentals({ startAt, endAt });
    const activeRentals = rentals.filter((rental) => rental.status !== "CANCELLED");

    return {
      period: { startAt, endAt },
      totals: activeRentals.reduce(
        (total, rental) => ({
          events: total.events + 1,
          futureEvents: total.futureEvents + (rental.startAt > now ? 1 : 0),
          chargedAmountCents: total.chargedAmountCents + rental.finalAmountCents,
          receivedAmountCents: total.receivedAmountCents + rental.receivedAmountCents,
          remainingAmountCents: total.remainingAmountCents + rental.remainingAmountCents,
        }),
        {
          events: 0,
          futureEvents: 0,
          chargedAmountCents: 0,
          receivedAmountCents: 0,
          remainingAmountCents: 0,
        },
      ),
      rentals,
    };
  }
}
