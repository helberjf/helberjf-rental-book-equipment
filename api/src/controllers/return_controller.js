const prisma = require("../lib/client");
const response = require("../utils/response.utils");
const { log: auditLog } = require("./admin_controller");

// ============================================================
// RETURN & PENALTY
// ============================================================

module.exports = {
  // POST /rentals/:id/return — Admin Product
  processReturn: async (req, res) => {
    try {
      const rentalId = Number(req.params.id);
      let { returnedAt, condition, note } = req.body;

      const validConditions = ["GOOD", "DAMAGED", "LOST"];

      if (!returnedAt || !condition) {
        return response.error(res, 400, "Please provide");
      }

      if (!validConditions.includes(condition)) {
        return response.error(
          res,
          400,
          "Invalid value (GOOD / DAMAGED / LOST)",
        );
      }

      const returnDate = new Date(returnedAt);
      if (isNaN(returnDate.getTime()))
        return response.error(res, 400, "Invalid value");

      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
        include: { items: { include: { variant: true } }, deposit: true },
      });

      if (!rental) return response.error(res, 404, "Record not found");

      if (!["ACTIVE", "LATE"].includes(rental.status)) {
        return response.error(
          res,
          400,
          "Rental must be Active or Late",
        );
      }

      const existReturn = await prisma.returnLog.findUnique({
        where: { rentalId },
      });
      if (existReturn) return response.error(res, 400, "Return");
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

      const daysLate = Math.floor(
        (returnDate.getTime() - new Date(rental.endDate).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      const latePenaltyAmount =
        daysLate > 0 && rental.lateFeePerDay > 0
          ? daysLate * rental.lateFeePerDay
          : 0;

      await prisma.$transaction(async (tx) => {
        await tx.returnLog.create({
          data: {
            rentalId,
            returnedAt: returnDate,
            condition,
            note: note?.trim() || null,
          },
        });

        if (latePenaltyAmount > 0) {
          await tx.penalty.create({
            data: {
              rentalId,
              type: "LATE",
              amount: latePenaltyAmount,
              note: `Overdue ${daysLate} Date`,
            },
          });
        }

        // Parallelize stock updates to avoid N+1
        const stockUpdates = rental.items.map((item) =>
          tx.productVariant.update({
            where: { id: item.productVariantId },
            data: { stock: { increment: item.quantity } },
          }),
        );
        await Promise.all(stockUpdates);

        await tx.stockReservation.deleteMany({ where: { rentalId } });

        await tx.rental.update({
          where: { id: rentalId },
          data: {
            status: "RETURNED",
            returnDate: returnDate,
          },
        });
      });

      const updated = await prisma.rental.findUnique({
        where: { id: rentalId },
        include: { returnLog: true, penalties: true, deposit: true },
      });

      await auditLog(
        `RENTAL_RETURNED: rental #${rentalId} returned, condition: ${condition}, daysLate: ${daysLate}, latePenalty: ${latePenaltyAmount} by admin #${req.user.id}`,
        req.user.id,
      );

      return response.success(res, 200, "Operation completed successfully", {
        rental: updated,
        daysLate,
        latePenaltyAmount,
      });
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // POST /rentals/:id/penalties — Admin Add
  addPenalty: async (req, res) => {
    try {
      const rentalId = Number(req.params.id);
      let { type, amount, note } = req.body;

      const validTypes = ["LATE", "DAMAGE", "LOST"];

      if (!type || amount == null)
        return response.error(res, 400, "Please provide");
      if (!validTypes.includes(type)) {
        return response.error(
          res,
          400,
          "Invalid value (LATE / DAMAGE / LOST)",
        );
      }
      if (isNaN(Number(amount)) || Number(amount) <= 0) {
        return response.error(res, 400, "Quantity 0");
      }

      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
      });
      if (!rental) return response.error(res, 404, "Record not found");

      const penalty = await prisma.penalty.create({
        data: {
          rentalId,
          type,
          amount: Number(amount),
          note: note?.trim() || null,
        },
      });

      return response.success(res, 201, "Operation completed successfully", penalty);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // GET /rentals/:id/penalties
  getPenalties: async (req, res) => {
    try {
      const rentalId = Number(req.params.id);
      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
      });
      if (!rental) return response.error(res, 404, "Record not found");

      if (req.user.role !== "ADMIN" && rental.userId !== req.user.id) {
        return response.error(res, 403, "Access denied");
      }

      const penalties = await prisma.penalty.findMany({
        where: { rentalId },
        orderBy: { createdAt: "asc" },
      });
      const total = penalties.reduce((sum, p) => sum + p.amount, 0);

      return response.success(res, 200, "List", { penalties, total });
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // PATCH /rentals/:id/penalties/:penaltyId — Admin Edit
  updatePenalty: async (req, res) => {
    try {
      const rentalId = Number(req.params.id);
      const penaltyId = Number(req.params.penaltyId);
      let { type, amount, note } = req.body;

      const validTypes = ["LATE", "DAMAGE", "LOST"];

      const penalty = await prisma.penalty.findFirst({
        where: { id: penaltyId, rentalId },
      });
      if (!penalty) return response.error(res, 404, "Record not found");

      if (type && !validTypes.includes(type)) {
        return response.error(
          res,
          400,
          "Invalid value (LATE / DAMAGE / LOST)",
        );
      }

      if (amount !== undefined) {
        if (isNaN(Number(amount)) || Number(amount) <= 0) {
          return response.error(res, 400, "Quantity 0");
        }
      }

      const updated = await prisma.penalty.update({
        where: { id: penaltyId },
        data: {
          type: type || undefined,
          amount: amount !== undefined ? Number(amount) : undefined,
          note: note !== undefined ? note?.trim() || null : undefined,
        },
      });

      return response.success(res, 200, "Operation completed successfully", updated);
    } catch (e) {
      if (e.code === "P2025")
        return response.error(res, 404, "Record not found");
      return response.error(res, 500, "A system error occurred");
    }
  },

  // DELETE /rentals/:id/penalties/:penaltyId — Admin Delete
  removePenalty: async (req, res) => {
    try {
      const rentalId = Number(req.params.id);
      const penaltyId = Number(req.params.penaltyId);

      const penalty = await prisma.penalty.findFirst({
        where: { id: penaltyId, rentalId },
      });
      if (!penalty) return response.error(res, 404, "Record not found");

      await prisma.penalty.delete({ where: { id: penaltyId } });

      return response.success(res, 200, "Operation completed successfully");
    } catch (e) {
      if (e.code === "P2025")
        return response.error(res, 404, "Record not found");
      return response.error(res, 500, "A system error occurred");
    }
  },

  // ============================================================
  // DEPOSIT (sub-resource of Rental)
  // ============================================================

  // POST /rentals/:rentalId/deposit — Admin Create deposit
  createDeposit: async (req, res) => {
    try {
      const rentalId = Number(req.params.rentalId);
      let { amount } = req.body;
      amount = Number(amount);

      const deposit = await prisma.$transaction(async (tx) => {
        const rental = await tx.rental.findUnique({
          where: { id: rentalId },
        });
        if (!rental) throw new Error("RENTAL_NOT_FOUND");

        const existing = await tx.deposit.findUnique({ where: { rentalId } });
        if (existing) throw new Error("DEPOSIT_EXISTS");

        const dep = await tx.deposit.create({
          data: { rentalId, amount },
        });

        await tx.rental.update({
          where: { id: rentalId },
          data: { depositAmount: amount },
        });

        return dep;
      });

      return response.success(res, 201, "Deposit created", deposit);
    } catch (e) {
      if (e.message === "RENTAL_NOT_FOUND")
        return response.error(res, 404, "Record not found");
      if (e.message === "DEPOSIT_EXISTS")
        return response.error(
          res,
          400,
          "Deposit already exists for this rental",
        );
      return response.error(res, 500, "A system error occurred");
    }
  },

  // GET /deposits — Admin
  getAllDeposits: async (req, res) => {
    try {
      const { page = 1, limit = 20, status } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const validStatuses = ["HELD", "REFUNDED", "DEDUCTED"];
      const where = status && validStatuses.includes(status) ? { status } : {};

      const [deposits, total] = await Promise.all([
        prisma.deposit.findMany({
          where,
          include: {
            rental: {
              select: {
                id: true,
                code: true,
                status: true,
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: Number(limit),
        }),
        prisma.deposit.count({ where }),
      ]);
      return response.success(res, 200, "List", {
        deposits,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      });
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // GET /rentals/:rentalId/deposit
  getDepositByRental: async (req, res) => {
    try {
      const rentalId = Number(req.params.rentalId);

      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
      });
      if (!rental) return response.error(res, 404, "Record not found");

      if (req.user.role !== "ADMIN" && rental.userId !== req.user.id) {
        return response.error(res, 403, "Access denied");
      }

      const deposit = await prisma.deposit.findUnique({
        where: { rentalId },
        include: { rental: true },
      });
      if (!deposit) return response.error(res, 404, "Record not found");
      return response.success(res, 200, "Details", deposit);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // PATCH /rentals/:id/deposit/refund — Admin Refund deposit
  refundDeposit: async (req, res) => {
    try {
      const rentalId = Number(req.params.id);
      const { refundedAmount } = req.body;

      if (
        refundedAmount == null ||
        isNaN(Number(refundedAmount)) ||
        Number(refundedAmount) < 0
      ) {
        return response.error(res, 400, "Please provide");
      }

      const rentalForRefund = await prisma.rental.findUnique({
        where: { id: rentalId },
      });
      if (!rentalForRefund) return response.error(res, 404, "Record not found");

      if (rentalForRefund.status !== "RETURNED") {
        return response.error(
          res,
          400,
          "List (status: RETURNED)",
        );
      }

      const deposit = await prisma.deposit.findUnique({ where: { rentalId } });
      if (!deposit) return response.error(res, 404, "Record not found");

      if (deposit.status !== "HELD")
        return response.error(res, 400, "Deposit");

      if (Number(refundedAmount) > deposit.amount) {
        return response.error(res, 400, "Deposit");
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

      const newStatus =
        Number(refundedAmount) === deposit.amount ? "REFUNDED" : "DEDUCTED";

      const updated = await prisma.deposit.update({
        where: { rentalId },
        data: { refundedAmount: Number(refundedAmount), status: newStatus },
      });

      await auditLog(
        `DEPOSIT_REFUNDED: rental #${rentalId}, refunded: ${refundedAmount}, status: ${newStatus} by admin #${req.user.id}`,
        req.user.id,
      );

      return response.success(
        res,
        200,
        "Operation completed successfully — Close PATCH /rentals/:id/complete",
        updated,
      );
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },
  updateDeposit: async (req, res) => {
    try {
      const rentalId = Number(req.params.rentalId);
      let { amount } = req.body;
      amount = Number(amount);

      if (isNaN(amount) || amount <= 0) {
        return response.error(res, 400, "Quantity 0");
      }

      const deposit = await prisma.deposit.findUnique({ where: { rentalId } });
      if (!deposit) return response.error(res, 404, "Record not found");

      if (deposit.status !== "HELD") {
        return response.error(res, 400, "This operation is not allowed");
      }

      const updated = await prisma.$transaction(async (tx) => {
        const dep = await tx.deposit.update({
          where: { rentalId },
          data: { amount },
        });
        await tx.rental.update({
          where: { id: rentalId },
          data: { depositAmount: amount },
        });
        return dep;
      });

      await auditLog(
        `DEPOSIT_UPDATED: rental #${rentalId}, amount → ${amount} by admin #${req.user.id}`,
        req.user.id,
      );

      return response.success(res, 200, "Operation completed successfully", updated);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // PATCH /rentals/:rentalId/deposit/deduct — Admin Deduct deposit
  deductDeposit: async (req, res) => {
    try {
      const rentalId = Number(req.params.rentalId);
      let { amount } = req.body;
      amount = Number(amount);

      const deposit = await prisma.deposit.findUnique({ where: { rentalId } });
      if (!deposit) return response.error(res, 404, "Deposit not found");
      if (deposit.status !== "HELD")
        return response.error(res, 400, "Deposit already processed");
      if (amount > deposit.amount)
        return response.error(res, 400, "Deduction exceeds deposit");

      const updated = await prisma.deposit.update({
        where: { rentalId },
        data: { refundedAmount: deposit.amount - amount, status: "DEDUCTED" },
      });

      return response.success(res, 200, "Deposit deducted", updated);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },
};


