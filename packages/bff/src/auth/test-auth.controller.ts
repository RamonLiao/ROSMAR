import { Controller, Post, Res, Body } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class TestAuthController {
  constructor(private readonly authService: AuthService) {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error(
        'TestAuthController must not be loaded outside test environment',
      );
    }
  }

  @Post('test-login')
  async testLogin(
    @Body() body: { address?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const address =
      body?.address ||
      '0x00000000000000000000000000000000000000000000000000000000e2e00001';

    const tokens = await this.authService.testLogin(address);

    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { success: true, user: tokens.user };
  }
}
