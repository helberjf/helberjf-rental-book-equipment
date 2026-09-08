import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const main = async () => {
  const passwordHash = await bcrypt.hash("ChangeMe123!", 12);

  await prisma.user.upsert({
    where: { email: "admin@rentalbook.local" },
    update: { name: "Administrator", role: "ADMIN", active: true },
    create: {
      email: "admin@rentalbook.local",
      name: "Administrator",
      passwordHash,
      role: "ADMIN",
    },
  });

  const robotsCategory = await prisma.category.upsert({
    where: { name: "Robots" },
    update: { active: true },
    create: { name: "Robots", description: "LED robots for events" },
  });

  const ledEquipmentCategory = await prisma.category.upsert({
    where: { name: "LED Equipment" },
    update: { active: true },
    create: {
      name: "LED Equipment",
      description: "LED attractions and equipment",
    },
  });

  const robot = await prisma.product.upsert({
    where: { name: "LED Robot" },
    update: {
      categoryId: robotsCategory.id,
      quantity: 8,
      trackIndividualUnits: true,
      active: true,
    },
    create: {
      categoryId: robotsCategory.id,
      name: "LED Robot",
      description: "Individual LED robot unit",
      quantity: 8,
      trackIndividualUnits: true,
    },
  });

  for (let index = 1; index <= 8; index += 1) {
    const identifier = `Robot ${String(index).padStart(2, "0")}`;
    await prisma.productUnit.upsert({
      where: { identifier },
      update: { productId: robot.id, active: true, status: "AVAILABLE" },
      create: { productId: robot.id, identifier },
    });
  }

  const swing = await prisma.product.upsert({
    where: { name: "LED Swing" },
    update: {
      categoryId: ledEquipmentCategory.id,
      quantity: 1,
      trackIndividualUnits: true,
      active: true,
    },
    create: {
      categoryId: ledEquipmentCategory.id,
      name: "LED Swing",
      description: "Individual LED swing unit",
      quantity: 1,
      trackIndividualUnits: true,
    },
  });

  await prisma.productUnit.upsert({
    where: { identifier: "LED Swing 01" },
    update: { productId: swing.id, active: true, status: "AVAILABLE" },
    create: { productId: swing.id, identifier: "LED Swing 01" },
  });

  for (const name of ["Carlos", "Lucas", "Pedro"]) {
    const employee = await prisma.employee.findFirst({ where: { name } });
    if (employee) {
      await prisma.employee.update({
        where: { id: employee.id },
        data: { active: true },
      });
    } else {
      await prisma.employee.create({ data: { name } });
    }
  }
};

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
