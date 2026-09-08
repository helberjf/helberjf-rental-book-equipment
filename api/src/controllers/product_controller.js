const prisma = require("../lib/client");
const response = require("../utils/response.utils");
const fs = require("fs");
const path = require("path");
const deleteImageFile = (imageUrl) => {
  try {
    const filePath = path.join(__dirname, "../assets", imageUrl);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {}
};

// ============================================================
// PRODUCT
// ============================================================

module.exports = {
  // POST /products
  createProduct: async (req, res) => {
    try {
      const {
        name,
        description,
        brand,
        price,
        categoryId,
        typeId,
        status = "ACTIVE",
        variants = [],
        images = [],
      } = req.body;

      if (!name || !categoryId || !typeId) {
        return response.error(res, 400, "Please fill in all required fields");
      }

      if (price !== undefined && isNaN(Number(price))) {
        return response.error(res, 400, "Price must be numeric");
      }

      if (!["ACTIVE", "INACTIVE"].includes(status)) {
        return response.error(res, 400, "Status must be ACTIVE or INACTIVE");
      }

      if (!Array.isArray(variants))
        return response.error(res, 400, "Variants must be an array");
      if (!Array.isArray(images))
        return response.error(res, 400, "Images must be an array");

      // Parallelize category and type lookups
      const [category, type] = await Promise.all([
        prisma.category.findUnique({
          where: { id: Number(categoryId) },
        }),
        prisma.type.findUnique({
          where: { id: Number(typeId) },
        }),
      ]);
      if (!category) return response.error(res, 404, "Record not found");
      if (!type || type.categoryId !== Number(categoryId)) {
        return response.error(res, 400, "type Category");
      }

      const combinationSet = new Set();

      // Validate basic data first
      for (const v of variants) {
        if (!v.sizeId || !v.colorId || !v.sku) {
          return response.error(res, 400, "Variant details are incomplete");
        }
        if (isNaN(Number(v.price)) || isNaN(Number(v.stock ?? 0))) {
          return response.error(
            res,
            400,
            "Variant price and stock must be numeric",
          );
        }
        const key = `${v.sizeId}-${v.colorId}`;
        if (combinationSet.has(key))
          return response.error(res, 400, "Duplicate size and color combination in variants");
        combinationSet.add(key);
      }

      // Batch fetch all sizes, colors, and SKUs to avoid N+1
      const sizeIds = variants.map((v) => Number(v.sizeId));
      const colorIds = variants.map((v) => Number(v.colorId));
      const skus = variants.map((v) => v.sku);

      const [sizes, colors, existingSkus] = await Promise.all([
        prisma.size.findMany({ where: { id: { in: sizeIds } } }),
        prisma.color.findMany({ where: { id: { in: colorIds } } }),
        prisma.productVariant.findMany({ where: { sku: { in: skus } } }),
      ]);

      const sizeMap = new Map(sizes.map((s) => [s.id, s]));
      const colorMap = new Map(colors.map((c) => [c.id, c]));
      const skuSet = new Set(existingSkus.map((s) => s.sku));

      // Validate using batch-fetched data
      for (const v of variants) {
        const size = sizeMap.get(Number(v.sizeId));
        if (!size) return response.error(res, 404, `Record not found size id ${v.sizeId}`);

        const color = colorMap.get(Number(v.colorId));
        if (!color)
          return response.error(res, 404, `Record not found color id ${v.colorId}`);

        if (skuSet.has(v.sku))
          return response.error(res, 400, `SKU ${v.sku} Details`);
      }

      const product = await prisma.$transaction(async (tx) => {
        return await tx.product.create({
          data: {
            name,
            description,
            brand,
            price: price !== undefined ? Number(price) : null,
            categoryId: Number(categoryId),
            typeId: Number(typeId),
            status,
            variants: variants.length
              ? {
                  create: variants.map((v) => ({
                    sizeId: Number(v.sizeId),
                    colorId: Number(v.colorId),
                    price: Number(v.price),
                    stock: Number(v.stock ?? 0),
                    sku: v.sku,
                  })),
                }
              : undefined,
            images: images.length
              ? {
                  create: images.map((img, i) => ({
                    imageUrl: img,
                    isMain: i === 0,
                  })),
                }
              : undefined,
          },
          include: { variants: true, images: true },
        });
      });

      return response.success(res, 201, "Operation completed successfully", product);
    } catch (e) {
      if (e.code === "P2002")
        return response.error(res, 400, "Duplicate value");
      return response.error(res, 500, e.message);
    }
  },

  // GET /products
  getAllProducts: async (req, res) => {
    try {
      const {
        search,
        categoryId,
        typeId,
        minPrice,
        maxPrice,
        status,
        page = 1,
        limit = 10,
        sort = "desc",
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      let priceFilter;
      if (minPrice || maxPrice) {
        priceFilter = {
          not: null,
          gte: minPrice ? Number(minPrice) : undefined,
          lte: maxPrice ? Number(maxPrice) : undefined,
        };
      }

      const where = {
        isDeleted: false,
        status: status === "" ? undefined : status || "ACTIVE",
        name: search ? { contains: search, mode: "insensitive" } : undefined,
        categoryId: categoryId ? Number(categoryId) : undefined,
        typeId: typeId ? Number(typeId) : undefined,
        price: priceFilter,
      };

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          include: {
            category: true,
            type: true,
            variants: { include: { size: true, color: true } },
            images: { where: { isMain: true }, take: 1 },
          },
          orderBy: { createdAt: sort === "asc" ? "asc" : "desc" },
          skip,
          take: Number(limit),
        }),
        prisma.product.count({ where }),
      ]);

      return response.success(res, 200, "Details", {
        data: products,
        total,
        page: Number(page),
        limit: Number(limit),
      });
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // GET /products/:id
  getProductById: async (req, res) => {
    try {
      const product = await prisma.product.findFirst({
        where: { id: Number(req.params.id), isDeleted: false },
        include: {
          category: true,
          type: true,
          variants: { include: { size: true, color: true } },
          images: true,
        },
      });

      if (!product) return response.error(res, 404, "Record not found");
      return response.success(res, 200, "Details", product);
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // PUT /products/:id
  updateProduct: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, brand, price, categoryId, typeId, status } =
        req.body;

      const existing = await prisma.product.findFirst({
        where: { id: Number(id), isDeleted: false },
      });
      if (!existing) return response.error(res, 404, "Record not found");

      if (price !== undefined && isNaN(Number(price))) {
        return response.error(res, 400, "Price must be numeric");
      }

      if (status && !["ACTIVE", "INACTIVE"].includes(status)) {
        return response.error(res, 400, "Status must be ACTIVE or INACTIVE");
      }

      if (categoryId && typeId) {
        const type = await prisma.type.findUnique({
          where: { id: Number(typeId) },
        });
        if (!type || type.categoryId !== Number(categoryId)) {
          return response.error(res, 400, "Category and type are not related");
        }
      }

      const product = await prisma.product.update({
        where: { id: Number(id) },
        data: {
          name,
          description,
          brand,
          price: price !== undefined ? Number(price) : undefined,
          categoryId: categoryId ? Number(categoryId) : undefined,
          typeId: typeId ? Number(typeId) : undefined,
          status: status || undefined,
        },
      });

      return response.success(res, 200, "Edit", product);
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // PATCH /products/:id/toggle-status
  toggleStatus: async (req, res) => {
    try {
      const existing = await prisma.product.findFirst({
        where: { id: Number(req.params.id), isDeleted: false },
      });
      if (!existing) return response.error(res, 404, "Record not found");

      const newStatus = existing.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      const product = await prisma.product.update({
        where: { id: Number(req.params.id) },
        data: { status: newStatus },
      });

      return response.success(
        res,
        200,
        `Change ${newStatus} Success`,
        product,
      );
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // DELETE /products/:id
  deleteProduct: async (req, res) => {
    try {
      const existing = await prisma.product.findFirst({
        where: { id: Number(req.params.id), isDeleted: false },
        include: { variants: true },
      });
      if (!existing) return response.error(res, 404, "Record not found");

      const usedInRental = await prisma.rentalItem.findFirst({
        where: { variant: { productId: Number(req.params.id) } },
      });
      if (usedInRental) {
        return response.error(
          res,
          400,
          "This operation is not allowed",
        );
      }

      await prisma.product.update({
        where: { id: Number(req.params.id) },
        data: { isDeleted: true, deletedAt: new Date() },
      });

      return response.success(res, 200, "Delete");
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // PATCH /products/:id/restore — Admin: Restore soft-delete
  restoreProduct: async (req, res) => {
    try {
      const id = Number(req.params.id);

      const existing = await prisma.product.findFirst({
        where: { id, isDeleted: true },
      });
      if (!existing) {
        return response.error(res, 404, "Record not found");
      }

      const product = await prisma.product.update({
        where: { id },
        data: { isDeleted: false, deletedAt: null, status: "INACTIVE" },
        include: { variants: true, images: true, category: true, type: true },
      });

      return response.success(
        res,
        200,
        "Operation completed successfully (status: INACTIVE — Open)",
        product,
      );
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // GET /products/deleted — Admin: List soft-delete
  getDeletedProducts: async (req, res) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where: { isDeleted: true },
          include: {
            category: true,
            type: true,
            images: { where: { isMain: true }, take: 1 },
          },
          orderBy: { deletedAt: "desc" },
          skip,
          take: Number(limit),
        }),
        prisma.product.count({ where: { isDeleted: true } }),
      ]);

      return response.success(res, 200, "Delete", {
        data: products,
        total,
        page: Number(page),
        limit: Number(limit),
      });
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // ============================================================
  // VARIANT (sub-resource of Product)
  // ============================================================

  // GET /products/variants — Get all variants with pagination and search
  getAllVariants: async (req, res) => {
    try {
      const { page = 1, limit = 100, search = "" } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const where = {
        ...(search && {
          OR: [
            { sku: { contains: search, mode: "insensitive" } },
            { product: { name: { contains: search, mode: "insensitive" } } },
          ],
        }),
      };

      const [variants, total] = await Promise.all([
        prisma.productVariant.findMany({
          where,
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
          orderBy: { id: "desc" },
          skip,
          take: Number(limit),
        }),
        prisma.productVariant.count({ where }),
      ]);

      return response.success(res, 200, "Details variants", {
        result: variants,
        total,
        page: Number(page),
        limit: Number(limit),
      });
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // POST /products/:productId/variants
  createVariant: async (req, res) => {
    try {
      let { sizeId, colorId, size, color, colorHex, price, stock, sku } =
        req.body;
      const productId = Number(req.params.productId);

      price = Number(price);
      stock = stock !== undefined ? Number(stock) : 0;
      sku = sku?.trim();

      if (!productId || isNaN(price) || !sku)
        return response.error(res, 400, "Details");
      if (price < 0 || stock < 0)
        return response.error(res, 400, "Price must be numeric stock Details >= 0");

      const product = await prisma.product.findFirst({
        where: { id: productId, isDeleted: false },
      });
      if (!product) return response.error(res, 404, "Record not found");

      let sizeRecord;
      if (sizeId) {
        sizeRecord = await prisma.size.findUnique({
          where: { id: Number(sizeId) },
        });
        if (!sizeRecord) return response.error(res, 404, "Record not found size");
      } else if (size) {
        sizeRecord = await prisma.size.upsert({
          where: { name: size.trim() },
          update: {},
          create: { name: size.trim() },
        });
      } else {
        return response.error(res, 400, "Please provide sizeId or size");
      }

      let colorRecord;
      if (colorId) {
        colorRecord = await prisma.color.findUnique({
          where: { id: Number(colorId) },
        });
        if (!colorRecord) return response.error(res, 404, "Record not found color");
      } else if (color) {
        colorRecord = await prisma.color.upsert({
          where: { name: color.trim() },
          update: colorHex ? { hex: colorHex } : {},
          create: { name: color.trim(), hex: colorHex || null },
        });
      } else {
        return response.error(res, 400, "Please provide colorId or color");
      }

      const existSku = await prisma.productVariant.findUnique({
        where: { sku },
      });
      if (existSku) return response.error(res, 400, "SKU already exists");

      const existVariant = await prisma.productVariant.findFirst({
        where: { productId, sizeId: sizeRecord.id, colorId: colorRecord.id },
      });
      if (existVariant)
        return response.error(res, 400, "Variant already exists");

      const variant = await prisma.productVariant.create({
        data: {
          productId,
          sizeId: sizeRecord.id,
          colorId: colorRecord.id,
          price,
          stock,
          sku,
        },
        include: { product: true, size: true, color: true },
      });

      return response.success(res, 201, "Add variant Success", variant);
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // GET /products/:productId/variants
  getVariantsByProduct: async (req, res) => {
    try {
      const productId = Number(req.params.productId);
      if (!productId || isNaN(productId))
        return response.error(res, 400, "productId Invalid value");

      const variants = await prisma.productVariant.findMany({
        where: { productId },
        include: { size: true, color: true },
        orderBy: { id: "desc" },
      });

      return response.success(res, 200, "Details variants", variants);
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // GET /variants/:id
  getVariantById: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id || isNaN(id)) return response.error(res, 400, "id Invalid value");

      const variant = await prisma.productVariant.findUnique({
        where: { id },
        include: { product: true, size: true, color: true },
      });

      if (!variant) return response.error(res, 404, "Record not found variant");
      return response.success(res, 200, "Details variant", variant);
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // PUT /variants/:id
  updateVariant: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id || isNaN(id)) return response.error(res, 400, "id Invalid value");

      let { price, stock, sku } = req.body;

      const variant = await prisma.productVariant.findUnique({ where: { id } });
      if (!variant) return response.error(res, 404, "Record not found variant");

      const data = {};

      if (price !== undefined) {
        price = Number(price);
        if (isNaN(price) || price < 0)
          return response.error(res, 400, "Price must be numeric 0");
        data.price = price;
      }

      if (stock !== undefined) {
        stock = Number(stock);
        if (isNaN(stock) || stock < 0)
          return response.error(res, 400, "Stock must be greater than or equal to 0");
        data.stock = stock;
      }

      if (sku !== undefined) {
        sku = sku.trim();
        const existSku = await prisma.productVariant.findFirst({
          where: { sku, NOT: { id } },
        });
        if (existSku) return response.error(res, 400, "SKU already exists");
        data.sku = sku;
      }

      const updated = await prisma.productVariant.update({
        where: { id },
        data,
        include: { size: true, color: true },
      });

      return response.success(res, 200, "Edit variant Success", updated);
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // PATCH /variants/:id/stock
  updateStock: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id || isNaN(id)) return response.error(res, 400, "id Invalid value");

      let { stock } = req.body;
      stock = Number(stock);
      if (isNaN(stock) || stock < 0)
        return response.error(res, 400, "Stock must be greater than or equal to 0");

      const variant = await prisma.productVariant.findUnique({ where: { id } });
      if (!variant) return response.error(res, 404, "Record not found variant");
      const reservedQty = await prisma.rentalItem.aggregate({
        where: {
          productVariantId: id,
          rental: { status: { in: ["CONFIRMED", "ACTIVE", "LATE"] } },
        },
        _sum: { quantity: true },
      });
      const reserved = reservedQty._sum.quantity || 0;
      const currentTotal = variant.stock + reserved;
      if (stock > currentTotal) {
      }
      if (stock < reserved) {
        return response.error(
          res,
          400,
          `This operation is not allowed stock Reservation (${reserved} Details)`,
        );
      }
      const newAvailable = stock - reserved;
      const updated = await prisma.productVariant.update({
        where: { id },
        data: { stock: newAvailable },
      });
      return response.success(res, 200, "Edit stock Success", updated);
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // DELETE /variants/:id
  deleteVariant: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id || isNaN(id)) return response.error(res, 400, "id Invalid value");

      const variant = await prisma.productVariant.findUnique({ where: { id } });
      if (!variant) return response.error(res, 404, "Record not found variant");

      const [usedInRental, usedInCart, usedInReservation] = await Promise.all([
        prisma.rentalItem.findFirst({ where: { productVariantId: id } }),
        prisma.cartItem.findFirst({ where: { productVariantId: id } }),
        prisma.stockReservation.findFirst({ where: { productVariantId: id } }),
      ]);

      if (usedInRental || usedInCart || usedInReservation) {
        return response.error(
          res,
          400,
          "This operation is not allowed Variant already exists",
        );
      }

      await prisma.productVariant.delete({ where: { id } });
      return response.success(res, 200, "Delete variant Success");
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // ============================================================
  // PRODUCT IMAGE (sub-resource of Product)
  // ============================================================
  addImage: async (req, res) => {
    try {
      const productId = Number(req.params.productId);

      if (!req.files || req.files.length === 0) {
        return response.error(
          res,
          400,
          "Password must include at least one uppercase letter and one number",
        );
      }

      const product = await prisma.product.findFirst({
        where: { id: productId, isDeleted: false },
      });

      if (!product) {
        // Delete
        req.files.forEach((f) => deleteImageFile(`/uploads/${f.filename}`));
        return response.error(res, 404, "Record not found");
      }
      const hasMain = await prisma.productImage.findFirst({
        where: { productId, isMain: true },
      });

      await prisma.productImage.createMany({
        data: req.files.map((f, i) => ({
          productId,
          imageUrl: `/uploads/${f.filename}`,
          isMain: !hasMain && i === 0,
        })),
      });

      const created = await prisma.productImage.findMany({
        where: { productId },
        orderBy: [{ isMain: "desc" }, { id: "asc" }],
      });

      return response.success(
        res,
        201,
        `Details ${req.files.length} Operation completed successfully`,
        created,
      );
    } catch (e) {
      if (req.files)
        req.files.forEach((f) => deleteImageFile(`/uploads/${f.filename}`));
      return response.error(res, 500, e.message);
    }
  },

  // GET /products/:productId/images
  getImagesByProduct: async (req, res) => {
    try {
      const images = await prisma.productImage.findMany({
        where: { productId: Number(req.params.productId) },
        orderBy: [{ isMain: "desc" }, { id: "asc" }],
      });
      return response.success(res, 200, "Details", images);
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // PATCH /images/:id/main
  setMainImage: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const image = await prisma.productImage.findUnique({ where: { id } });
      if (!image) return response.error(res, 404, "Record not found");

      const updated = await prisma.$transaction(async (tx) => {
        await tx.productImage.updateMany({
          where: { productId: image.productId },
          data: { isMain: false },
        });
        return await tx.productImage.update({
          where: { id },
          data: { isMain: true },
        });
      });

      return response.success(res, 200, "Operation completed successfully", updated);
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // PUT /images/:id — Delete disk
  updateImage: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const image = await prisma.productImage.findUnique({ where: { id } });
      if (!image) {
        if (req.file) deleteImageFile(`/uploads/${req.file.filename}`);
        return response.error(res, 404, "Record not found");
      }

      if (!req.file) {
        return response.error(res, 400, "Details");
      }

      const oldImageUrl = image.imageUrl;

      const updated = await prisma.productImage.update({
        where: { id },
        data: { imageUrl: `/uploads/${req.file.filename}` },
      });
      deleteImageFile(oldImageUrl);

      return response.success(res, 200, "Operation completed successfully", updated);
    } catch (e) {
      if (req.file) deleteImageFile(`/uploads/${req.file.filename}`);
      return response.error(res, 500, e.message);
    }
  },

  // DELETE /images/:id
  deleteImage: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const image = await prisma.productImage.findUnique({ where: { id } });
      if (!image) return response.error(res, 404, "Record not found");

      const imageCount = await prisma.productImage.count({
        where: { productId: image.productId },
      });
      if (imageCount === 1) {
        return response.error(res, 400, "This operation is not allowed");
      }

      await prisma.$transaction(async (tx) => {
        await tx.productImage.delete({ where: { id } });
        if (image.isMain) {
          const firstImage = await tx.productImage.findFirst({
            where: { productId: image.productId },
          });
          if (firstImage) {
            await tx.productImage.update({
              where: { id: firstImage.id },
              data: { isMain: true },
            });
          }
        }
      });
      deleteImageFile(image.imageUrl);

      return response.success(res, 200, "Delete", null);
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },
};


