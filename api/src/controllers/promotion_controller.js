const prisma = require("../lib/client");
const response = require("../utils/response.utils");

module.exports = {
  getAll: async (req, res) => {
    try {
      const isAdmin = req.user.role === "ADMIN";
      const { page = 1, limit = 20, search = "" } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const now = new Date();

      const where = {
        ...(search && { name: { contains: search, mode: "insensitive" } }),
        ...(!isAdmin && {
          startDate: { lte: now },
          endDate: { gte: now },
        }),
      };

      const [promotions, total] = await Promise.all([
        prisma.promotion.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { startDate: "desc" },
        }),
        prisma.promotion.count({ where }),
      ]);

      return response.success(res, 200, "List", {
        promotions,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      });
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // GET /promotions/:id
  getById: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const isAdmin = req.user.role === "ADMIN";

      const promotion = await prisma.promotion.findUnique({ where: { id } });

      if (!promotion) {
        return response.error(res, 404, "Record not found");
      }
      if (!isAdmin) {
        const now = new Date();
        if (promotion.startDate > now || promotion.endDate < now) {
          return response.error(res, 404, "Record not found");
        }
      }

      return response.success(res, 200, "Details", promotion);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // POST /promotions — Admin only
  create: async (req, res) => {
    try {
      let { name, discount, startDate, endDate } = req.body;

      name = name?.trim();

      if (!name || discount == null || !startDate || !endDate) {
        return response.error(res, 400, "Please fill in all required fields");
      }

      if (
        isNaN(Number(discount)) ||
        Number(discount) <= 0 ||
        Number(discount) > 100
      ) {
        return response.error(res, 400, "Discount must be between 0.01 and 100");
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return response.error(res, 400, "Invalid value");
      }

      if (end <= start) {
        return response.error(res, 400, "Date");
      }

      const promotion = await prisma.promotion.create({
        data: {
          name,
          discount: Number(discount),
          startDate: start,
          endDate: end,
        },
      });

      return response.success(res, 201, "Operation completed successfully", promotion);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // PUT /promotions/:id — Admin only
  update: async (req, res) => {
    try {
      const id = Number(req.params.id);
      let { name, discount, startDate, endDate } = req.body;

      name = name?.trim();

      if (!name || discount == null || !startDate || !endDate) {
        return response.error(res, 400, "Please fill in all required fields");
      }

      if (
        isNaN(Number(discount)) ||
        Number(discount) <= 0 ||
        Number(discount) > 100
      ) {
        return response.error(res, 400, "Discount must be between 0.01 and 100");
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return response.error(res, 400, "Invalid value");
      }

      if (end <= start) {
        return response.error(res, 400, "Date");
      }

      const promotion = await prisma.promotion.update({
        where: { id },
        data: {
          name,
          discount: Number(discount),
          startDate: start,
          endDate: end,
        },
      });

      return response.success(res, 200, "Operation completed successfully", promotion);
    } catch (e) {
      if (e.code === "P2025") return response.error(res, 404, "Record not found");
      return response.error(res, 500, "A system error occurred");
    }
  },

  // DELETE /promotions/:id — Admin only
  remove: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const activeRental = await prisma.rental.findFirst({
        where: {
          promotionId: id,
          status: { in: ["PENDING", "CONFIRMED", "ACTIVE", "LATE"] },
        },
        select: { id: true, code: true, status: true },
      });
      if (activeRental) {
        return response.error(
          res,
          400,
          `This operation is not allowed (${activeRental.code} - ${activeRental.status})`,
        );
      }

      await prisma.promotion.delete({ where: { id } });

      return response.success(res, 200, "Operation completed successfully");
    } catch (e) {
      if (e.code === "P2025") return response.error(res, 404, "Record not found");
      return response.error(res, 500, "A system error occurred");
    }
  },
};


