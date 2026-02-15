import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519';

export interface UserPayload {
  address: string;
  workspaceId: string;
  role: number;
  permissions: number;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserPayload;
}

@Injectable()
export class AuthService {
  private readonly refreshExpiresIn: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.refreshExpiresIn = this.configService.get<string>(
      'REFRESH_TOKEN_EXPIRES_IN',
      '7d',
    )!;
  }

  async walletLogin(
    address: string,
    signature: string,
    message: string,
  ): Promise<AuthResponse> {
    // Verify signature
    const isValid = await this.verifyWalletSignature(
      address,
      signature,
      message,
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid signature');
    }

    // TODO: Lookup workspace membership from database
    // For now, mock data
    const user: UserPayload = {
      address,
      workspaceId: 'mock-workspace-id',
      role: 3, // owner
      permissions: 31, // all permissions
    };

    return this.issueTokens(user);
  }

  async zkLogin(jwt: string, salt: string): Promise<AuthResponse> {
    // Call Enoki API to get proof and derive address
    const address = await this.deriveZkLoginAddress(jwt, salt);

    // TODO: Lookup workspace membership
    const user: UserPayload = {
      address,
      workspaceId: 'mock-workspace-id',
      role: 3,
      permissions: 31,
    };

    return this.issueTokens(user);
  }

  async passkeyLogin(dto: any): Promise<AuthResponse> {
    // TODO: Implement WebAuthn verification
    // For now, mock implementation
    const address = 'passkey-derived-address';

    const user: UserPayload = {
      address,
      workspaceId: 'mock-workspace-id',
      role: 3,
      permissions: 31,
    };

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken);

      // TODO: Lookup fresh user data from database
      const user: UserPayload = {
        address: payload.address,
        workspaceId: 'mock-workspace-id',
        role: 3,
        permissions: 31,
      };

      const { accessToken, refreshToken: newRefreshToken } = this.issueTokens(user);
      return { accessToken, refreshToken: newRefreshToken };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async verifyWalletSignature(
    address: string,
    signature: string,
    message: string,
  ): Promise<boolean> {
    try {
      // Convert signature from base64 to Uint8Array
      const signatureBytes = Buffer.from(signature, 'base64');
      const messageBytes = new TextEncoder().encode(message);

      // Verify signature using Ed25519PublicKey
      const publicKey = new Ed25519PublicKey(address);
      return await publicKey.verify(messageBytes, signatureBytes);
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  async validateUser(payload: UserPayload): Promise<UserPayload> {
    // This is called by passport strategies
    return payload;
  }

  private issueTokens(user: UserPayload): AuthResponse {
    const accessToken = this.jwtService.sign({ ...user });
    // expiresIn typed as StringValue (ms@4) but ms@2 is installed — safe runtime cast
    const refreshToken = this.jwtService.sign({ address: user.address }, {
      expiresIn: this.refreshExpiresIn,
    } as Record<string, unknown>);
    return { accessToken, refreshToken, user };
  }

  private async deriveZkLoginAddress(jwt: string, salt: string): Promise<string> {
    const enokiUrl = this.configService.get<string>('ENOKI_API_URL', 'https://api.enoki.mystenlabs.com');
    const enokiApiKey = this.configService.get<string>('ENOKI_API_KEY', '');

    try {
      const response = await fetch(`${enokiUrl}/v1/zklogin/derive-address`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${enokiApiKey}`,
        },
        body: JSON.stringify({ jwt, salt }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Enoki derive-address failed: ${errBody}`);
      }

      const data = await response.json();
      return data.data?.address ?? data.address;
    } catch (error) {
      console.error('ZkLogin derivation error:', error);
      throw new UnauthorizedException('ZkLogin verification failed');
    }
  }
}
