const prisma = require("../lib/client");
const response = require("../utils/response.utils");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

if (!process.env.SECRET_KEY) {
  throw new Error("SECRET_KEY environment variable is not configured");
}
module.exports = {
  signUp: async (req, res) => {
    try {
      let { email, password, name, phone } = req.body;

      if (typeof email !== "string") {
        return response.error(res, 400, "Invalid email format");
      }

      email = email?.trim().toLowerCase();
      name = name?.trim();
      phone = phone?.trim() || null;

      if (!email || !password || !name) {
        return response.error(res, 400, "Please fill in all required fields");
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return response.error(res, 400, "Invalid email format");
      }

      if (phone) {
        const phoneRegex = /^0[0-9]{9}$/;
        if (!phoneRegex.test(phone)) {
          return response.error(res, 400, "Invalid value");
        }
      }

      if (password.length < 8) {
        return response.error(res, 400, "Password must be at least 8 characters");
      }

      if (!/[A-Z]/.test(password)) {
        return response.error(res, 400, "Password must include at least one uppercase letter and one number");
      }

      if (!/[0-9]/.test(password)) {
        return response.error(res, 400, "Password must include at least one uppercase letter and one number");
      }

      const hashPassword = await bcrypt.hash(password, 12);

      const newUser = await prisma.user.create({
        data: {
          email,
          password: hashPassword,
          name,
          phone,
          role: "USER",
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          createdAt: true,
        },
      });

      return response.success(res, 201, "Operation completed successfully", newUser);
    } catch (e) {
      if (e.code === "P2002") {
        return response.error(res, 409, "Email already exists");
      }
      return response.error(res, 500, "A system error occurred");
    }
  },

  signIn: async (req, res) => {
    try {
      let { email, password } = req.body;

      email = email?.trim().toLowerCase();

      if (!email || !password) {
        return response.error(res, 400, "Please enter email and password");
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return response.error(res, 400, "Invalid email format");
      }

      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, name: true, password: true, role: true },
      });

      if (!user) {
        await bcrypt.compare(password, "$2a$12$dummyhashdummyhashdummyhashdum");
        return response.error(res, 401, "Email or password is incorrect");
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return response.error(res, 401, "Email or password is incorrect");
      }

      const payload = { id: user.id, name: user.name, role: user.role };

      const token = jwt.sign(payload, process.env.SECRET_KEY, {
        expiresIn: "4h",
        algorithm: "HS256",
      });

      res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 4 * 60 * 60 * 1000,
      });

      return response.success(res, 200, "Operation completed successfully", {
        id: user.id,
        name: user.name,
        role: user.role,
        token,
      });
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  signOut: async (req, res) => {
    try {
      res.clearCookie("token", {
        httpOnly: true,
        secure: true,
        sameSite: "none",
      });
      return response.success(res, 200, "Logout Success");
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },

  me: async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, email: true, name: true, phone: true, role: true },
      });

      if (!user) return response.error(res, 404, "Details");

      return response.success(res, 200, "Details", user);
    } catch {
      return response.error(res, 500, "A system error occurred");
    }
  },
};


