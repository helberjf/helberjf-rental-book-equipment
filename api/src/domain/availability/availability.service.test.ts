import { describe, expect, it } from "vitest";
import { AvailabilityService } from "./availability.service";
import type {
  AvailabilityInput,
  EquipmentReservation,
  MaintenanceRecord,
  ProductSnapshot,
  ProductUnitSnapshot,
} from "./availability.types";

const product: ProductSnapshot = {
  id: 1,
  name: "Robo LED",
  trackIndividualUnits: true,
  quantity: 8,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
};

const units: ProductUnitSnapshot[] = [
  { id: 1, productId: 1, identifier: "Robo 01", status: "AVAILABLE", active: true },
  { id: 2, productId: 1, identifier: "Robo 02", status: "AVAILABLE", active: true },
  { id: 3, productId: 1, identifier: "Robo 03", status: "AVAILABLE", active: true },
];

const baseInput = (overrides: Partial<AvailabilityInput> = {}): AvailabilityInput => ({
  product,
  units,
  reservations: [],
  maintenanceRecords: [],
  requestedStartAt: new Date("2026-09-20T14:00:00-03:00"),
  requestedEndAt: new Date("2026-09-20T16:00:00-03:00"),
  requestedQuantity: 1,
  ...overrides,
});

const reservation = (
  productUnitId: number,
  blockedFrom: string,
  blockedUntil: string,
): EquipmentReservation => ({
  id: Math.floor(Math.random() * 100000),
  productId: 1,
  productUnitId,
  quantity: 1,
  blockedFrom: new Date(blockedFrom),
  blockedUntil: new Date(blockedUntil),
  status: "ACTIVE",
});

