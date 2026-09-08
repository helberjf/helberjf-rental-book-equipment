const prisma = require("../lib/client");
const response = require("../utils/response.utils");

module.exports = {
  getMyWishlist: async (req, res) => {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const [items, total] = await Promise.all([
        prisma.wishlist.findMany({
          where: { userId },
          skip,
          take: Number(limit),
          orderBy: { id: "desc" },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                brand: true,
                price: true,
                status: true,
                images: {
                  where: { isMain: true },
                  select: { imageUrl: true },
                  take: 1,
                },
                category: { select: { id: true, name: true } },
                type: { select: { id: true, name: true } },
              },
            },
          },
        }),
        prisma.wishlist.count({ where: { userId } }),
      ]);

      return response.success(res, 200, "List Wishlist", {
        items,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      });
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // POST /wishlist — Add wishlist
  add: async (req, res) => {
    try {
      const userId = req.user.id;
      const { productId } = req.body;

      if (!productId) {
        return response.error(res, 400, "Please provide productId");
      }
      const product = await prisma.product.findUnique({
        where: { id: Number(productId), isDeleted: false },
      });

      if (!product) {
        return response.error(res, 404, "Record not found");
      }

      if (product.status !== "ACTIVE") {
        return response.error(res, 400, "Product");
      }
      const existing = await prisma.wishlist.findUnique({
        where: {
          userId_productId: {
            userId,
            productId: Number(productId),
          },
        },
      });

      if (existing) {
        return response.error(res, 409, "Product is already in the wishlist");
      }

      const item = await prisma.wishlist.create({
        data: {
          userId,
          productId: Number(productId),
        },
      });

      return response.success(res, 201, "Add Wishlist Success", item);
    } catch (e) {
      if (e.code === "P2002") {
        return response.error(res, 409, "Product is already in the wishlist");
      }
      return response.error(res, 500, "A system error occurred");
    }
  },

  // DELETE /wishlist/:productId — Delete wishlist
  remove: async (req, res) => {
    try {
      const userId = req.user.id;
      const productId = Number(req.params.productId);

      const existing = await prisma.wishlist.findUnique({
        where: {
          userId_productId: { userId, productId },
        },
      });

      if (!existing) {
        return response.error(res, 404, "Record not found Wishlist");
      }

      await prisma.wishlist.delete({
        where: {
          userId_productId: { userId, productId },
        },
      });

      return response.success(res, 200, "Delete Wishlist Success");
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },
  check: async (req, res) => {
    try {
      const userId = req.user.id;
      const productId = Number(req.params.productId);

      const existing = await prisma.wishlist.findUnique({
        where: {
          userId_productId: { userId, productId },
        },
      });

      return response.success(res, 200, "Wishlist status", {
        inWishlist: !!existing,
      });
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },
};


