import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SessionGuard } from './guards/session.guard';
import { IsString, IsNotEmpty } from 'class-validator';

export class WalletLoginDto {
  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  signature: string;

  @IsString()
  @IsNotEmpty()
  message: string;
}

export class ZkLoginDto {
  @IsString()
  @IsNotEmpty()
  jwt: string;

  @IsString()
  @IsNotEmpty()
  salt: string;
}

export class PasskeyDto {
  @IsString()
  @IsNotEmpty()
  credentialId: string;

  @IsString()
  @IsNotEmpty()
  authenticatorData: string;

  @IsString()
  @IsNotEmpty()
  signature: string;

  @IsString()
  @IsNotEmpty()
  clientDataJSON: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class SwitchWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  workspaceId: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('challenge')
  async getChallenge() {
    const challenge = await this.authService.generateChallenge();
    return { challenge };
  }

  @Post('login')
  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async walletLogin(
    @Body() dto: WalletLoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.walletLogin(
        dto.address,
        dto.signature,
        dto.message,
      );

    // Set httpOnly cookies
    response.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      success: true,
      user,
    };
  }

  @Post('zklogin')
  @HttpCode(HttpStatus.OK)
  async zkLogin(
    @Body() dto: ZkLoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { accessToken, refreshToken, user } = await this.authService.zkLogin(
      dto.jwt,
      dto.salt,
    );

    response.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });

    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      success: true,
      user,
    };
  }

  // ─── Passkey Registration (requires auth) ─────────────

  @Post('passkey/register/options')
  @UseGuards(SessionGuard)
  @HttpCode(HttpStatus.OK)
  async passkeyRegisterOptions(@Req() request: Request) {
    const user = (request as any).user;
    return this.authService.generatePasskeyRegistrationOptions(user.address);
  }

  @Post('passkey/register/verify')
  @UseGuards(SessionGuard)
  @HttpCode(HttpStatus.OK)
  async passkeyRegisterVerify(@Req() request: Request, @Body() body: any) {
    const user = (request as any).user;
    return this.authService.verifyPasskeyRegistration(user.address, body);
  }

  // ─── Passkey Login (public) ──────────────────────────

  @Post('passkey/login/options')
  @HttpCode(HttpStatus.OK)
  async passkeyLoginOptions() {
    return this.authService.generatePasskeyAuthenticationOptions();
  }

  @Post('passkey/login/verify')
  @HttpCode(HttpStatus.OK)
  async passkeyLoginVerify(
    @Body() body: any,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.verifyPasskeyAuthentication(body);

    response.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });

    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { success: true, user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    // Read refresh token from httpOnly cookie (not from body)
    const token = request.cookies?.refresh_token;
    if (!token) {
      throw new UnauthorizedException('No refresh token');
    }

    const { accessToken, refreshToken, user } =
      await this.authService.refresh(token);

    response.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });

    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      success: true,
      user,
    };
  }

  @Post('switch-workspace')
  @UseGuards(SessionGuard)
  @HttpCode(HttpStatus.OK)
  async switchWorkspace(
    @Body() dto: SwitchWorkspaceDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const user = (request as any).user;
    const {
      accessToken,
      refreshToken,
      user: updatedUser,
    } = await this.authService.switchWorkspace(user.address, dto.workspaceId);

    response.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });

    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { success: true, user: updatedUser };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) response: Response) {
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
    };
    response.clearCookie('access_token', cookieOpts);
    response.clearCookie('refresh_token', cookieOpts);

    return {
      success: true,
    };
  }
}
