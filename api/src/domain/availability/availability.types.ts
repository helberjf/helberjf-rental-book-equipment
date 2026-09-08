export type ProductUnitStatus =
  | "AVAILABLE"
  | "MAINTENANCE"
  | "DAMAGED"
  | "LOST"
  | "INACTIVE";

export type ReservationStatus = "ACTIVE" | "RELEASED" | "CANCELLED";

export type MaintenanceStatus = "OPEN" | "CLOSED" | "CANCELLED";

export type UnavailableReason =
  | "RESERVED"
  | "MAINTENANCE"
  | "DAMAGED"
  | "LOST"
  | "INACTIVE";

export interface ProductSnapshot {
  id: number;
  name: string;
  trackIndividualUnits: boolean;
  quantity: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
}

export interface ProductUnitSnapshot {
  id: number;
  productId: number;
  identifier: string;
  status: ProductUnitStatus;
  active: boolean;
}

export interface EquipmentReservation {
  id: number;
  productId: number;
  productUnitId: number | null;
  quantity: number;
  blockedFrom: Date;
  blockedUntil: Date;
  status: ReservationStatus;
}

export interface MaintenanceRecord {
  id: number;
  productUnitId: number;
  startAt: Date;
  endAt?: Date | null;
  status: MaintenanceStatus;
}

export interface AvailabilityInput {
  product: ProductSnapshot;
  units: ProductUnitSnapshot[];
  reservations: EquipmentReservation[];
  maintenanceRecords: MaintenanceRecord[];
  requestedStartAt: Date;
  requestedEndAt: Date;
  requestedQuantity: number;
}

export interface UnavailableUnit {
  id: number;
  identifier: string;
  reason: UnavailableReason;
  availableAfter?: Date;
}

export interface AvailabilityResult {
  productId: number;
  requestedStartAt: Date;
  requestedEndAt: Date;
  blockedFrom: Date;
  blockedUntil: Date;
  total: number;
  available: number;
  reserved: number;
  requestedQuantity: number;
  isAvailable: boolean;
  availableUnits: ProductUnitSnapshot[];
  unavailableUnits: UnavailableUnit[];
}
