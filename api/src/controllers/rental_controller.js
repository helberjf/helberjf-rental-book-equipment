const prisma = require("../lib/client");
const response = require("../utils/response.utils");
const { log: auditLog } = require("./admin_controller");
const generateCode = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RNT-${date}-${rand}`;
};
const generateUniqueCode = async (tx, maxRetries = 5) => {
  for (let i = 0; i < maxRetries; i++) {
    const code = generateCode();
    const exists = await tx.rental.findUnique({ where: { code } });
    if (!exists) return code;
  }
  throw new Error("This operation is not allowed");
};

const rentalInclude = {
  user: { select: { id: true, name: true, email: true, phone: true } },
  promotion: {
    select: {
      id: true,
      name: true,
      discount: true,
      startDate: true,
      endDate: true,
    },
  },
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
  },
  invoice: {
    select: { id: true, invoiceNo: true, total: true, createdAt: true },
  },
  deposit: {
    select: { id: true, amount: true, status: true, refundedAmount: true },
  },
  penalties: {
    select: { id: true, type: true, amount: true, note: true, createdAt: true },
  },
  returnLog: {
    select: { id: true, returnedAt: true, condition: true, note: true },
  },
};

// ============================================================
// RENTAL
// ============================================================

module.exports = {
  // GET /rentals
  getAll: async (req, res) => {
    try {
      const isAdmin = req.user.role === "ADMIN";
      const { page = 1, limit = 20, status, statuses, search = "" } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const where = {
        ...(!isAdmin && { userId: req.user.id }),
        ...(status && { status }),
        ...(statuses && {
          status: {
            in: Array.isArray(statuses) ? statuses : statuses.split(","),
          },
        }),
        ...(search && {
          OR: [
            { code: { contains: search, mode: "insensitive" } },
            { user: { name: { contains: search, mode: "insensitive" } } },
          ],
        }),
      };

      const [rentals, total] = await Promise.all([
        prisma.rental.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, name: true, email: true } },
            promotion: true,
            items: {
              include: {
                variant: { include: { product: { select: { name: true } } } },
              },
            },
          },
        }),
        prisma.rental.count({ where }),
      ]);

      return response.success(res, 200, "Rentals", {
        rentals,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      });
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // GET /rentals/:id
  getById: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const rental = await prisma.rental.findUnique({
        where: { id },
        include: rentalInclude,
      });
      if (!rental) return response.error(res, 404, "Record not found");

      if (req.user.role !== "ADMIN" && rental.userId !== req.user.id) {
        return response.error(res, 403, "Access denied");
      }

      return response.success(res, 200, "Details", rental);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // POST /rentals
  create: async (req, res) => {
    try {
      const isAdmin = req.user.role === "ADMIN";
      const targetUserId =
        isAdmin && req.body.userId ? Number(req.body.userId) : req.user.id;
      let {
        startDate,
        endDate,
        items,
        promotionId,
        depositAmount,
        lateFeePerDay,
      } = req.body;

      if (!startDate || !endDate || !items?.length) {
        return response.error(res, 400, "Please fill in all required fields");
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return response.error(res, 400, "Invalid value");
      }

      if (end <= start)
        return response.error(res, 400, "Return");

      const resolvedItems = [];
      const variantIdSet = new Set();
      for (const item of items) {
        const vid = Number(item.productVariantId);
        if (variantIdSet.has(vid)) {
          return response.error(
            res,
            400,
            `productVariantId ${vid} Duplicate value items List`,
          );
        }
        variantIdSet.add(vid);
      }

      // Validate basic data first
      for (const item of items) {
        if (
          !Number.isInteger(Number(item.productVariantId)) ||
          Number(item.quantity) < 1
        ) {
          return response.error(res, 400, "Details items Invalid value");
        }
      }

      // Batch fetch all variants to avoid N+1
      const variantIds = items.map((i) => Number(i.productVariantId));
      const [variants, promo] = await Promise.all([
        prisma.productVariant.findMany({
          where: { id: { in: variantIds } },
        }),
        promotionId
          ? prisma.promotion.findUnique({
              where: { id: Number(promotionId) },
            })
          : Promise.resolve(null),
      ]);
      const variantMap = new Map(variants.map((v) => [v.id, v]));

      // Validate and calculate using batch-fetched data
      for (const item of items) {
        const variant = variantMap.get(Number(item.productVariantId));
        if (!variant) {
          return response.error(
            res,
            404,
            `Record not found variant id: ${item.productVariantId}`,
          );
        }
        if (variant.stock < Number(item.quantity)) {
          return response.error(
            res,
            400,
            `Product variant id: ${item.productVariantId} is not available`,
          );
        }
        resolvedItems.push({
          productVariantId: Number(item.productVariantId),
          quantity: Number(item.quantity),
        });
      }

      // Validate promotion (already fetched above)
      if (promo) {
        const now = new Date();
        if (now < promo.startDate || now > promo.endDate) {
          return response.error(res, 400, "Details");
        }
      }

      const rental = await prisma.$transaction(async (tx) => {
        const variantIds = resolvedItems.map((i) => i.productVariantId);
        await tx.$executeRaw`
          SELECT id FROM "ProductVariant"
          WHERE id = ANY(${variantIds}::int[])
          FOR UPDATE
        `;
        const variantsInTx = await tx.productVariant.findMany({
          where: { id: { in: variantIds } },
        });
        const variantMapInTx = new Map(variantsInTx.map((v) => [v.id, v]));

        let calcTotal = 0;
        for (const item of resolvedItems) {
          const variant = variantMapInTx.get(item.productVariantId);
          if (!variant || variant.stock < item.quantity) {
            throw new Error(
              `Product variant id: ${item.productVariantId} is not available`,
            );
          }
          calcTotal += variant.price * item.quantity;
        }
        let finalPrice = calcTotal;
        if (promotionId) {
          const promo = await tx.promotion.findUnique({
            where: { id: Number(promotionId) },
          });
          if (promo) {
            const now = new Date();
            if (now >= promo.startDate && now <= promo.endDate) {
              finalPrice = calcTotal * (1 - promo.discount / 100);
            }
          }
        }

        return tx.rental.create({
          data: {
            code: await generateUniqueCode(tx),
            userId: targetUserId,
            startDate: start,
            endDate: end,
            totalPrice: finalPrice,
            depositAmount: depositAmount ? Number(depositAmount) : null,
            lateFeePerDay: lateFeePerDay ? Number(lateFeePerDay) : 0,
            promotionId: promotionId ? Number(promotionId) : null,
            status: "PENDING",
            paymentStatus: "PENDING",
            items: { create: resolvedItems },
          },
          include: rentalInclude,
        });
      });

      return response.success(res, 201, "Operation completed successfully", rental);
    } catch (e) {
      if (e.message?.includes("Details")) {
        return response.error(res, 400, e.message);
      }
      return response.error(res, 500, "A system error occurred");
    }
  },

  // PATCH /rentals/:id/status — Admin
  updateStatus: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { status } = req.body;

      const validStatuses = [
        "PENDING",
        "CONFIRMED",
        "ACTIVE",
        "RETURNED",
        "LATE",
        "CANCELLED",
        "COMPLETED",
      ];
      if (!validStatuses.includes(status))
        return response.error(res, 400, "Invalid value");

      const existing = await prisma.rental.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!existing) return response.error(res, 404, "Record not found");
      const allowedTransitions = {
        PENDING: ["CANCELLED"],
        CONFIRMED: ["CANCELLED"],
        ACTIVE: ["LATE", "CANCELLED"],
        LATE: ["CANCELLED"],
        RETURNED: [],
        COMPLETED: [], // terminal state
        CANCELLED: [], // terminal state
      };

      const allowed = allowedTransitions[existing.status] ?? [];
      if (!allowed.includes(status)) {
        return response.error(
          res,
          400,
          `Cannot change status from ${existing.status} to ${status}`,
        );
      }
      const stockReservedStatuses = ["CONFIRMED", "ACTIVE", "LATE"];

      let rental;

      if (
        status === "CANCELLED" &&
        stockReservedStatuses.includes(existing.status)
      ) {
        await prisma.$transaction(async (tx) => {
          // Parallelize stock updates to avoid N+1
          const stockUpdates = existing.items.map((item) =>
            tx.productVariant.update({
              where: { id: item.productVariantId },
              data: { stock: { increment: item.quantity } },
            }),
          );
          await Promise.all(stockUpdates);

          await tx.stockReservation.deleteMany({ where: { rentalId: id } });
          await tx.rental.update({
            where: { id },
            data: { status, handledBy: req.user.id },
          });
        });

        rental = await prisma.rental.findUnique({
          where: { id },
          include: rentalInclude,
        });
      } else {
        rental = await prisma.rental.update({
          where: { id },
          data: { status, handledBy: req.user.id },
          include: rentalInclude,
        });
      }

      await auditLog(
        `RENTAL_STATUS_UPDATED: rental #${id} → ${status} by admin #${req.user.id}`,
        req.user.id,
      );

      return response.success(res, 200, "Operation completed successfully", rental);
    } catch (e) {
      if (e.code === "P2025")
        return response.error(res, 404, "Record not found");
      return response.error(res, 500, "A system error occurred");
    }
  },
  cancel: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const rental = await prisma.rental.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!rental) return response.error(res, 404, "Record not found");

      if (req.user.role !== "ADMIN" && rental.userId !== req.user.id) {
        return response.error(res, 403, "Access denied");
      }
      const isAdmin = req.user.role === "ADMIN";
      const cancellableByUser = ["PENDING"];
      const cancellableByAdmin = ["PENDING", "CONFIRMED"];

      const allowedStatuses = isAdmin ? cancellableByAdmin : cancellableByUser;
      if (!allowedStatuses.includes(rental.status)) {
        return response.error(
          res,
          400,
          isAdmin
            ? "Admin Confirm action"
            : "Confirm action",
        );
      }
      const stockReservedStatuses = ["CONFIRMED"];

      let updated;
      const cancelData = {
        status: "CANCELLED",
        ...(isAdmin && { handledBy: req.user.id }),
      };

      if (stockReservedStatuses.includes(rental.status)) {
        await prisma.$transaction(async (tx) => {
          // Parallelize stock updates to avoid N+1
          const stockUpdates = rental.items.map((item) =>
            tx.productVariant.update({
              where: { id: item.productVariantId },
              data: { stock: { increment: item.quantity } },
            }),
          );
          await Promise.all(stockUpdates);

          await tx.stockReservation.deleteMany({ where: { rentalId: id } });
          updated = await tx.rental.update({
            where: { id },
            data: cancelData,
          });
        });
      } else {
        updated = await prisma.rental.update({
          where: { id },
          data: cancelData,
        });
      }

      if (isAdmin) {
        await auditLog(
          `RENTAL_CANCELLED: rental #${id} cancelled by admin #${req.user.id}`,
          req.user.id,
        );
      }

      return response.success(res, 200, "Operation completed successfully", updated);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // ============================================================
  // RENTAL ITEMS (sub-resource of Rental)
  // ============================================================

  // GET /rentals/:rentalId/items
  getItems: async (req, res) => {
    try {
      const rentalId = Number(req.params.rentalId);
      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
      });
      if (!rental) return response.error(res, 404, "Record not found");

      if (req.user.role !== "ADMIN" && rental.userId !== req.user.id) {
        return response.error(res, 403, "Access denied");
      }

      const items = await prisma.rentalItem.findMany({
        where: { rentalId },
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
      });

      return response.success(res, 200, "List", items);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // GET /rentals/:rentalId/items/:itemId — Admin or owner
  getItemById: async (req, res) => {
    try {
      const rentalId = Number(req.params.rentalId);
      const itemId = Number(req.params.itemId);

      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
      });
      if (!rental) return response.error(res, 404, "Record not found");

      if (req.user.role !== "ADMIN" && rental.userId !== req.user.id) {
        return response.error(res, 403, "Access denied");
      }

      const item = await prisma.rentalItem.findFirst({
        where: { id: itemId, rentalId },
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
      });

      if (!item) return response.error(res, 404, "Record not found");

      return response.success(res, 200, "List", item);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // POST /rentals/:rentalId/items — Admin
  addItem: async (req, res) => {
    try {
      const rentalId = Number(req.params.rentalId);
      const { productVariantId, quantity } = req.body;

      if (!productVariantId || !quantity)
        return response.error(res, 400, "Please fill in all required fields");
      if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
        return response.error(res, 400, "Quantity 0");
      }

      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
      });
      if (!rental) return response.error(res, 404, "Record not found");

      if (!["PENDING", "CONFIRMED"].includes(rental.status)) {
        return response.error(res, 400, "This operation is not allowed");
      }

      const isConfirmed = rental.status === "CONFIRMED";

      const variant = await prisma.productVariant.findUnique({
        where: { id: Number(productVariantId) },
      });
      if (!variant) return response.error(res, 404, "Record not found");
      if (variant.stock < Number(quantity))
        return response.error(res, 400, "Product");

      const existing = await prisma.rentalItem.findFirst({
        where: { rentalId, productVariantId: Number(productVariantId) },
      });

      let item;
      if (isConfirmed) {
        await prisma.$transaction(async (tx) => {
          const lockedVariant = await tx.$queryRaw`
            SELECT id, stock FROM "ProductVariant" WHERE id = ${Number(productVariantId)} FOR UPDATE
          `;
          if (!lockedVariant[0] || lockedVariant[0].stock < Number(quantity)) {
            throw new Error("Product");
          }

          if (existing) {
            item = await tx.rentalItem.update({
              where: { id: existing.id },
              data: { quantity: existing.quantity + Number(quantity) },
            });
            await tx.stockReservation.updateMany({
              where: { rentalId, productVariantId: Number(productVariantId) },
              data: { startDate: rental.startDate, endDate: rental.endDate },
            });
          } else {
            item = await tx.rentalItem.create({
              data: {
                rentalId,
                productVariantId: Number(productVariantId),
                quantity: Number(quantity),
              },
            });
            await tx.stockReservation.create({
              data: {
                productVariantId: Number(productVariantId),
                rentalId,
                startDate: rental.startDate,
                endDate: rental.endDate,
              },
            });
          }

          await tx.productVariant.update({
            where: { id: Number(productVariantId) },
            data: { stock: { decrement: Number(quantity) } },
          });

          await _recalcTotalPrice(rentalId, tx);
        });
      } else {
        await prisma.$transaction(async (tx) => {
          if (existing) {
            item = await tx.rentalItem.update({
              where: { id: existing.id },
              data: { quantity: existing.quantity + Number(quantity) },
            });
          } else {
            item = await tx.rentalItem.create({
              data: {
                rentalId,
                productVariantId: Number(productVariantId),
                quantity: Number(quantity),
              },
            });
          }
          await _recalcTotalPrice(rentalId, tx);
        });
      }

      return response.success(res, 201, "Operation completed successfully", item);
    } catch (e) {
      if (e.message === "Product")
        return response.error(res, 400, e.message);
      return response.error(res, 500, "A system error occurred");
    }
  },

  // PATCH /rentals/:rentalId/items/:itemId — Admin
  updateItem: async (req, res) => {
    try {
      const rentalId = Number(req.params.rentalId);
      const itemId = Number(req.params.itemId);
      const { quantity } = req.body;

      if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
        return response.error(res, 400, "Quantity 0");
      }

      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
      });
      if (!rental) return response.error(res, 404, "Record not found");

      if (!["PENDING", "CONFIRMED"].includes(rental.status)) {
        return response.error(res, 400, "This operation is not allowed");
      }

      const isConfirmed = rental.status === "CONFIRMED";

      const item = await prisma.rentalItem.findFirst({
        where: { id: itemId, rentalId },
        include: { variant: true },
      });
      if (!item) return response.error(res, 404, "Record not found");

      const newQty = Number(quantity);
      const oldQty = item.quantity;
      const delta = newQty - oldQty;

      let updated;
      if (isConfirmed && delta !== 0) {
        if (delta > 0 && item.variant.stock < delta) {
          return response.error(res, 400, "Product");
        }
        await prisma.$transaction(async (tx) => {
          updated = await tx.rentalItem.update({
            where: { id: itemId },
            data: { quantity: newQty },
          });
          // delta > 0 → decrement stock, delta < 0 → increment stock Return
          await tx.productVariant.update({
            where: { id: item.productVariantId },
            data: { stock: { increment: -delta } },
          });
          await _recalcTotalPrice(rentalId, tx);
        });
      } else {
        // PENDING: Update qty
        if (item.variant.stock < newQty) {
          return response.error(res, 400, "Product");
        }
        await prisma.$transaction(async (tx) => {
          updated = await tx.rentalItem.update({
            where: { id: itemId },
            data: { quantity: newQty },
          });
          await _recalcTotalPrice(rentalId, tx);
        });
      }

      return response.success(res, 200, "Operation completed successfully", updated);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // DELETE /rentals/:rentalId/items/:itemId — Admin
  removeItem: async (req, res) => {
    try {
      const rentalId = Number(req.params.rentalId);
      const itemId = Number(req.params.itemId);

      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
      });
      if (!rental) return response.error(res, 404, "Record not found");

      if (!["PENDING", "CONFIRMED"].includes(rental.status)) {
        return response.error(res, 400, "This operation is not allowed");
      }

      const isConfirmed = rental.status === "CONFIRMED";

      const item = await prisma.rentalItem.findFirst({
        where: { id: itemId, rentalId },
      });
      if (!item) return response.error(res, 404, "Record not found");

      if (isConfirmed) {
        await prisma.$transaction(async (tx) => {
          await tx.rentalItem.delete({ where: { id: itemId } });
          await tx.stockReservation.deleteMany({
            where: { rentalId, productVariantId: item.productVariantId },
          });
          await tx.productVariant.update({
            where: { id: item.productVariantId },
            data: { stock: { increment: item.quantity } },
          });
          await _recalcTotalPrice(rentalId, tx);
        });
      } else {
        await prisma.$transaction(async (tx) => {
          await tx.rentalItem.delete({ where: { id: itemId } });
          await _recalcTotalPrice(rentalId, tx);
        });
      }

      return response.success(res, 200, "Operation completed successfully");
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // ============================================================
  // STOCK RESERVATION (sub-resource of Rental)
  // ============================================================

  // POST /rentals/:id/confirm — Admin: PENDING → CONFIRMED + reserve stock
  confirmAndReserve: async (req, res) => {
    try {
      const rentalId = Number(req.params.id);

      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
        include: { items: { include: { variant: true } } },
      });
      if (!rental) return response.error(res, 404, "Record not found");

      if (rental.status !== "PENDING") {
        return response.error(
          res,
          400,
          "Confirm action",
        );
      }

      for (const item of rental.items) {
        if (item.variant.stock < item.quantity) {
          return response.error(
            res,
            400,
            `Product ${item.variant.sku} Details (Details ${item.variant.stock} Details ${item.quantity})`,
          );
        }
      }

      await prisma.$transaction(async (tx) => {
        const variantIds = rental.items.map((i) => i.productVariantId);
        await tx.$executeRaw`
          SELECT id FROM "ProductVariant"
          WHERE id = ANY(${variantIds}::int[])
          FOR UPDATE
        `;

        // Parallelize stock updates and reservation creates to avoid N+1
        const stockUpdates = rental.items.map((item) =>
          tx.productVariant.update({
            where: { id: item.productVariantId },
            data: { stock: { decrement: item.quantity } },
          }),
        );
        const reservationCreates = rental.items.map((item) =>
          tx.stockReservation.create({
            data: {
              productVariantId: item.productVariantId,
              rentalId,
              startDate: rental.startDate,
              endDate: rental.endDate,
            },
          }),
        );
        await Promise.all([...stockUpdates, ...reservationCreates]);
        await tx.rental.update({
          where: { id: rentalId },
          data: { status: "CONFIRMED", handledBy: req.user.id },
        });
      });

      const updated = await prisma.rental.findUnique({
        where: { id: rentalId },
        include: {
          items: {
            include: {
              variant: { include: { product: true, size: true, color: true } },
            },
          },
          stockReservations: true,
        },
      });

      await auditLog(
        `RENTAL_CONFIRMED: rental #${rentalId} confirmed by admin #${req.user.id}`,
        req.user.id,
      );

      return response.success(res, 200, "Confirm action stock Success", updated);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // PATCH /rentals/:id/activate — Admin: CONFIRMED → ACTIVE
  activate: async (req, res) => {
    try {
      const rentalId = Number(req.params.id);
      const { pickupDate } = req.body || {};

      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
      });
      if (!rental) return response.error(res, 404, "Record not found");

      if (rental.status !== "CONFIRMED") {
        return response.error(res, 400, "Confirm action");
      }

      const pickup = pickupDate ? new Date(pickupDate) : new Date();
      if (isNaN(pickup.getTime()))
        return response.error(res, 400, "Invalid value");

      const updated = await prisma.rental.update({
        where: { id: rentalId },
        data: { status: "ACTIVE", pickupDate: pickup, handledBy: req.user.id },
      });

      await auditLog(
        `RENTAL_ACTIVATED: rental #${rentalId} activated by admin #${req.user.id}`,
        req.user.id,
      );

      return response.success(res, 200, "Operation completed successfully", updated);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // GET /rentals/handled — Admin: List (handledBy)
  getHandledByMe: async (req, res) => {
    try {
      const adminId = req.user.id;
      const { page = 1, limit = 20, status } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const where = {
        handledBy: adminId,
        ...(status && { status }),
      };

      const [rentals, total] = await Promise.all([
        prisma.rental.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, name: true, email: true } },
            promotion: true,
            items: {
              include: {
                variant: { include: { product: { select: { name: true } } } },
              },
            },
          },
        }),
        prisma.rental.count({ where }),
      ]);

      return response.success(res, 200, "List", {
        rentals,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      });
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },
  getAdminById: async (req, res) => {
    try {
      const adminId = Number(req.params.adminId);

      const [admin, rentalStats] = await Promise.all([
        prisma.user.findUnique({
          where: { id: adminId },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            createdAt: true,
          },
        }),
        prisma.rental.groupBy({
          by: ["status"],
          where: { handledBy: adminId },
          _count: { id: true },
        }),
      ]);

      if (!admin) return response.error(res, 404, "Record not found");
      if (admin.role !== "ADMIN")
        return response.error(res, 400, "User Admin");

      const statsMap = Object.fromEntries(
        rentalStats.map((r) => [r.status, r._count.id]),
      );

      return response.success(res, 200, "Details Admin", {
        ...admin,
        rentalStats: statsMap,
        totalHandled: rentalStats.reduce((sum, r) => sum + r._count.id, 0),
      });
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },
  getRentalsByAdmin: async (req, res) => {
    try {
      const adminId = Number(req.params.adminId);
      const { page = 1, limit = 20, status } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const admin = await prisma.user.findUnique({
        where: { id: adminId },
        select: { id: true, name: true, role: true },
      });
      if (!admin) return response.error(res, 404, "Record not found");
      if (admin.role !== "ADMIN")
        return response.error(res, 400, "User Admin");

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
        handledBy: adminId,
        ...(status && validStatuses.includes(status) && { status }),
      };

      const [rentals, total] = await Promise.all([
        prisma.rental.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, name: true, email: true } },
            promotion: true,
            items: {
              include: {
                variant: { include: { product: { select: { name: true } } } },
              },
            },
          },
        }),
        prisma.rental.count({ where }),
      ]);

      return response.success(res, 200, `List ${admin.name}`, {
        admin: { id: admin.id, name: admin.name },
        rentals,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      });
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // PATCH /rentals/:id/pickup — Admin: Update pickupDate (Customer)
  updatePickupDate: async (req, res) => {
    try {
      const rentalId = Number(req.params.id);
      const { pickupDate } = req.body;

      if (!pickupDate) {
        return response.error(res, 400, "Please provide pickupDate");
      }

      const pickup = new Date(pickupDate);
      if (isNaN(pickup.getTime())) {
        return response.error(res, 400, "Invalid value");
      }

      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
      });
      if (!rental) return response.error(res, 404, "Record not found");

      if (!["ACTIVE", "CONFIRMED"].includes(rental.status)) {
        return response.error(
          res,
          400,
          "Pickup date can only be updated for confirmed or active rentals",
        );
      }

      const updated = await prisma.rental.update({
        where: { id: rentalId },
        data: { pickupDate: pickup },
        include: rentalInclude,
      });

      await auditLog(
        `RENTAL_PICKUP_UPDATED: rental #${rentalId} pickupDate → ${pickup.toISOString()} by admin #${req.user.id}`,
        req.user.id,
      );

      return response.success(res, 200, "Update pickupDate Success", updated);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // PATCH /rentals/:id/complete — Admin: RETURNED → COMPLETED
  complete: async (req, res) => {
    try {
      const rentalId = Number(req.params.id);

      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
        include: { deposit: true, penalties: true },
      });
      if (!rental) return response.error(res, 404, "Record not found");

      if (rental.status !== "RETURNED") {
        return response.error(
          res,
          400,
          "Close",
        );
      }
      const pendingPayments = await prisma.payment.count({
        where: { rentalId, status: "PENDING" },
      });
      if (pendingPayments > 0) {
        return response.error(
          res,
          400,
          "List",
        );
      }
      if (rental.deposit && rental.deposit.status === "HELD") {
        return response.error(
          res,
          400,
          "Deposit (PATCH /rentals/:id/deposit/refund)",
        );
      }

      const updated = await prisma.rental.update({
        where: { id: rentalId },
        data: { status: "COMPLETED", handledBy: req.user.id },
        include: rentalInclude,
      });

      await auditLog(
        `RENTAL_COMPLETED: rental #${rentalId} completed by admin #${req.user.id}`,
        req.user.id,
      );

      return response.success(res, 200, "Operation completed successfully", updated);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // GET /reservations/:id — Admin
  getReservationById: async (req, res) => {
    try {
      const id = Number(req.params.id);

      const reservation = await prisma.stockReservation.findUnique({
        where: { id },
        include: {
          variant: {
            include: {
              product: { select: { id: true, name: true } },
              size: true,
              color: true,
            },
          },
          rental: { select: { id: true, code: true, status: true } },
        },
      });

      if (!reservation) return response.error(res, 404, "Record not found");

      return response.success(res, 200, "Details stock", reservation);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // GET /reservations — Admin
  getAllReservations: async (req, res) => {
    try {
      const { productVariantId, page = 1, limit = 20 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const where = productVariantId
        ? { productVariantId: Number(productVariantId) }
        : {};

      const [reservations, total] = await Promise.all([
        prisma.stockReservation.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { startDate: "asc" },
          include: {
            variant: {
              include: {
                product: { select: { id: true, name: true } },
                size: true,
                color: true,
              },
            },
            rental: { select: { id: true, code: true, status: true } },
          },
        }),
        prisma.stockReservation.count({ where }),
      ]);

      return response.success(res, 200, "List stock", {
        reservations,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      });
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },
  getRentalReservations: async (req, res) => {
    try {
      const rentalId = Number(req.params.id);

      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
      });
      if (!rental) return response.error(res, 404, "Record not found");

      const reservations = await prisma.stockReservation.findMany({
        where: { rentalId },
        orderBy: { id: "asc" },
        include: {
          variant: {
            include: {
              product: { select: { id: true, name: true } },
              size: true,
              color: true,
            },
          },
        },
      });

      return response.success(
        res,
        200,
        "List stock Rental",
        reservations,
      );
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // DELETE /reservations/:id — Admin: Delete reservation Return stock
  deleteReservation: async (req, res) => {
    try {
      const id = Number(req.params.id);

      const reservation = await prisma.stockReservation.findUnique({
        where: { id },
        include: {
          rental: { select: { id: true, code: true, status: true } },
          variant: { select: { id: true, sku: true, stock: true } },
        },
      });

      if (!reservation) return response.error(res, 404, "Record not found");
      const blockStatuses = ["ACTIVE", "LATE"];
      if (blockStatuses.includes(reservation.rental?.status)) {
        return response.error(
          res,
          400,
          `Cannot delete a reservation for rental status ${reservation.rental.status}; process a return or cancel the rental instead`,
        );
      }
      const rentalItem = reservation.rentalId
        ? await prisma.rentalItem.findFirst({
            where: {
              rentalId: reservation.rentalId,
              productVariantId: reservation.productVariantId,
            },
            select: { quantity: true },
          })
        : null;

      const qtyToRestore = rentalItem?.quantity ?? 1;

      await prisma.$transaction(async (tx) => {
        await tx.stockReservation.delete({ where: { id } });
        await tx.productVariant.update({
          where: { id: reservation.productVariantId },
          data: { stock: { increment: qtyToRestore } },
        });
      });

      await auditLog(
        `RESERVATION_DELETED: reservation #${id} (variant: ${reservation.variant.sku}, rental: ${reservation.rental?.code}) deleted by admin #${req.user.id}`,
        req.user.id,
      );

      return response.success(
        res,
        200,
        "Reservation deleted and stock restored successfully",
      );
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // GET /reservations/check
  checkAvailability: async (req, res) => {
    try {
      const { productVariantId, startDate, endDate, quantity = 1 } = req.query;

      if (!productVariantId || !startDate || !endDate) {
        return response.error(
          res,
          400,
          "Please provide productVariantId, startDate, endDate",
        );
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return response.error(res, 400, "Invalid value");
      }

      if (end <= start) {
        return response.error(res, 400, "Date");
      }

      const variant = await prisma.productVariant.findUnique({
        where: { id: Number(productVariantId) },
      });
      if (!variant) return response.error(res, 404, "Record not found");

      // variant.stock Quantity
      const pendingOverlapQty = await prisma.rentalItem.aggregate({
        where: {
          productVariantId: Number(productVariantId),
          rental: {
            status: "PENDING",
            startDate: { lt: end },
            endDate: { gt: start },
          },
        },
        _sum: { quantity: true },
      });

      const pendingAmount = pendingOverlapQty._sum.quantity || 0;
      const availableStock = variant.stock;

      return response.success(res, 200, "Details", {
        productVariantId: variant.id,
        sku: variant.sku,
        currentStock: variant.stock,
        pendingRentalAmount: pendingAmount,
        availableStock,
        requestedQuantity: Number(quantity),
        isAvailable: availableStock >= Number(quantity),
      });
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },
  updatePaymentStatus: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { paymentStatus } = req.body;

      const validStatuses = ["PENDING", "APPROVED", "REJECTED"];
      if (!validStatuses.includes(paymentStatus)) {
        return response.error(
          res,
          400,
          "paymentStatus Invalid value (PENDING / APPROVED / REJECTED)",
        );
      }

      const rental = await prisma.rental.findUnique({ where: { id } });
      if (!rental) return response.error(res, 404, "Record not found");

      if (["CANCELLED", "COMPLETED"].includes(rental.status)) {
        return response.error(
          res,
          400,
          "This operation is not allowed paymentStatus Close",
        );
      }

      const updated = await prisma.rental.update({
        where: { id },
        data: { paymentStatus },
        include: rentalInclude,
      });

      await auditLog(
        `RENTAL_PAYMENT_STATUS_UPDATED: rental #${id} paymentStatus → ${paymentStatus} by admin #${req.user.id}`,
        req.user.id,
      );

      return response.success(res, 200, "Update paymentStatus Success", updated);
    } catch (e) {
      if (e.code === "P2025")
        return response.error(res, 404, "Record not found");
      return response.error(res, 500, "A system error occurred");
    }
  },
};

// ============================================================
// PRIVATE HELPER
// ============================================================

async function _recalcTotalPrice(rentalId, tx = prisma) {
  const rental = await tx.rental.findUnique({
    where: { id: rentalId },
    include: {
      items: { include: { variant: true } },
      promotion: true,
    },
  });
  if (!rental) return;

  let totalPrice = rental.items.reduce(
    (sum, i) => sum + i.variant.price * i.quantity,
    0,
  );
  if (rental.promotion) {
    totalPrice = totalPrice * (1 - rental.promotion.discount / 100);
  }

  await tx.rental.update({ where: { id: rentalId }, data: { totalPrice } });
}


