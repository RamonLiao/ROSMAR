import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TxBuilderService } from '../blockchain/tx-builder.service';
import { SuiClientService } from '../blockchain/sui.client';

export interface CreatePolicyDto {
  name: string;
  ruleType: 0 | 1 | 2;
  allowedAddresses?: string[];
  minRoleLevel?: number;
  expiresAtMs?: string; // "0" = no expiry
}

@Injectable()
export class VaultPolicyService {
  private globalConfigId: string;
  private adminCapId: string;

  constructor(
    private readonly txBuilder: TxBuilderService,
    private readonly suiClient: SuiClientService,
    private readonly configService: ConfigService,
  ) {
    this.globalConfigId = this.configService.get<string>(
      'GLOBAL_CONFIG_ID',
      '0x0',
    );
    this.adminCapId = this.configService.get<string>('ADMIN_CAP_ID', '0x0');
  }

  async createPolicy(
    workspaceId: string,
    dto: CreatePolicyDto,
  ): Promise<{ policyId: string; digest: string }> {
    const expiresAtMs = dto.expiresAtMs ?? '0';
    let tx;

    switch (dto.ruleType) {
      case 0:
        tx = this.txBuilder.buildCreateWorkspacePolicyTx(
          this.globalConfigId,
          workspaceId,
          this.adminCapId,
          dto.name,
          expiresAtMs,
        );
        break;
      case 1:
        if (!dto.allowedAddresses?.length) {
          throw new BadRequestException(
            'allowedAddresses required for address-list policy',
          );
        }
        tx = this.txBuilder.buildCreateAddressPolicyTx(
          this.globalConfigId,
          workspaceId,
          this.adminCapId,
          dto.name,
          dto.allowedAddresses,
          expiresAtMs,
        );
        break;
      case 2:
        if (dto.minRoleLevel === undefined) {
          throw new BadRequestException(
            'minRoleLevel required for role-based policy',
          );
        }
        tx = this.txBuilder.buildCreateRolePolicyTx(
          this.globalConfigId,
          workspaceId,
          this.adminCapId,
          dto.name,
          dto.minRoleLevel,
          expiresAtMs,
        );
        break;
      default:
        throw new BadRequestException(`Invalid ruleType: ${dto.ruleType}`);
    }

    const result = await this.suiClient.executeTransaction(tx);

    // Extract the created policy object ID from transaction effects
    const createdObjects = (result as any).effects?.created ?? [];
    const policyId =
      createdObjects[0]?.reference?.objectId ??
      createdObjects[0]?.objectId ??
      'unknown';

    return {
      policyId,
      digest: (result as any).digest ?? 'dry-run',
    };
  }
}
