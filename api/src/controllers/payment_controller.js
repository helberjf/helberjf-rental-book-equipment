const prisma = require("../lib/client");
const response = require("../utils/response.utils");
const { log: auditLog } = require("./admin_controller");
const generateInvoiceNo = async (tx = prisma) => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `INV-${date}-`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${prefix}::text))`;
  const result = await tx.$queryRaw`
    SELECT COUNT(*)::int AS count FROM "Invoice"
    WHERE "invoiceNo" LIKE ${prefix + "%"}
  `;
  const seq = String((result[0]?.count ?? 0) + 1).padStart(4, "0");
  return `${prefix}${seq}`;
};

// ============================================================
// PAYMENT
// ============================================================

module.exports = {
  // GET /payments — Admin: List (filter by status: PENDING / APPROVED / REJECTED)
  getAll: async (req, res) => {
    try {
      const { page = 1, limit = 20, status, type } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const validStatuses = ["PENDING", "APPROVED", "REJECTED"];
      const validTypes = ["RENTAL", "DEPOSIT", "PENALTY"];

      const where = {
        ...(status && validStatuses.includes(status) && { status }),
        ...(type && validTypes.includes(type) && { type }),
      };

      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: "desc" },
          include: {
            rental: {
              select: {
                code: true,
                status: true,
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        }),
        prisma.payment.count({ where }),
      ]);

      return response.success(res, 200, "List", {
        payments,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      });
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // GET /payments/:id — Admin or owner
  getById: async (req, res) => {
    try {
      const id = Number(req.params.id);

      const payment = await prisma.payment.findUnique({
        where: { id },
        include: {
          rental: {
            select: {
              id: true,
              code: true,
              status: true,
              userId: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      if (!payment) return response.error(res, 404, "Record not found");

      if (req.user.role !== "ADMIN" && payment.rental.userId !== req.user.id) {
        return response.error(res, 403, "Access denied");
      }

      return response.success(res, 200, "Details", payment);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // GET /payments/rental/:rentalId
  getByRentalId: async (req, res) => {
    try {
      const rentalId = Number(req.params.rentalId);
      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
      });
      if (!rental) return response.error(res, 404, "Record not found");

      if (req.user.role !== "ADMIN" && rental.userId !== req.user.id) {
        return response.error(res, 403, "Access denied");
      }

      const payments = await prisma.payment.findMany({
        where: { rentalId },
        orderBy: { createdAt: "desc" },
      });

      return response.success(res, 200, "Payment", payments);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // POST /payments — User Payment
  create: async (req, res) => {
    try {
      const userId = req.user.id;
      const { rentalId, amount, type } = req.body;
      const validTypes = ["RENTAL", "DEPOSIT", "PENALTY"];

      if (!rentalId || !amount || !type)
        return response.error(res, 400, "Please fill in all required fields");
      if (!validTypes.includes(type))
        return response.error(res, 400, "Invalid value");
      if (isNaN(Number(amount)) || Number(amount) <= 0) {
        return response.error(res, 400, "Quantity 0");
      }

      const rental = await prisma.rental.findUnique({
        where: { id: Number(rentalId) },
      });
      if (!rental) return response.error(res, 404, "Record not found");

      if (req.user.role !== "ADMIN" && rental.userId !== userId) {
        return response.error(res, 403, "Access denied");
      }

      if (["CANCELLED", "COMPLETED"].includes(rental.status)) {
        return response.error(res, 400, "This operation is not allowed");
      }
      if (type === "RENTAL" && rental.paymentStatus === "APPROVED") {
        return response.error(res, 400, "List");
      }
      const existingPending = await prisma.payment.findFirst({
        where: {
          rentalId: Number(rentalId),
          type,
          status: "PENDING",
        },
      });
      if (existingPending) {
        return response.error(
          res,
          409,
          "List Admin Confirm action",
        );
      }

      const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

      const payment = await prisma.payment.create({
        data: {
          rentalId: Number(rentalId),
          amount: Number(amount),
          type,
          imageUrl,
          status: "PENDING",
        },
      });

      return response.success(
        res,
        201,
        "Operation completed successfully",
        payment,
      );
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // PATCH /payments/:id/approve — Admin
  approve: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const paymentCheck = await prisma.payment.findUnique({ where: { id } });
      if (!paymentCheck) return response.error(res, 404, "Record not found");

      await prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw`
          SELECT id, status, type, amount, "rentalId"
          FROM "Payment" WHERE id = ${id} FOR UPDATE
        `;
        const payment = locked[0];
        if (!payment) throw new Error("NOT_FOUND");
        if (payment.status !== "PENDING") throw new Error("ALREADY_PROCESSED");

        await tx.payment.update({
          where: { id },
          data: { status: "APPROVED" },
        });

        const rental = await tx.rental.findUnique({
          where: { id: payment.rentalId },
        });

        if (payment.type === "DEPOSIT") {
          const existDeposit = await tx.deposit.findUnique({
            where: { rentalId: rental.id },
          });
          if (existDeposit) {
            if (existDeposit.status !== "HELD") {
              throw new Error("DEPOSIT_ALREADY_PROCESSED");
            }
          } else {
            await tx.deposit.create({
              data: {
                rentalId: rental.id,
                amount: payment.amount,
                status: "HELD",
              },
            });
            await tx.rental.update({
              where: { id: rental.id },
              data: { depositAmount: payment.amount },
            });
          }
        }

        if (payment.type === "RENTAL") {
          const prevApproved = await tx.payment.findMany({
            where: {
              rentalId: rental.id,
              type: "RENTAL",
              status: "APPROVED",
              NOT: { id },
            },
          });
          const totalPaid =
            prevApproved.reduce((sum, p) => sum + p.amount, 0) + payment.amount;
          if (totalPaid >= rental.totalPrice) {
            await tx.rental.update({
              where: { id: rental.id },
              data: { paymentStatus: "APPROVED" },
            });
          }
        }
      });

      const updated = await prisma.payment.findUnique({ where: { id } });
      await auditLog(
        `PAYMENT_APPROVED: payment #${id} (rental #${paymentCheck.rentalId}, type: ${paymentCheck.type}, amount: ${paymentCheck.amount}) approved by admin #${req.user.id}`,
        req.user.id,
      );
      return response.success(res, 200, "Operation completed successfully", updated);
    } catch (e) {
      if (e.message === "NOT_FOUND")
        return response.error(res, 404, "Record not found");
      if (e.message === "ALREADY_PROCESSED")
        return response.error(res, 400, "List");
      if (e.message === "DEPOSIT_ALREADY_PROCESSED") {
        return response.error(
          res,
          400,
          "This operation is not allowed",
        );
      }
      return response.error(res, 500, "A system error occurred");
    }
  },

  // PATCH /payments/:id/reject — Admin
  reject: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const payment = await prisma.payment.findUnique({ where: { id } });
      if (!payment) return response.error(res, 404, "Record not found");

      if (payment.status !== "PENDING") {
        return response.error(res, 400, "List");
      }

      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id },
          data: { status: "REJECTED" },
        });
        if (payment.type === "RENTAL") {
          const rental = await tx.rental.findUnique({
            where: { id: payment.rentalId },
          });
          if (rental) {
            const approvedPayments = await tx.payment.findMany({
              where: {
                rentalId: payment.rentalId,
                type: "RENTAL",
                status: "APPROVED",
              },
            });
            const totalApproved = approvedPayments.reduce(
              (sum, p) => sum + p.amount,
              0,
            );
            if (totalApproved < rental.totalPrice) {
              await tx.rental.update({
                where: { id: payment.rentalId },
                data: { paymentStatus: "PENDING" },
              });
            }
          }
        }
      });

      const updated = await prisma.payment.findUnique({ where: { id } });
      await auditLog(
        `PAYMENT_REJECTED: payment #${id} (rental #${payment.rentalId}, type: ${payment.type}, amount: ${payment.amount}) rejected by admin #${req.user.id}`,
        req.user.id,
      );
      return response.success(res, 200, "Operation completed successfully", updated);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // ============================================================
  // INVOICE (sub-resource of Rental)
  // ============================================================

  // POST /rentals/:id/invoice — Admin
  createInvoice: async (req, res) => {
    try {
      const rentalId = Number(req.params.id);

      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
        include: {
          items: {
            include: {
              variant: { include: { product: true, size: true, color: true } },
            },
          },
          user: { select: { id: true, name: true, email: true, phone: true } },
          penalties: true,
          invoice: true,
        },
      });

      if (!rental) return response.error(res, 404, "Record not found");
      if (rental.invoice)
        return response.error(res, 400, "Invoice Create");

      const penaltyTotal = rental.penalties.reduce(
        (sum, p) => sum + p.amount,
        0,
      );
      const total = rental.totalPrice + penaltyTotal;

      const invoice = await prisma.$transaction(async (tx) => {
        const invoiceNo = await generateInvoiceNo(tx);
        return tx.invoice.create({
          data: { rentalId, invoiceNo, total },
        });
      });

      return response.success(res, 201, "Create Invoice Success", {
        invoice,
        rental: {
          code: rental.code,
          user: rental.user,
          items: rental.items,
          totalPrice: rental.totalPrice,
          penalties: rental.penalties,
          penaltyTotal,
          grandTotal: total,
        },
      });
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // GET /rentals/:id/invoice
  getInvoiceByRentalId: async (req, res) => {
    try {
      const rentalId = Number(req.params.id);
      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
      });
      if (!rental) return response.error(res, 404, "Record not found");

      if (req.user.role !== "ADMIN" && rental.userId !== req.user.id) {
        return response.error(res, 403, "Access denied");
      }

      const invoice = await prisma.invoice.findUnique({ where: { rentalId } });
      if (!invoice) return response.error(res, 404, "Invoice not found");

      return response.success(res, 200, "Details Invoice", invoice);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // GET /invoices — Admin
  getAllInvoices: async (req, res) => {
    try {
      const { page = 1, limit = 20, search = "" } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const where = search
        ? { invoiceNo: { contains: search, mode: "insensitive" } }
        : {};

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: "desc" },
          include: {
            rental: {
              select: {
                code: true,
                status: true,
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        }),
        prisma.invoice.count({ where }),
      ]);

      return response.success(res, 200, "List Invoice All", {
        invoices,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      });
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // GET /invoices/:invoiceNo — Admin or owner
  getInvoiceByNo: async (req, res) => {
    try {
      const { invoiceNo } = req.params;

      const invoice = await prisma.invoice.findUnique({
        where: { invoiceNo },
        include: {
          rental: {
            select: {
              id: true,
              code: true,
              status: true,
              userId: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      if (!invoice) return response.error(res, 404, "Record not found Invoice");

      if (req.user.role !== "ADMIN" && invoice.rental.userId !== req.user.id) {
        return response.error(res, 403, "Access denied");
      }

      return response.success(res, 200, "Details Invoice", invoice);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },
};