describe("AvailabilityService", () => {
  it("allows the same individual unit to be rented twice in the same day when blocked intervals do not overlap", () => {
    const result = AvailabilityService.checkAvailability(
      baseInput({
        reservations: [
          reservation(1, "2026-09-20T10:00:00-03:00", "2026-09-20T13:00:00-03:00"),
        ],
        requestedStartAt: new Date("2026-09-20T18:00:00-03:00"),
        requestedEndAt: new Date("2026-09-20T22:00:00-03:00"),
      }),
    );

    expect(result.availableUnits.map((unit) => unit.identifier)).toContain("Robo 01");
    expect(result.unavailableUnits).toHaveLength(0);
    expect(result.available).toBe(3);
  });

  it("marks an individual unit as unavailable when blocked intervals overlap", () => {
    const result = AvailabilityService.checkAvailability(
      baseInput({
        reservations: [
          reservation(1, "2026-09-20T10:00:00-03:00", "2026-09-20T14:00:00-03:00"),
        ],
        requestedStartAt: new Date("2026-09-20T13:00:00-03:00"),
        requestedEndAt: new Date("2026-09-20T16:00:00-03:00"),
      }),
    );

    expect(result.availableUnits.map((unit) => unit.identifier)).not.toContain("Robo 01");
    expect(result.unavailableUnits).toContainEqual(
      expect.objectContaining({ identifier: "Robo 01", reason: "RESERVED" }),
    );
  });

  it("treats the end of the interval as exclusive when no buffer exists", () => {
    const result = AvailabilityService.checkAvailability(
      baseInput({
        reservations: [
          reservation(1, "2026-09-20T10:00:00-03:00", "2026-09-20T14:00:00-03:00"),
        ],
        requestedStartAt: new Date("2026-09-20T14:00:00-03:00"),
        requestedEndAt: new Date("2026-09-20T16:00:00-03:00"),
      }),
    );

    expect(result.availableUnits.map((unit) => unit.identifier)).toContain("Robo 01");
  });

  it("uses product buffers to calculate the blocked interval", () => {
    const result = AvailabilityService.checkAvailability(
      baseInput({
        product: { ...product, bufferAfterMinutes: 60 },
        reservations: [
          reservation(1, "2026-09-20T10:00:00-03:00", "2026-09-20T15:00:00-03:00"),
        ],
        requestedStartAt: new Date("2026-09-20T14:30:00-03:00"),
        requestedEndAt: new Date("2026-09-20T16:00:00-03:00"),
      }),
    );

    expect(result.blockedFrom.toISOString()).toBe("2026-09-20T17:30:00.000Z");
    expect(result.blockedUntil.toISOString()).toBe("2026-09-20T20:00:00.000Z");
    expect(result.unavailableUnits).toContainEqual(
      expect.objectContaining({ identifier: "Robo 01", reason: "RESERVED" }),
    );
  });

  it("marks units with active maintenance as unavailable", () => {
    const maintenanceRecords: MaintenanceRecord[] = [
      {
        id: 1,
        productUnitId: 2,
        startAt: new Date("2026-09-20T08:00:00-03:00"),
        endAt: new Date("2026-09-20T18:00:00-03:00"),
        status: "OPEN",
      },
    ];

    const result = AvailabilityService.checkAvailability(
      baseInput({ maintenanceRecords }),
    );

    expect(result.unavailableUnits).toContainEqual(
      expect.objectContaining({ identifier: "Robo 02", reason: "MAINTENANCE" }),
    );
  });

  it("calculates quantity availability by maximum concurrent reserved quantity", () => {
    const chairProduct: ProductSnapshot = {
      id: 2,
      name: "Cadeira Tiffany",
      trackIndividualUnits: false,
      quantity: 50,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
    };

    const quantitativeReservations: EquipmentReservation[] = [
      {
        id: 1,
        productId: 2,
        productUnitId: null,
        quantity: 40,
        blockedFrom: new Date("2026-09-20T18:00:00-03:00"),
        blockedUntil: new Date("2026-09-20T23:00:00-03:00"),
        status: "ACTIVE",
      },
      {
        id: 2,
        productId: 2,
        productUnitId: null,
        quantity: 20,
        blockedFrom: new Date("2026-09-20T10:00:00-03:00"),
        blockedUntil: new Date("2026-09-20T12:00:00-03:00"),
        status: "ACTIVE",
      },
    ];

    const result = AvailabilityService.checkAvailability(
      baseInput({
        product: chairProduct,
        units: [],
        reservations: quantitativeReservations,
        requestedStartAt: new Date("2026-09-20T19:00:00-03:00"),
        requestedEndAt: new Date("2026-09-20T22:00:00-03:00"),
        requestedQuantity: 15,
      }),
    );

    expect(result.available).toBe(10);
    expect(result.isAvailable).toBe(false);
  });

  it("suggests the requested number of available units", () => {
    const result = AvailabilityService.suggestUnits(
      baseInput({
        reservations: [
          reservation(1, "2026-09-20T13:00:00-03:00", "2026-09-20T17:00:00-03:00"),
        ],
        requestedQuantity: 2,
      }),
    );

    expect(result.map((unit) => unit.identifier)).toEqual(["Robo 02", "Robo 03"]);
  });

  it("allows Robo 01 in two same-day events when the first blocked interval ends before the second starts", () => {
    const result = AvailabilityService.checkAvailability(
      baseInput({
        units: [
          { id: 1, productId: 1, identifier: "Robo 01", status: "AVAILABLE", active: true },
          { id: 2, productId: 1, identifier: "Robo 02", status: "AVAILABLE", active: true },
          { id: 3, productId: 1, identifier: "Robo 03", status: "AVAILABLE", active: true },
          { id: 4, productId: 1, identifier: "Robo 04", status: "AVAILABLE", active: true },
          { id: 5, productId: 1, identifier: "Robo 05", status: "AVAILABLE", active: true },
          { id: 6, productId: 1, identifier: "Robo 06", status: "AVAILABLE", active: true },
          { id: 7, productId: 1, identifier: "Robo 07", status: "AVAILABLE", active: true },
          { id: 8, productId: 1, identifier: "Robo 08", status: "AVAILABLE", active: true },
        ],
        reservations: [
          reservation(1, "2026-09-20T14:00:00-03:00", "2026-09-20T17:00:00-03:00"),
        ],
        requestedStartAt: new Date("2026-09-20T21:00:00-03:00"),
        requestedEndAt: new Date("2026-09-21T00:00:00-03:00"),
        requestedQuantity: 3,
      }),
    );

    expect(result.availableUnits.map((unit) => unit.identifier)).toContain("Robo 01");
    expect(result.isAvailable).toBe(true);
  });
});
