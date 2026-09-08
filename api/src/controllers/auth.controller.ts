import type { NextFunction, Request, Response } from "express";
import { loginSchema } from "../schemas/auth.schemas";
import type { AuthService } from "../services/auth.service";

const handle = (
  handler: (request: Request, response: Response) => Promise<void>,
) => (request: Request, response: Response, next: NextFunction) => {
  void handler(request, response).catch(next);
};

export const createAuthController = (service: AuthService) => ({
  login: handle(async (request, response) => {
    const { email, password } = loginSchema.parse(request.body);
    response.json({ success: true, result: await service.login(email, password) });
  }),
  me: handle(async (_request, response) => {
    response.json({
      success: true,
      result: await service.getUser(response.locals.auth.userId),
    });
  }),
});
