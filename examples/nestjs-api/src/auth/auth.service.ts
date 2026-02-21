import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

interface User {
  id: number;
  username: string;
  password: string;
  email: string;
  role: string;
}

interface JwtPayload {
  sub: number;
  username: string;
  email: string;
  role: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// Demo only — hardcoded in-memory users with plaintext passwords.
// In production, use a real database and hash passwords with bcrypt.
const USERS: User[] = [
  {
    id: 1,
    username: "alice",
    password: "password123",
    email: "alice@example.com",
    role: "admin",
  },
  {
    id: 2,
    username: "bob",
    password: "password456",
    email: "bob@example.com",
    role: "user",
  },
];

// Demo only — load from process.env.JWT_SECRET in production.
const JWT_SECRET = "tokensmith-demo-secret";
const ACCESS_TOKEN_EXPIRY = "30s";
const REFRESH_TOKEN_EXPIRY = "7d";

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  validateUser(username: string, password: string): User | null {
    return (
      USERS.find((u) => u.username === username && u.password === password) ??
      null
    );
  }

  login(user: User): TokenPair {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };
    return {
      accessToken: this.jwtService.sign(payload, {
        expiresIn: ACCESS_TOKEN_EXPIRY,
      }),
      refreshToken: this.jwtService.sign(payload, {
        expiresIn: REFRESH_TOKEN_EXPIRY,
        secret: `${JWT_SECRET}-refresh`,
      }),
    };
  }

  refresh(refreshToken: string): TokenPair {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: `${JWT_SECRET}-refresh`,
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    const user = USERS.find((u) => u.id === payload.sub);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    return this.login(user);
  }

  getProfile(payload: JwtPayload) {
    return {
      id: payload.sub,
      username: payload.username,
      email: payload.email,
      role: payload.role,
    };
  }
}
