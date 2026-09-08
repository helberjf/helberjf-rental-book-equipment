import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { rentalRouter } from "./routes/rental.routes";

export const app = express();

app.disable("x-powered-by");
app.use(
  cors({
    origin: process.env.FRONTEND_URL?.split(",").map((origin) => origin.trim()) ?? true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/ping", (_request, response) => {
  response.json({ ok: true });
});
app.use("/api", rentalRouter);

app.use((_request, response) => {
  response.status(404).json({ success: false, message: "Route not found" });
});

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      success: false,
      message: "Invalid request data",
      errors: error.issues,
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const status = error.code === "P2025" ? 404 : error.code === "P2002" ? 409 : 400;
    response.status(status).json({ success: false, message: "Database request failed" });
    return;
  }

  const message = error instanceof Error ? error.message : "Unexpected error";
  const status = message.includes("already reserved") ? 409 : message.includes("not found") ? 404 : 400;
  response.status(status).json({ success: false, message });
};

app.use(errorHandler);

export default app;
