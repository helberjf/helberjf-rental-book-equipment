const prisma = require("../lib/client");
const response = require("../utils/response.utils");

module.exports = {
  getMyCart: async (req, res) => {
    try {
      const userId = req.user.id;

      const cart = await prisma.cart.findUnique({
        where: { userId },
        include: {
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
            orderBy: { id: "asc" },
          },
        },
      });

      if (!cart) {
        return response.success(res, 200, "Product", {
          items: [],
          total: 0,
        });
      }

      const total = cart.items.reduce(
        (sum, item) => sum + item.variant.price * item.quantity,
        0,
      );

      return response.success(res, 200, "Product", {
        id: cart.id,
        items: cart.items,
        total,
      });
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // POST /cart/items — Add
  addItem: async (req, res) => {
    try {
      const userId = req.user.id;
      const { productVariantId, quantity } = req.body;

      if (!productVariantId || !quantity) {
        return response.error(
          res,
          400,
          "Please provide productVariantId and quantity",
        );
      }

      if (Number(quantity) < 1) {
        return response.error(res, 400, "Quantity must be greater than 0");
      }

      const [variant, cart] = await Promise.all([
        prisma.productVariant.findUnique({
          where: { id: Number(productVariantId) },
          include: {
            product: { select: { isDeleted: true, status: true } },
          },
        }),
        prisma.cart.upsert({
          where: { userId },
          create: { userId },
          update: {},
        }),
      ]);

      if (!variant) {
        return response.error(res, 404, "Record not found");
      }

      if (variant.product.isDeleted || variant.product.status !== "ACTIVE") {
        return response.error(res, 400, "Product");
      }

      if (variant.stock < Number(quantity)) {
        return response.error(res, 400, "Product");
      }

      const existing = await prisma.cartItem.findFirst({
        where: {
          cartId: cart.id,
          productVariantId: Number(productVariantId),
        },
      });

      if (existing) {
        const newQuantity = existing.quantity + Number(quantity);
        if (variant.stock < newQuantity) {
          return response.error(res, 400, "Product");
        }
        await prisma.cartItem.update({
          where: { id: existing.id },
          data: { quantity: newQuantity },
        });
      } else {
        await prisma.cartItem.create({
          data: {
            cartId: cart.id,
            productVariantId: Number(productVariantId),
            quantity: Number(quantity),
          },
        });
      }

      const updatedCart = await prisma.cart.findUnique({
        where: { id: cart.id },
        include: {
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
        },
      });

      return response.success(
        res,
        200,
        "Operation completed successfully",
        updatedCart,
      );
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // PATCH /cart/items/:itemId — Update
  updateItem: async (req, res) => {
    try {
      const userId = req.user.id;
      const itemId = Number(req.params.itemId);
      const { quantity } = req.body;

      if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
        return response.error(res, 400, "Quantity 0");
      }
      const item = await prisma.cartItem.findFirst({
        where: {
          id: itemId,
          cart: { userId },
        },
        include: { variant: true },
      });

      if (!item) {
        return response.error(res, 404, "Record not found");
      }

      if (item.variant.stock < Number(quantity)) {
        return response.error(res, 400, "Product");
      }

      const updated = await prisma.cartItem.update({
        where: { id: itemId },
        data: { quantity: Number(quantity) },
      });

      return response.success(res, 200, "Operation completed successfully", updated);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },
  removeItem: async (req, res) => {
    try {
      const userId = req.user.id;
      const itemId = Number(req.params.itemId);

      const item = await prisma.cartItem.findFirst({
        where: {
          id: itemId,
          cart: { userId },
        },
      });

      if (!item) {
        return response.error(res, 404, "Record not found");
      }

      await prisma.cartItem.delete({ where: { id: itemId } });

      return response.success(res, 200, "Operation completed successfully");
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },
  clearCart: async (req, res) => {
    try {
      const userId = req.user.id;

      const cart = await prisma.cart.findUnique({ where: { userId } });

      if (!cart) {
        return response.success(res, 200, "Details");
      }

      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

      return response.success(res, 200, "Operation completed successfully");
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },
};


