import { describe, expect, it } from "vitest";
import {
  RentalService,
  type CreateRentalInput,
  type RentalRecord,
  type RentalRepository,
} from "./rental.service";

const baseInput = (): CreateRentalInput => ({
  startAt: new Date("2026-09-20T18:00:00-03:00"),
  endAt: new Date("2026-09-20T22:00:00-03:00"),
  responsibleName: "Ana Souza",
  responsibleContact: "+55 32 99999-0000",
  finalAmountCents: 150000,
  employeeIds: [1],
  items: [{ productId: 1, quantity: 1, productUnitIds: [1] }],
});

const baseRental = (overrides: Partial<RentalRecord> = {}): RentalRecord => ({
  id: 10,
  code: "EVT-0010",
  status: "DRAFT",
  startAt: new Date("2026-09-20T18:00:00-03:00"),
  endAt: new Date("2026-09-20T22:00:00-03:00"),
  finalAmountCents: 150000,
  customer: { id: 20, name: "Ana Souza", contact: "+55 32 99999-0000" },
  employees: [{ id: 1, name: "Carlos" }],
  items: [
    {
      id: 30,
      productId: 1,
      quantity: 1,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
      units: [{ id: 1, identifier: "Robot 01" }],
    },
  ],
  payments: [],
  ...overrides,
});

const repository = (rental = baseRental()): RentalRepository & {
  confirmedReservations: Array<{ productUnitId: number | null }>;
} => ({
  confirmedReservations: [],
  async createDraft() {
    return rental;
  },
  async getById() {
    return rental;
  },
  async list() {
    return [rental];
  },
  async findConflictingUnitIds() {
    return [];
  },
  async confirm(_rentalId, reservations) {
    this.confirmedReservations = reservations;
    return { ...rental, status: "CONFIRMED" };
  },
  async addPayment(_rentalId, payment) {
    return {
      ...rental,
      payments: [...rental.payments, payment],
    };
  },
});

describe("RentalService", () => {
  it.each([
    ["start date", { startAt: new Date("invalid") }],
    ["end date", { endAt: new Date("invalid") }],
    ["responsible name", { responsibleName: "" }],
    ["responsible contact", { responsibleContact: "" }],
    ["final amount", { finalAmountCents: -1 }],
    ["at least one product", { items: [] }],
    ["at least one employee", { employeeIds: [] }],
  ])("requires %s when creating a rental", async (_field, change) => {
    const service = new RentalService(repository());

    await expect(
      service.createDraftRental({ ...baseInput(), ...change }),
    ).rejects.toThrow();
  });

  it("creates equipment reservations when confirming a rental", async () => {
    const repo = repository();
    const service = new RentalService(repo);

    const result = await service.confirmRental(10);

    expect(result.status).toBe("CONFIRMED");
    expect(repo.confirmedReservations).toEqual([
      expect.objectContaining({
        rentalItemId: 30,
        productId: 1,
        productUnitId: 1,
        blockedFrom: new Date("2026-09-20T21:00:00.000Z"),
        blockedUntil: new Date("2026-09-21T01:00:00.000Z"),
      }),
    ]);
  });

  it("updates received and remaining values after a confirmed payment", async () => {
    const service = new RentalService(repository());

    const result = await service.addPayment(10, {
      amountCents: 70000,
      method: "PIX",
      status: "CONFIRMED",
      paidAt: new Date("2026-09-01T12:00:00Z"),
    });

    expect(result.receivedAmountCents).toBe(70000);
    expect(result.remainingAmountCents).toBe(80000);
  });

  it("rejects confirmation when a selected unit overlaps another event", async () => {
    const repo = repository();
    repo.findConflictingUnitIds = async () => [1];
    const service = new RentalService(repo);

    await expect(service.confirmRental(10)).rejects.toThrow(
      "Selected equipment is already reserved for this time",
    );
  });
});
