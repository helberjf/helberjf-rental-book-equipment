import type { PrismaClient } from "@prisma/client";

export class EmployeeRepository {
  constructor(private readonly client: PrismaClient) {}

  listActive() {
    return this.client.employee.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });
  }
}
