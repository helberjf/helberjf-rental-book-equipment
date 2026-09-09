import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import type { EmployeeRepository } from "../repositories/employee.repository";
import type { ProductRepository } from "../repositories/product.repository";
import {
  createRentalSchema,
  monthlyReportQuerySchema,
  paymentSchema,
  rentalIdSchema,
  rentalListQuerySchema,
} from "../schemas/rental.schemas";
import type { RentalService } from "../services/rental.service";

type AsyncHandler = (
  request: Request,
  response: Response,
  next: NextFunction,
) => Promise<void>;

const handle = (handler: AsyncHandler) =>
  (request: Request, response: Response, next: NextFunction) => {
    void handler(request, response, next).catch(next);
  };

const ok = (response: Response, result: unknown, status = 200) => {
  response.status(status).json({ success: true, result });
};

const monthRange = (month: string) => {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  return {
    startAt: new Date(Date.UTC(year, monthIndex, 1, 3)),
    endAt: new Date(Date.UTC(year, monthIndex + 1, 1, 3)),
  };
};

export const createRentalController = (
  rentalService: RentalService,
  productRepository: ProductRepository,
  employeeRepository: EmployeeRepository,
) => ({
  listRentals: handle(async (request, response) => {
    const query = rentalListQuerySchema.parse(request.query);
    ok(response, await rentalService.listRentals(query));
  }),

  getRental: handle(async (request, response) => {
    const id = rentalIdSchema.parse(request.params.id);
    ok(response, await rentalService.getRentalById(id));
  }),

  createRental: handle(async (request, response) => {
    const parsed = createRentalSchema.parse(request.body);
    const { confirm, ...input } = parsed;
    const result = await rentalService.createRental(input, confirm);
    ok(response, result, 201);
  }),

  confirmRental: handle(async (request, response) => {
    const id = rentalIdSchema.parse(request.params.id);
    ok(response, await rentalService.confirmRental(id));
  }),

  addPayment: handle(async (request, response) => {
    const id = rentalIdSchema.parse(request.params.id);
    const payment = paymentSchema.parse(request.body);
    ok(response, await rentalService.addPayment(id, payment), 201);
  }),

  calendar: handle(async (request, response) => {
    const filters = rentalListQuerySchema.parse(request.query);
    ok(response, await rentalService.listCalendarEvents(filters));
  }),

  monthlyReport: handle(async (request, response) => {
    const { month } = monthlyReportQuerySchema.parse(request.query);
    const { startAt, endAt } = monthRange(month);
    ok(response, await rentalService.getMonthlyReport(startAt, endAt));
  }),

  dashboard: handle(async (_request, response) => {
    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const { startAt, endAt } = monthRange(month);
    const report = await rentalService.getMonthlyReport(startAt, endAt, now);
    const future = (await rentalService.listRentals({ startAt: now }))
      .filter((rental) => rental.status !== "CANCELLED")
      .slice(0, 5);
    ok(response, { ...report.totals, upcomingRentals: future });
  }),

  products: handle(async (request, response) => {
    const startAt = request.query.startAt
      ? new Date(String(request.query.startAt))
      : undefined;
    const endAt = request.query.endAt ? new Date(String(request.query.endAt)) : undefined;
    if ((startAt && !Number.isFinite(startAt.getTime())) || (endAt && !Number.isFinite(endAt.getTime()))) {
      throw new ZodError([]);
    }
    ok(response, await productRepository.listActive(startAt, endAt));
  }),

  employees: handle(async (request, response) => {
    const range = rentalListQuerySchema.parse(request.query);
    ok(response, await employeeRepository.listActive(range.startAt, range.endAt));
  }),
});
