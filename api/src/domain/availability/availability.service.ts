import type {
  AvailabilityInput,
  AvailabilityResult,
  EquipmentReservation,
  MaintenanceRecord,
  ProductUnitSnapshot,
  UnavailableReason,
  UnavailableUnit,
} from "./availability.types";

const minute = 60 * 1000;

const addMinutes = (date: Date, minutes: number): Date =>
  new Date(date.getTime() + minutes * minute);

const intervalsOverlap = (
  existingStart: Date,
  existingEnd: Date,
  requestedStart: Date,
  requestedEnd: Date,
): boolean => existingStart < requestedEnd && existingEnd > requestedStart;

const getBlockedWindow = (input: AvailabilityInput) => ({
  blockedFrom: addMinutes(input.requestedStartAt, -input.product.bufferBeforeMinutes),
  blockedUntil: addMinutes(input.requestedEndAt, input.product.bufferAfterMinutes),
});

const activeReservationsForProduct = (
  input: AvailabilityInput,
): EquipmentReservation[] =>
  input.reservations.filter(
    (reservation) =>
      reservation.productId === input.product.id && reservation.status === "ACTIVE",
  );

const activeMaintenanceForUnit = (
  records: MaintenanceRecord[],
  unitId: number,
): MaintenanceRecord[] =>
  records.filter(
    (record) => record.productUnitId === unitId && record.status === "OPEN",
  );

const unavailableByStatus = (
  unit: ProductUnitSnapshot,
): UnavailableReason | null => {
  if (!unit.active) return "INACTIVE";
  if (unit.status === "AVAILABLE") return null;
  return unit.status;
};

const buildUnavailableUnit = (
  unit: ProductUnitSnapshot,
  reason: UnavailableReason,
  availableAfter?: Date,
): UnavailableUnit => ({
  id: unit.id,
  identifier: unit.identifier,
  reason,
  ...(availableAfter ? { availableAfter } : {}),
});

const calculateReservedQuantity = (
  reservations: EquipmentReservation[],
  blockedFrom: Date,
  blockedUntil: Date,
): number =>
  reservations
    .filter(
      (reservation) =>
        reservation.productUnitId === null &&
        intervalsOverlap(
          reservation.blockedFrom,
          reservation.blockedUntil,
          blockedFrom,
          blockedUntil,
        ),
    )
    .reduce((total, reservation) => total + reservation.quantity, 0);

export class AvailabilityService {
  static checkAvailability(input: AvailabilityInput): AvailabilityResult {
    if (input.requestedEndAt <= input.requestedStartAt) {
      throw new Error("requestedEndAt must be greater than requestedStartAt");
    }

    const { blockedFrom, blockedUntil } = getBlockedWindow(input);
    const reservations = activeReservationsForProduct(input);

    if (!input.product.trackIndividualUnits) {
      const reserved = calculateReservedQuantity(
        reservations,
        blockedFrom,
        blockedUntil,
      );
      const available = Math.max(input.product.quantity - reserved, 0);

      return {
        productId: input.product.id,
        requestedStartAt: input.requestedStartAt,
        requestedEndAt: input.requestedEndAt,
        blockedFrom,
        blockedUntil,
        total: input.product.quantity,
        available,
        reserved,
        requestedQuantity: input.requestedQuantity,
        isAvailable: available >= input.requestedQuantity,
        availableUnits: [],
        unavailableUnits: [],
      };
    }

    const availableUnits: ProductUnitSnapshot[] = [];
    const unavailableUnits: UnavailableUnit[] = [];

    for (const unit of input.units.filter((item) => item.productId === input.product.id)) {
      const statusReason = unavailableByStatus(unit);
      if (statusReason) {
        unavailableUnits.push(buildUnavailableUnit(unit, statusReason));
        continue;
      }

      const overlappingMaintenance = activeMaintenanceForUnit(
        input.maintenanceRecords,
        unit.id,
      ).find((record) =>
        intervalsOverlap(
          record.startAt,
          record.endAt ?? new Date(8640000000000000),
          blockedFrom,
          blockedUntil,
        ),
      );

      if (overlappingMaintenance) {
        unavailableUnits.push(
          buildUnavailableUnit(unit, "MAINTENANCE", overlappingMaintenance.endAt ?? undefined),
        );
        continue;
      }

      const overlappingReservation = reservations.find(
        (reservation) =>
          reservation.productUnitId === unit.id &&
          intervalsOverlap(
            reservation.blockedFrom,
            reservation.blockedUntil,
            blockedFrom,
            blockedUntil,
          ),
      );

      if (overlappingReservation) {
        unavailableUnits.push(
          buildUnavailableUnit(unit, "RESERVED", overlappingReservation.blockedUntil),
        );
        continue;
      }

      availableUnits.push(unit);
    }

    return {
      productId: input.product.id,
      requestedStartAt: input.requestedStartAt,
      requestedEndAt: input.requestedEndAt,
      blockedFrom,
      blockedUntil,
      total: input.units.length,
      available: availableUnits.length,
      reserved: unavailableUnits.length,
      requestedQuantity: input.requestedQuantity,
      isAvailable: availableUnits.length >= input.requestedQuantity,
      availableUnits,
      unavailableUnits,
    };
  }

  static suggestUnits(input: AvailabilityInput): ProductUnitSnapshot[] {
    return this.checkAvailability(input).availableUnits.slice(
      0,
      input.requestedQuantity,
    );
  }
}
