import { Router } from "express";
import { createRentalController } from "../controllers/rental.controller";
import { prisma } from "../lib/prisma";
import { EmployeeRepository } from "../repositories/employee.repository";
import { ProductRepository } from "../repositories/product.repository";
import { PrismaRentalRepository } from "../repositories/rental.repository";
import { RentalService } from "../services/rental.service";

const rentalRepository = new PrismaRentalRepository(prisma);
const rentalService = new RentalService(rentalRepository);
const controller = createRentalController(
  rentalService,
  new ProductRepository(prisma),
  new EmployeeRepository(prisma),
);

export const rentalRouter = Router();

rentalRouter.get("/rentals", controller.listRentals);
rentalRouter.post("/rentals", controller.createRental);
rentalRouter.get("/rentals/:id", controller.getRental);
rentalRouter.post("/rentals/:id/confirm", controller.confirmRental);
rentalRouter.post("/rentals/:id/payments", controller.addPayment);
rentalRouter.get("/calendar/events", controller.calendar);
rentalRouter.get("/reports/monthly", controller.monthlyReport);
rentalRouter.get("/dashboard", controller.dashboard);
rentalRouter.get("/products", controller.products);
rentalRouter.get("/employees", controller.employees);
