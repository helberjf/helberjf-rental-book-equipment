import type { PrismaClient } from "@prisma/client";
import type { AuthRepository } from "../services/auth.service";

export class UserRepository implements AuthRepository {
  constructor(private readonly client: PrismaClient) {}

  findByEmail(email: string) {
    return this.client.user.findUnique({ where: { email } });
  }

  findPublicById(id: number) {
    return this.client.user.findUnique({
      where: { id, active: true },
      select: { id: true, email: true, name: true, role: true },
    });
  }
}
