import {
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { verifyPersonalMessageSignature } from '@mysten/sui/verify';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../common/cache/cache.service';
import { AuditTrailService } from '../common/audit-trail/audit-trail.service';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

export interface UserPayload {
  address: string;
  workspaceId: string;
  workspaceName: string;
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
  private readonly suiClient: SuiJsonRpcClient;
  private readonly rpId: string;
  private readonly rpName: string;
  private readonly rpOrigin: string;
  private static readonly WEBAUTHN_TTL = 300; // 5 minutes in seconds

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly auditTrail: AuditTrailService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.refreshExpiresIn = this.configService.get<string>(
      'REFRESH_TOKEN_EXPIRES_IN',
      '7d',
    )!;
    const network = this.configService.get<string>('SUI_NETWORK', 'testnet');
    this.suiClient = new SuiJsonRpcClient({
      url: this.configService.get<string>(
        'SUI_RPC_URL',
        'https://fullnode.testnet.sui.io:443',
      ),
      network,
    });
    this.rpId = this.configService.get<string>('WEBAUTHN_RP_ID', 'localhost');
    this.rpName = this.configService.get<string>(
      'WEBAUTHN_RP_NAME',
      'ROSMAR CRM',
    );
    this.rpOrigin = this.configService.get<string>(
      'WEBAUTHN_ORIGIN',
      'http://localhost:3000',
    );
  }

  /**
   * Lookup workspace membership by address. If none exists, auto-provision
   * a new workspace + owner membership.
   */
  private async resolveOrCreateMembership(
    address: string,
  ): Promise<UserPayload> {
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.workspaceMember.findFirst({
        where: { address },
        include: { workspace: true },
        orderBy: { joinedAt: 'asc' }, // deterministic: oldest membership first
      });

      if (membership) {
        return {
          address,
          workspaceId: membership.workspaceId,
          workspaceName: membership.workspace.name,
          role: membership.roleLevel,
          permissions: membership.permissions,
        };
      }

      // New user — create workspace + owner membership atomically
      const workspace = await tx.workspace.create({
        data: {
          name: 'My Workspace',
          ownerAddress: address,
          members: {
            create: {
              address,
              roleLevel: 3, // owner
              permissions: 31, // all
            },
          },
        },
      });

      return {
        address,
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        role: 3,
        permissions: 31,
      };
    });
  }

  async generateChallenge(): Promise<string> {
    const nonce = randomBytes(32).toString('hex');
    await this.cacheService.set(
      `challenge:${nonce}`,
      (Date.now() + 300_000).toString(),
      300,
    ); // 5 min TTL
    return `Sign this message to authenticate with ROSMAR CRM:\n${nonce}`;
  }

  private async consumeChallenge(message: string): Promise<boolean> {
    const lines = message.split('\n');
    const nonce = lines[lines.length - 1];
    const val = await this.cacheService.get<string>(`challenge:${nonce}`);
    if (!val) return false;
    await this.cacheService.evict(`challenge:${nonce}`);
    return Date.now() < Number(val);
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

    const user = await this.resolveOrCreateMembership(address);
    const result = this.issueTokens(user);
    this.emitWalletConnect(address, undefined, 'wallet');
    this.auditTrail
      .log({
        actor: address,
        action: 'AUTH_WALLET_LOGIN',
        resource: 'session',
        resourceId: user.workspaceId,
      })
      .catch(() => {}); // fire-and-forget
    return result;
  }

  async zkLogin(jwt: string, salt: string): Promise<AuthResponse> {
    const address = await this.deriveZkLoginAddress(jwt, salt);
    const user = await this.resolveOrCreateMembership(address);
    const result = this.issueTokens(user);
    this.emitWalletConnect(address, undefined, 'zklogin');
    this.auditTrail
      .log({
        actor: address,
        action: 'AUTH_ZK_LOGIN',
        resource: 'session',
        resourceId: user.workspaceId,
      })
      .catch(() => {}); // fire-and-forget
    return result;
  }

  // ─── Passkey / WebAuthn ───────────────────────────────

  async generatePasskeyRegistrationOptions(address: string) {
    const existingCreds = await this.prisma.passkeyCredential.findMany({
      where: { address },
    });

    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpId,
      userName: address,
      attestationType: 'none',
      excludeCredentials: existingCreds.map((c) => ({
        id: c.credentialId,
        transports: c.transports as any[],
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    await this.cacheService.set(
      `webauthn:${options.challenge}`,
      JSON.stringify({ address }),
      AuthService.WEBAUTHN_TTL,
    );

    return options;
  }

  async verifyPasskeyRegistration(address: string, response: any) {
    // Find the challenge associated with this address
    const stored = response.challenge
      ? await this.cacheService.get<string>(`webauthn:${response.challenge}`)
      : null;
    let expectedChallenge: string | undefined;
    if (stored) {
      const data = JSON.parse(stored);
      if (data.address === address) {
        expectedChallenge = response.challenge;
      }
    }

    if (!expectedChallenge) {
      throw new UnauthorizedException('Invalid or expired WebAuthn challenge');
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: this.rpOrigin,
      expectedRPID: this.rpId,
    });

    await this.cacheService.evict(`webauthn:${expectedChallenge}`);

    if (!verification.verified || !verification.registrationInfo) {
      throw new UnauthorizedException(
        'Passkey registration verification failed',
      );
    }

    const { credential } = verification.registrationInfo;

    await this.prisma.passkeyCredential.create({
      data: {
        address,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: (response.response?.transports as string[]) ?? [],
      },
    });

    return { verified: true };
  }

  async generatePasskeyAuthenticationOptions() {
    const options = await generateAuthenticationOptions({
      rpID: this.rpId,
      userVerification: 'preferred',
    });

    await this.cacheService.set(
      `webauthn:${options.challenge}`,
      JSON.stringify({ type: 'auth' }),
      AuthService.WEBAUTHN_TTL,
    );

    return options;
  }

  async verifyPasskeyAuthentication(response: any): Promise<AuthResponse> {
    // Find matching credential
    const credential = await this.prisma.passkeyCredential.findUnique({
      where: { credentialId: response.id },
    });

    if (!credential) {
      throw new UnauthorizedException('Unknown passkey credential');
    }

    // Extract challenge from response clientDataJSON
    const expectedChallenge = response.response?.clientDataJSON
      ? JSON.parse(
          Buffer.from(response.response.clientDataJSON, 'base64url').toString(),
        ).challenge
      : undefined;

    if (!expectedChallenge) {
      throw new UnauthorizedException('Missing WebAuthn challenge in response');
    }

    const stored = await this.cacheService.get<string>(
      `webauthn:${expectedChallenge}`,
    );
    if (!stored) {
      throw new UnauthorizedException('Invalid or expired WebAuthn challenge');
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: this.rpOrigin,
      expectedRPID: this.rpId,
      credential: {
        id: credential.credentialId,
        publicKey: credential.publicKey,
        counter: credential.counter,
        transports: credential.transports as any[],
      },
    });

    await this.cacheService.evict(`webauthn:${expectedChallenge}`);

    if (!verification.verified) {
      throw new UnauthorizedException('Passkey authentication failed');
    }

    // Update counter
    await this.prisma.passkeyCredential.update({
      where: { id: credential.id },
      data: { counter: verification.authenticationInfo.newCounter },
    });

    const user = await this.resolveOrCreateMembership(credential.address);
    this.emitWalletConnect(credential.address, undefined, 'passkey');
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const user = await this.resolveOrCreateMembership(payload.address);
      const { accessToken, refreshToken: newRefreshToken } =
        this.issueTokens(user);
      return { accessToken, refreshToken: newRefreshToken, user };
    } catch (_error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async verifyWalletSignature(
    address: string,
    signature: string,
    message: string,
  ): Promise<boolean> {
    try {
      // Validate challenge nonce is fresh and unused
      if (!(await this.consumeChallenge(message))) {
        console.error('Invalid or expired challenge');
        return false;
      }

      // verifyPersonalMessageSignature handles the intent prefix added by signPersonalMessage
      // client is required for zkLogin signatures (fetches JWK + epoch from chain)
      const messageBytes = new TextEncoder().encode(message);
      const publicKey = await verifyPersonalMessageSignature(
        messageBytes,
        signature,
        {
          client: this.suiClient,
        },
      );

      // Confirm the recovered address matches the claimed address
      return publicKey.toSuiAddress() === address;
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Switch the caller's active workspace. Verifies membership, then
   * re-issues tokens scoped to the target workspace.
   */
  async switchWorkspace(
    address: string,
    workspaceId: string,
  ): Promise<AuthResponse> {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_address: { workspaceId, address } },
      include: { workspace: true },
    });

    if (!membership) {
      throw new ForbiddenException('Not a member of this workspace');
    }

    const user: UserPayload = {
      address,
      workspaceId: membership.workspaceId,
      workspaceName: membership.workspace.name,
      role: membership.roleLevel,
      permissions: membership.permissions,
    };

    const result = this.issueTokens(user);
    this.auditTrail
      .log({
        actor: address,
        action: 'AUTH_SWITCH_WORKSPACE',
        resource: 'workspace',
        resourceId: workspaceId,
      })
      .catch(() => {}); // fire-and-forget
    return result;
  }

  /**
   * Test-only login: resolve/create membership and issue tokens directly.
   * Only callable when TestAuthModule is loaded (NODE_ENV=test).
   */
  async testLogin(address: string): Promise<AuthResponse> {
    if (process.env.NODE_ENV !== 'test') {
      throw new ForbiddenException(
        'testLogin is only available in test environment',
      );
    }
    const user = await this.resolveOrCreateMembership(address);
    return this.issueTokens(user);
  }

  async validateUser(payload: UserPayload): Promise<UserPayload> {
    // This is called by passport strategies
    return payload;
  }

  private issueTokens(user: UserPayload): AuthResponse {
    const { workspaceName: _, ...tokenPayload } = user;
    const accessToken = this.jwtService.sign(tokenPayload);
    // expiresIn typed as StringValue (ms@4) but ms@2 is installed — safe runtime cast
    const refreshToken = this.jwtService.sign({ address: user.address }, {
      expiresIn: this.refreshExpiresIn,
    } as Record<string, unknown>);
    return { accessToken, refreshToken, user };
  }

  private emitWalletConnect(
    address: string,
    profileId: string | undefined,
    method: 'wallet' | 'zklogin' | 'passkey',
  ): void {
    this.eventEmitter.emit('indexer.event', {
      event_id: `auth-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      event_type: 'wallet_connect',
      address,
      profile_id: profileId,
      data: { method },
      tx_digest: '',
      timestamp: Date.now(),
    });
  }

  private async deriveZkLoginAddress(
    jwt: string,
    salt: string,
  ): Promise<string> {
    const enokiUrl = this.configService.get<string>(
      'ENOKI_API_URL',
      'https://api.enoki.mystenlabs.com',
    );
    const enokiApiKey = this.configService.get<string>('ENOKI_API_KEY', '');

    try {
      const response = await fetch(`${enokiUrl}/v1/zklogin/derive-address`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${enokiApiKey}`,
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
