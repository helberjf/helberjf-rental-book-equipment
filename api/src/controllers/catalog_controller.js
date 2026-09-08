const prisma = require("../lib/client");
const response = require("../utils/response.utils");

// ============================================================
// CATEGORY
// ============================================================

module.exports = {
  // POST /categories
  createCategory: async (req, res) => {
    try {
      const name = req.body.name?.trim();
      if (!name) return response.error(res, 400, "Please enter");

      const exist = await prisma.category.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
      });
      if (exist) return response.error(res, 400, "Category");

      const category = await prisma.category.create({ data: { name } });
      return response.success(res, 201, "Operation completed successfully", category);
    } catch (e) {
      if (e.code === "P2002")
        return response.error(res, 400, "Duplicate value");
      return response.error(res, 500, "A system error occurred");
    }
  },

  // GET /categories
  getAllCategories: async (req, res) => {
    try {
      const { search, page = 1, limit = 10 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const where = {
        name: search ? { contains: search, mode: "insensitive" } : undefined,
      };

      const [categories, total] = await Promise.all([
        prisma.category.findMany({
          where,
          include: {
            types: true,
            _count: { select: { products: { where: { isDeleted: false } } } },
          },
          orderBy: { id: "desc" },
          skip,
          take: Number(limit),
        }),
        prisma.category.count({ where }),
      ]);

      return response.success(res, 200, "Details", {
        data: categories,
        total,
        page: Number(page),
        limit: Number(limit),
      });
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // GET /categories/:id
  getCategoryById: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return response.error(res, 400, "Invalid value");

      const category = await prisma.category.findUnique({
        where: { id },
        include: {
          types: { select: { id: true, name: true } },
          products: {
            where: { isDeleted: false },
            select: { id: true, name: true, brand: true, status: true },
          },
        },
      });

      if (!category) return response.error(res, 404, "Record not found");
      return response.success(res, 200, "Details", category);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // PUT /categories/:id
  updateCategory: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const name = req.body.name?.trim();

      if (isNaN(id)) return response.error(res, 400, "Invalid value");
      if (!name) return response.error(res, 400, "Please enter");

      const existCategory = await prisma.category.findUnique({ where: { id } });
      if (!existCategory) return response.error(res, 404, "Record not found");

      const duplicate = await prisma.category.findFirst({
        where: { name: { equals: name, mode: "insensitive" }, NOT: { id } },
      });
      if (duplicate)
        return response.error(res, 400, "Category");

      const category = await prisma.category.update({
        where: { id },
        data: { name },
      });
      return response.success(res, 200, "Operation completed successfully", category);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // DELETE /categories/:id
  deleteCategory: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return response.error(res, 400, "Invalid value");

      const category = await prisma.category.findUnique({
        where: { id },
        include: {
          types: true,
          products: true,
        },
      });

      if (!category) return response.error(res, 404, "Record not found");
      if (category.types.length > 0) {
        return response.error(
          res,
          400,
          "This operation is not allowed",
        );
      }
      if (category.products.length > 0) {
        return response.error(
          res,
          400,
          "This operation is not allowed (Delete)",
        );
      }

      await prisma.category.delete({ where: { id } });
      return response.success(res, 200, "Operation completed successfully");
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // ============================================================
  // TYPE (sub-resource of Category)
  // ============================================================

  // POST /types
  createType: async (req, res) => {
    try {
      let { name, categoryId } = req.body;
      name = name?.trim();
      categoryId = Number(categoryId);

      if (!name || isNaN(categoryId)) {
        return response.error(res, 400, "Please fill in all required fields");
      }

      const category = await prisma.category.findUnique({
        where: { id: categoryId },
      });
      if (!category) return response.error(res, 404, "Record not found");

      const exist = await prisma.type.findFirst({
        where: { name: { equals: name, mode: "insensitive" }, categoryId },
      });
      if (exist)
        return response.error(res, 400, "Category");

      const type = await prisma.type.create({
        data: { name, categoryId },
        include: { category: true },
      });
      return response.success(res, 201, "Operation completed successfully", type);
    } catch (e) {
      if (e.code === "P2002")
        return response.error(res, 400, "Duplicate value");
      return response.error(res, 500, "A system error occurred");
    }
  },

  // GET /types
  getAllTypes: async (req, res) => {
    try {
      const { search, categoryId, page = 1, limit = 10 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const catId = categoryId ? Number(categoryId) : undefined;

      const where = {
        categoryId: catId && !isNaN(catId) ? catId : undefined,
        name: search ? { contains: search, mode: "insensitive" } : undefined,
      };

      const [types, total] = await Promise.all([
        prisma.type.findMany({
          where,
          include: {
            category: true,
            _count: { select: { products: { where: { isDeleted: false } } } },
          },
          orderBy: { id: "desc" },
          skip,
          take: Number(limit),
        }),
        prisma.type.count({ where }),
      ]);

      return response.success(res, 200, "Details", {
        data: types,
        total,
        page: Number(page),
        limit: Number(limit),
      });
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // GET /types/:id
  getTypeById: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return response.error(res, 400, "Invalid value");

      const type = await prisma.type.findUnique({
        where: { id },
        include: {
          category: true,
          products: { where: { isDeleted: false } },
        },
      });

      if (!type) return response.error(res, 404, "Record not found");
      return response.success(res, 200, "Details", type);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // PUT /types/:id
  updateType: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return response.error(res, 400, "Invalid value");

      let { name, categoryId } = req.body;

      const existing = await prisma.type.findUnique({ where: { id } });
      if (!existing) return response.error(res, 404, "Record not found");

      name = name?.trim();
      const newCategoryId = categoryId
        ? Number(categoryId)
        : existing.categoryId;

      if (categoryId) {
        if (isNaN(newCategoryId))
          return response.error(res, 400, "Invalid value");
        const category = await prisma.category.findUnique({
          where: { id: newCategoryId },
        });
        if (!category) return response.error(res, 404, "Record not found");
      }

      if (name) {
        const duplicate = await prisma.type.findFirst({
          where: {
            name: { equals: name, mode: "insensitive" },
            categoryId: newCategoryId,
            NOT: { id },
          },
        });
        if (duplicate)
          return response.error(res, 400, "Type");
      }

      const updated = await prisma.type.update({
        where: { id },
        data: {
          name: name || undefined,
          categoryId: categoryId ? newCategoryId : undefined,
        },
        include: { category: true },
      });

      return response.success(res, 200, "Operation completed successfully", updated);
    } catch (e) {
      if (e.code === "P2002") return response.error(res, 400, "Duplicate value");
      return response.error(res, 500, "A system error occurred");
    }
  },

  // DELETE /types/:id
  deleteType: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return response.error(res, 400, "Invalid value");

      const type = await prisma.type.findUnique({
        where: { id },
        include: { products: true },
      });

      if (!type) return response.error(res, 404, "Record not found");
      if (type.products.length > 0) {
        return response.error(
          res,
          400,
          "This operation is not allowed (Delete)",
        );
      }

      await prisma.type.delete({ where: { id } });
      return response.success(res, 200, "Operation completed successfully");
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // ============================================================
  // SIZE
  // ============================================================

  // POST /catalog/sizes — Admin only
  createSize: async (req, res) => {
    try {
      const name = req.body.name?.trim();
      if (!name) return response.error(res, 400, "Please enter size");

      const exist = await prisma.size.findUnique({ where: { name } });
      if (exist) return response.error(res, 400, "Size already exists");

      const size = await prisma.size.create({ data: { name } });
      return response.success(res, 201, "Add size Success", size);
    } catch (e) {
      if (e.code === "P2002") return response.error(res, 400, "Name size Duplicate value");
      return response.error(res, 500, "A system error occurred");
    }
  },

  // PUT /catalog/sizes/:id — Admin only
  updateSize: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return response.error(res, 400, "Invalid size id");

      const name = req.body.name?.trim();
      if (!name) return response.error(res, 400, "Please enter size");

      const existing = await prisma.size.findUnique({ where: { id } });
      if (!existing) return response.error(res, 404, "Record not found size");

      const duplicate = await prisma.size.findFirst({
        where: { name, NOT: { id } },
      });
      if (duplicate) return response.error(res, 400, "Name Size already exists");

      const size = await prisma.size.update({ where: { id }, data: { name } });
      return response.success(res, 200, "Edit size Success", size);
    } catch (e) {
      if (e.code === "P2002") return response.error(res, 400, "Name size Duplicate value");
      return response.error(res, 500, "A system error occurred");
    }
  },

  // GET /catalog/sizes
  getAllSizes: async (req, res) => {
    try {
      const { search } = req.query;

      const sizes = await prisma.size.findMany({
        where: search
          ? { name: { contains: search, mode: "insensitive" } }
          : undefined,
        include: { _count: { select: { variants: true } } },
        orderBy: { name: "asc" },
      });

      return response.success(res, 200, "Details Size", sizes);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // GET /catalog/sizes/:id
  getSizeById: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return response.error(res, 400, "Invalid size id");

      const size = await prisma.size.findUnique({
        where: { id },
        include: { _count: { select: { variants: true } } },
      });

      if (!size) return response.error(res, 404, "Record not found size");
      return response.success(res, 200, "Details Size", size);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },
  deleteSize: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return response.error(res, 400, "Invalid size id");

      const size = await prisma.size.findUnique({
        where: { id },
        include: { _count: { select: { variants: true } } },
      });

      if (!size) return response.error(res, 404, "Record not found size");

      if (size._count.variants > 0) {
        return response.error(
          res,
          400,
          "This operation is not allowed Size already exists Variant already exists",
        );
      }

      await prisma.size.delete({ where: { id } });
      return response.success(res, 200, "Delete size Success");
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // ============================================================
  // COLOR
  // ============================================================

  // POST /catalog/colors — Admin only
  createColor: async (req, res) => {
    try {
      const name = req.body.name?.trim();
      const hex = req.body.hex?.trim() || null;

      if (!name) return response.error(res, 400, "Please enter color");

      if (hex && !/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex)) {
        return response.error(
          res,
          400,
          "Invalid hex color format, for example #FFFFFF",
        );
      }

      const exist = await prisma.color.findUnique({ where: { name } });
      if (exist) return response.error(res, 400, "Color already exists");

      const color = await prisma.color.create({ data: { name, hex } });
      return response.success(res, 201, "Add color Success", color);
    } catch (e) {
      if (e.code === "P2002") return response.error(res, 400, "Name color Duplicate value");
      return response.error(res, 500, "A system error occurred");
    }
  },

  // PUT /catalog/colors/:id — Admin only
  updateColor: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return response.error(res, 400, "Invalid color id");

      const name = req.body.name?.trim();
      const hex = req.body.hex?.trim() || null;

      if (!name) return response.error(res, 400, "Please enter color");

      if (hex && !/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex)) {
        return response.error(
          res,
          400,
          "Invalid hex color format, for example #FFFFFF",
        );
      }

      const existing = await prisma.color.findUnique({ where: { id } });
      if (!existing) return response.error(res, 404, "Record not found color");

      const duplicate = await prisma.color.findFirst({
        where: { name, NOT: { id } },
      });
      if (duplicate)
        return response.error(res, 400, "Name Color already exists");

      const color = await prisma.color.update({
        where: { id },
        data: { name, hex },
      });
      return response.success(res, 200, "Edit color Success", color);
    } catch (e) {
      if (e.code === "P2002") return response.error(res, 400, "Name color Duplicate value");
      return response.error(res, 500, "A system error occurred");
    }
  },

  // GET /catalog/colors
  getAllColors: async (req, res) => {
    try {
      const { search } = req.query;

      const colors = await prisma.color.findMany({
        where: search
          ? { name: { contains: search, mode: "insensitive" } }
          : undefined,
        include: { _count: { select: { variants: true } } },
        orderBy: { name: "asc" },
      });

      return response.success(res, 200, "Details Color", colors);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  // GET /catalog/colors/:id
  getColorById: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return response.error(res, 400, "Invalid color id");

      const color = await prisma.color.findUnique({
        where: { id },
        include: { _count: { select: { variants: true } } },
      });

      if (!color) return response.error(res, 404, "Record not found color");
      return response.success(res, 200, "Details Color", color);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },
  deleteColor: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return response.error(res, 400, "Invalid color id");

      const color = await prisma.color.findUnique({
        where: { id },
        include: { _count: { select: { variants: true } } },
      });

      if (!color) return response.error(res, 404, "Record not found color");

      if (color._count.variants > 0) {
        return response.error(
          res,
          400,
          "This operation is not allowed Color already exists Variant already exists",
        );
      }

      await prisma.color.delete({ where: { id } });
      return response.success(res, 200, "Delete color Success");
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },
};


