import { Strategy } from 'passport-custom';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService, UserPayload } from '../auth.service';

@Injectable()
export class WalletStrategy extends PassportStrategy(Strategy, 'wallet') {
  constructor(private authService: AuthService) {
    super();
  }

  async validate(request: any): Promise<UserPayload> {
    const { address, signature, message } = request.body;

    if (!address || !signature || !message) {
      throw new UnauthorizedException('Missing wallet credentials');
    }

    const isValid = await this.authService.verifyWalletSignature(
      address,
      signature,
      message,
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid signature');
    }

    // Return user payload — note: this strategy path isn't the primary login
    // flow (controller calls authService.walletLogin directly), but we keep
    // it compilable with a stub workspace name.
    return {
      address,
      workspaceId: 'mock-workspace-id',
      workspaceName: 'Mock Workspace',
      role: 3,
      permissions: 31,
    };
  }
}
