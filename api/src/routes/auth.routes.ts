import { Router } from "express";
import { createAuthController } from "../controllers/auth.controller";
import { prisma } from "../lib/prisma";
import { createRequireAuth } from "../middlewares/auth";
import { UserRepository } from "../repositories/user.repository";
import { AuthService } from "../services/auth.service";

const developmentSecret = "development-only-secret-change-before-production";
export const jwtSecret = process.env.JWT_SECRET ?? developmentSecret;

if (process.env.NODE_ENV === "production" && jwtSecret === developmentSecret) {
  throw new Error("JWT_SECRET is required in production");
}

const controller = createAuthController(
  new AuthService(new UserRepository(prisma), jwtSecret),
);

export const authRouter = Router();
authRouter.post("/login", controller.login);
authRouter.get("/me", createRequireAuth(jwtSecret), controller.me);
