import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export interface AuthUserRecord {
  id: number;
  email: string;
  name: string;
  role: "ADMIN" | "MANAGER";
  active: boolean;
  passwordHash: string;
}

export interface PublicUser {
  id: number;
  email: string;
  name: string;
  role: "ADMIN" | "MANAGER";
}

export interface AuthRepository {
  findByEmail(email: string): Promise<AuthUserRecord | null>;
  findPublicById(id: number): Promise<PublicUser | null>;
}

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly secret: string,
  ) {
    if (secret.length < 32) throw new Error("JWT secret must have at least 32 characters");
  }

  async login(email: string, password: string) {
    const user = await this.repository.findByEmail(email.trim().toLowerCase());
    const validPassword = user ? await bcrypt.compare(password, user.passwordHash) : false;

    if (!user || !user.active || !validPassword) {
      throw new Error("Invalid email or password");
    }

    const publicUser: PublicUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    const token = jwt.sign(
      { email: user.email, name: user.name, role: user.role },
      this.secret,
      { subject: String(user.id), expiresIn: "8h" },
    );

    return { token, user: publicUser };
  }

  async getUser(id: number) {
    const user = await this.repository.findPublicById(id);
    if (!user) throw new Error("User not found");
    return user;
  }
}
