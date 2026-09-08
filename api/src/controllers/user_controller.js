const prisma = require("../lib/client");
const response = require("../utils/response.utils");
const bcrypt = require("bcryptjs");

// ============================================================
// USER
// ============================================================

module.exports = {
  // GET /users — Admin only
  getAll: async (req, res) => {
    try {
      const { page = 1, limit = 20, search = "" } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const where = search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {};

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            role: true,
            createdAt: true,
          },
        }),
        prisma.user.count({ where }),
      ]);

      return response.success(res, 200, "List", {
        users,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      });
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // GET /users/:id — Admin or self
  getById: async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (req.user.role !== "ADMIN" && req.user.id !== id) {
        return response.error(res, 403, "Access denied");
      }

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          createdAt: true,
          addresses: { select: { id: true, address: true } },
        },
      });

      if (!user) return response.error(res, 404, "Record not found");

      return response.success(res, 200, "Details", user);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // PUT /users/:id — Admin or self
  update: async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (req.user.role !== "ADMIN" && req.user.id !== id) {
        return response.error(res, 403, "Access denied");
      }

      let { name, phone } = req.body;
      name = name?.trim();
      phone = phone?.trim() || null;

      if (!name) return response.error(res, 400, "Please enter");

      if (phone) {
        const phoneRegex = /^0[0-9]{9}$/;
        if (!phoneRegex.test(phone)) {
          return response.error(res, 400, "Invalid value");
        }
      }

      const user = await prisma.user.update({
        where: { id },
        data: { name, phone },
        select: { id: true, email: true, name: true, phone: true, role: true },
      });

      return response.success(res, 200, "Operation completed successfully", user);
    } catch (e) {
      if (e.code === "P2025") return response.error(res, 404, "Record not found");
      return response.error(res, 500, "A system error occurred");
    }
  },

  // PATCH /users/:id/password — self only
  changePassword: async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (req.user.id !== id) {
        return response.error(res, 403, "Access denied");
      }

      const { oldPassword, newPassword } = req.body;

      if (!oldPassword || !newPassword) {
        return response.error(res, 400, "Please fill in all required fields");
      }

      if (newPassword.length < 8)
        return response.error(res, 400, "Password must be at least 8 characters");
      if (!/[A-Z]/.test(newPassword))
        return response.error(res, 400, "Password must include at least one uppercase letter and one number");
      if (!/[0-9]/.test(newPassword))
        return response.error(res, 400, "Password must include at least one uppercase letter and one number");

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) return response.error(res, 404, "Record not found");

      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) return response.error(res, 400, "Invalid value");

      const hashPassword = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({
        where: { id },
        data: { password: hashPassword },
      });

      return response.success(res, 200, "Operation completed successfully");
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // PATCH /users/:id/role — Admin only
  changeRole: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { role } = req.body;

      const validRoles = ["USER", "ADMIN"];
      if (!validRoles.includes(role)) {
        return response.error(res, 400, "Role Invalid value");
      }

      const user = await prisma.$transaction(async (tx) => {
        // Lock the user row and admin count check
        const target = await tx.$queryRaw`
          SELECT id, role FROM "User" WHERE id = ${id} FOR UPDATE
        `;
        if (!target.length) throw new Error("NOT_FOUND");

        if (target[0].role === "ADMIN" && role !== "ADMIN") {
          if (req.user.id === id) {
            throw new Error("CANNOT_DEMOTE_SELF");
          }
          const adminCount = await tx.user.count({
            where: { role: "ADMIN" },
          });
          if (adminCount <= 1) {
            throw new Error("LAST_ADMIN");
          }
        }

        return await tx.user.update({
          where: { id },
          data: { role },
          select: { id: true, email: true, name: true, role: true },
        });
      });

      return response.success(res, 200, "Update role Success", user);
    } catch (e) {
      if (e.message === "NOT_FOUND")
        return response.error(res, 404, "Record not found");
      if (e.message === "CANNOT_DEMOTE_SELF")
        return response.error(res, 400, "You cannot change your own role");
      if (e.message === "LAST_ADMIN")
        return response.error(
          res,
          400,
          "This operation is not allowed role Admin access required",
        );
      if (e.code === "P2025") return response.error(res, 404, "Record not found");
      return response.error(res, 500, "A system error occurred");
    }
  },

  // DELETE /users/:id — Admin only
  remove: async (req, res) => {
    try {
      const id = Number(req.params.id);

      await prisma.$transaction(async (tx) => {
        const user = await tx.$queryRaw`
          SELECT id, role FROM "User" WHERE id = ${id} FOR UPDATE
        `;
        if (!user.length) throw new Error("NOT_FOUND");

        if (req.user.id === id) {
          throw new Error("CANNOT_DELETE_SELF");
        }

        if (user[0].role === "ADMIN") {
          const adminCount = await tx.user.count({
            where: { role: "ADMIN" },
          });
          if (adminCount <= 1) {
            throw new Error("LAST_ADMIN");
          }
        }

        // Check active rentals
        const activeRental = await tx.rental.findFirst({
          where: {
            userId: id,
            status: { in: ["PENDING", "CONFIRMED", "ACTIVE", "LATE"] },
          },
          select: { id: true, code: true, status: true },
        });

        if (activeRental) {
          throw new Error(
            `ACTIVE_RENTAL:${activeRental.code}-${activeRental.status}`,
          );
        }

        await tx.user.delete({ where: { id } });
      });

      return response.success(res, 200, "Operation completed successfully");
    } catch (e) {
      if (e.message === "NOT_FOUND")
        return response.error(res, 404, "Record not found");
      if (e.message === "CANNOT_DELETE_SELF")
        return response.error(res, 400, "You cannot delete your own account");
      if (e.message === "LAST_ADMIN")
        return response.error(res, 400, "Cannot delete the last admin user");
      if (e.message?.startsWith("ACTIVE_RENTAL:")) {
        const [code, status] = e.message.split(":").slice(1);
        return response.error(
          res,
          400,
          `This operation is not allowed (${code} - ${status})`,
        );
      }
      if (e.code === "P2025") return response.error(res, 404, "Record not found");
      return response.error(res, 500, "A system error occurred");
    }
  },

  // ============================================================
  // RENTAL (sub-resource of User)
  // ============================================================

  // GET /users/me/rentals — Rental
  getMyRentals: async (req, res) => {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, status } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const validStatuses = [
        "PENDING",
        "CONFIRMED",
        "ACTIVE",
        "RETURNED",
        "LATE",
        "CANCELLED",
        "COMPLETED",
      ];
      const where = {
        userId,
        ...(status && validStatuses.includes(status) && { status }),
      };

      const [rentals, total] = await Promise.all([
        prisma.rental.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: "desc" },
          include: {
            promotion: { select: { id: true, name: true, discount: true } },
            items: {
              include: {
                variant: {
                  include: {
                    product: {
                      select: {
                        id: true,
                        name: true,
                        brand: true,
                        images: {
                          where: { isMain: true },
                          select: { imageUrl: true },
                          take: 1,
                        },
                      },
                    },
                    size: { select: { id: true, name: true } },
                    color: { select: { id: true, name: true, hex: true } },
                  },
                },
              },
            },
            payments: {
              select: {
                id: true,
                amount: true,
                status: true,
                type: true,
                createdAt: true,
              },
              orderBy: { createdAt: "desc" },
            },
            deposit: {
              select: {
                id: true,
                amount: true,
                status: true,
                refundedAmount: true,
              },
            },
            penalties: {
              select: {
                id: true,
                type: true,
                amount: true,
                note: true,
                createdAt: true,
              },
            },
            returnLog: {
              select: {
                id: true,
                returnedAt: true,
                condition: true,
                note: true,
              },
            },
            invoice: {
              select: {
                id: true,
                invoiceNo: true,
                total: true,
                createdAt: true,
              },
            },
          },
        }),
        prisma.rental.count({ where }),
      ]);

      return response.success(res, 200, "Rental", {
        rentals,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      });
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },
  getRentalsByUser: async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const { page = 1, limit = 20, status } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return response.error(res, 404, "Record not found");

      const validStatuses = [
        "PENDING",
        "CONFIRMED",
        "ACTIVE",
        "RETURNED",
        "LATE",
        "CANCELLED",
        "COMPLETED",
      ];
      const where = {
        userId,
        ...(status && validStatuses.includes(status) && { status }),
      };

      const [rentals, total] = await Promise.all([
        prisma.rental.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: "desc" },
          include: {
            promotion: true,
            items: {
              include: {
                variant: {
                  include: {
                    product: {
                      select: {
                        id: true,
                        name: true,
                        brand: true,
                        images: {
                          where: { isMain: true },
                          select: { imageUrl: true },
                          take: 1,
                        },
                      },
                    },
                    size: { select: { id: true, name: true } },
                    color: { select: { id: true, name: true, hex: true } },
                  },
                },
              },
            },
            payments: { orderBy: { createdAt: "desc" } },
            deposit: true,
            penalties: true,
            returnLog: true,
            invoice: true,
          },
        }),
        prisma.rental.count({ where }),
      ]);

      return response.success(res, 200, `Rental ${user.name}`, {
        user: { id: user.id, name: user.name, email: user.email },
        rentals,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      });
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // ============================================================
  // ADDRESS (sub-resource of User)
  // ============================================================

  // GET /addresses — Admin only: Address
  getAllAddresses: async (req, res) => {
    try {
      const { page = 1, limit = 20, search = "" } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const where = search
        ? { address: { contains: search, mode: "insensitive" } }
        : {};

      const [addresses, total] = await Promise.all([
        prisma.address.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { id: "desc" },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        }),
        prisma.address.count({ where }),
      ]);

      return response.success(res, 200, "List", {
        addresses,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      });
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // GET /users/me/addresses
  getMyAddresses: async (req, res) => {
    try {
      const userId = req.user.id;
      const addresses = await prisma.address.findMany({
        where: { userId },
        orderBy: { id: "asc" },
      });
      return response.success(res, 200, "List", addresses);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // GET /users/:userId/addresses — Admin only
  getAddressesByUser: async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      const addresses = await prisma.address.findMany({
        where: { userId },
        orderBy: { id: "asc" },
      });
      return response.success(res, 200, "List", addresses);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // POST /users/me/addresses
  createAddress: async (req, res) => {
    try {
      let { address } = req.body;
      address = address?.trim();

      if (!address) return response.error(res, 400, "Please enter");

      const newAddress = await prisma.address.create({
        data: { userId: req.user.id, address },
      });

      return response.success(res, 201, "Operation completed successfully", newAddress);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // POST /users/:userId/addresses — Admin only
  createAddressForUser: async (req, res) => {
    try {
      let { address } = req.body;
      address = address?.trim();
      if (!address) return response.error(res, 400, "Please enter");

      const userId = Number(req.params.userId);
      const newAddress = await prisma.address.create({
        data: { userId, address },
      });
      return response.success(res, 201, "Operation completed successfully", newAddress);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // PUT /users/me/addresses/:id
  updateAddress: async (req, res) => {
    try {
      const id = Number(req.params.id);
      let { address } = req.body;
      address = address?.trim();

      if (!address) return response.error(res, 400, "Please enter");

      const existing = await prisma.address.findUnique({ where: { id } });
      if (!existing) return response.error(res, 404, "Record not found");

      if (req.user.role !== "ADMIN" && existing.userId !== req.user.id) {
        return response.error(res, 403, "Access denied");
      }

      const updated = await prisma.address.update({
        where: { id },
        data: { address },
      });
      return response.success(res, 200, "Operation completed successfully", updated);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // DELETE /users/me/addresses/:id
  removeAddress: async (req, res) => {
    try {
      const id = Number(req.params.id);

      const existing = await prisma.address.findUnique({ where: { id } });
      if (!existing) return response.error(res, 404, "Record not found");

      if (req.user.role !== "ADMIN" && existing.userId !== req.user.id) {
        return response.error(res, 403, "Access denied");
      }

      await prisma.address.delete({ where: { id } });
      return response.success(res, 200, "Operation completed successfully");
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // GET /users/:userId/addresses/:id — Admin or self
  getAddressById: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const userId = Number(req.params.userId);

      if (req.user.role !== "ADMIN" && req.user.id !== userId) {
        return response.error(res, 403, "Access denied");
      }

      const address = await prisma.address.findUnique({ where: { id } });
      if (!address) return response.error(res, 404, "Record not found");

      if (address.userId !== userId) {
        return response.error(res, 400, "User");
      }

      return response.success(res, 200, "Details", address);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // GET /users/me/addresses/:id — self
  getMyAddressById: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const userId = req.user.id;

      const address = await prisma.address.findUnique({ where: { id } });
      if (!address) return response.error(res, 404, "Record not found");

      if (address.userId !== userId) {
        return response.error(res, 403, "Access denied");
      }

      return response.success(res, 200, "Details", address);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // PUT /users/:userId/addresses/:id (Admin)
  updateAddressForUser: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const userId = Number(req.params.userId);
      let { address } = req.body;
      address = address?.trim();

      if (!address) return response.error(res, 400, "Please enter");

      const existing = await prisma.address.findUnique({ where: { id } });
      if (!existing) return response.error(res, 404, "Record not found");
      if (existing.userId !== userId)
        return response.error(res, 400, "User");

      const updated = await prisma.address.update({
        where: { id },
        data: { address },
      });
      return response.success(res, 200, "Operation completed successfully", updated);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // DELETE /users/:userId/addresses/:id (Admin)
  removeAddressForUser: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const userId = Number(req.params.userId);

      const existing = await prisma.address.findUnique({ where: { id } });
      if (!existing) return response.error(res, 404, "Record not found");
      if (existing.userId !== userId)
        return response.error(res, 400, "User");

      await prisma.address.delete({ where: { id } });
      return response.success(res, 200, "Operation completed successfully");
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },
};


