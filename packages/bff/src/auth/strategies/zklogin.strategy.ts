import { Strategy } from 'passport-custom';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService, UserPayload } from '../auth.service';

@Injectable()
export class ZkLoginStrategy extends PassportStrategy(Strategy, 'zklogin') {
  constructor(private readonly authService: AuthService) {
    super();
  }

  async validate(request: any): Promise<UserPayload> {
    const { jwt, salt } = request.body;

    if (!jwt || !salt) {
      throw new UnauthorizedException('Missing ZkLogin credentials');
    }

    // Delegate to AuthService (single source of truth for zkLogin)
    const { user } = await this.authService.zkLogin(jwt, salt);
    return user;
  }
}
