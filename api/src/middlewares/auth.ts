import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";

export const createRequireAuth = (secret: string): RequestHandler =>
  (request, response, next) => {
    const authorization = request.header("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : null;

    if (!token) {
      response.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    try {
      const payload = jwt.verify(token, secret);
      const userId = Number(typeof payload === "string" ? NaN : payload.sub);
      if (!Number.isInteger(userId) || userId <= 0) throw new Error("Invalid subject");
      response.locals.auth = { userId };
      next();
    } catch {
      response.status(401).json({ success: false, message: "Session expired or invalid" });
    }
  };
