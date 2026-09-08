import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { AuthService, type AuthRepository } from "./auth.service";

const repository = async (): Promise<AuthRepository> => {
  const passwordHash = await bcrypt.hash("CorrectPassword123!", 4);
  return {
    async findByEmail(email) {
      return email === "admin@rentalbook.local"
        ? {
            id: 1,
            email,
            name: "Administrator",
            role: "ADMIN",
            active: true,
            passwordHash,
          }
        : null;
    },
    async findPublicById(id) {
      return id === 1
        ? { id, email: "admin@rentalbook.local", name: "Administrator", role: "ADMIN" }
        : null;
    },
  };
};

describe("AuthService", () => {
  it("returns a signed token and public user for valid credentials", async () => {
    const service = new AuthService(await repository(), "test-secret-at-least-32-characters");

    const result = await service.login("admin@rentalbook.local", "CorrectPassword123!");
    const payload = jwt.verify(result.token, "test-secret-at-least-32-characters");

    expect(result.user).toEqual({
      id: 1,
      email: "admin@rentalbook.local",
      name: "Administrator",
      role: "ADMIN",
    });
    expect(payload).toEqual(expect.objectContaining({ sub: "1", role: "ADMIN" }));
  });

  it("rejects invalid credentials without revealing which field failed", async () => {
    const service = new AuthService(await repository(), "test-secret-at-least-32-characters");

    await expect(
      service.login("admin@rentalbook.local", "WrongPassword"),
    ).rejects.toThrow("Invalid email or password");
  });
});
