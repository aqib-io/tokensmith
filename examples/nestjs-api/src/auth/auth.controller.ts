import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { AuthService, type TokenPair } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";

interface AuthenticatedRequest extends Request {
  user: {
    sub: number;
    username: string;
    email: string;
    role: string;
  };
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  login(@Body() body: LoginDto): TokenPair {
    const user = this.authService.validateUser(body.username, body.password);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }
    return this.authService.login(user);
  }

  @Post("refresh")
  refresh(@Body() body: RefreshDto): TokenPair {
    return this.authService.refresh(body.refreshToken);
  }

  @UseGuards(AuthGuard("jwt"))
  @Get("profile")
  getProfile(@Request() req: AuthenticatedRequest) {
    return this.authService.getProfile(req.user);
  }
}
