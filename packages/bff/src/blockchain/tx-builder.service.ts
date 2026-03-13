import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transaction } from '@mysten/sui/transactions';

/** Map frontend stage strings to on-chain u8 values (crm_core::deal) */
const STAGE_MAP: Record<string, number> = {
  prospecting: 0,
  qualification: 1,
  proposal: 2,
  negotiation: 3,
  closed_won: 4,
  closed_lost: 5,
};

export function stageToU8(stage: string): number {
  const val = STAGE_MAP[stage];
  if (val === undefined) throw new Error(`Invalid deal stage: "${stage}"`);
  return val;
}

@Injectable()
export class TxBuilderService {
  private crmCorePackageId: string;
  private crmDataPackageId: string;
  private crmVaultPackageId: string;
  private crmActionPackageId: string;
  private crmEscrowPackageId: string;

  constructor(private configService: ConfigService) {
    this.crmCorePackageId = this.configService.get<string>(
      'CRM_CORE_PACKAGE_ID',
      '0x0',
    );
    this.crmDataPackageId = this.configService.get<string>(
      'CRM_DATA_PACKAGE_ID',
      '0x0',
    );
    this.crmVaultPackageId = this.configService.get<string>(
      'CRM_VAULT_PACKAGE_ID',
      '0x0',
    );
    this.crmActionPackageId = this.configService.get<string>(
      'CRM_ACTION_PACKAGE_ID',
      '0x0',
    );
    this.crmEscrowPackageId = this.configService.get<string>(
      'CRM_ESCROW_PACKAGE_ID',
      '0x0',
    );
  }

  /**
   * Build transaction to create a new workspace
   */
  buildCreateWorkspaceTx(name: string, globalConfigId: string): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.crmCorePackageId}::workspace::create`,
      arguments: [
        tx.object(globalConfigId),
        tx.pure.string(name),
      ],
    });

    return tx;
  }

  /**
   * Build transaction to add workspace member
   */
  buildAddMemberTx(
    globalConfigId: string,
    workspaceId: string,
    adminCapId: string,
    memberAddress: string,
    roleLevel: number,
    permissions: number,
  ): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.crmCorePackageId}::workspace::add_member`,
      arguments: [
        tx.object(globalConfigId),
        tx.object(workspaceId),
        tx.object(adminCapId),
        tx.pure.address(memberAddress),
        tx.pure.u8(roleLevel),
        tx.pure.u64(permissions),
      ],
    });

    return tx;
  }

  /**
   * Build transaction to remove workspace member
   */
  buildRemoveMemberTx(
    globalConfigId: string,
    workspaceId: string,
    adminCapId: string,
    memberAddress: string,
  ): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.crmCorePackageId}::workspace::remove_member`,
      arguments: [
        tx.object(globalConfigId),
        tx.object(workspaceId),
        tx.object(adminCapId),
        tx.pure.address(memberAddress),
      ],
    });

    return tx;
  }

  /**
   * Build transaction to create a profile
   */
  buildCreateProfileTx(
    globalConfigId: string,
    workspaceId: string,
    adminCapId: string,
    primaryAddress: string,
    suinsName: string | null,
    tags: string[],
  ): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.crmCorePackageId}::profile::create`,
      arguments: [
        tx.object(globalConfigId),
        tx.object(workspaceId),
        tx.object(adminCapId),
        tx.pure.address(primaryAddress),
        suinsName ? tx.pure.option('string', suinsName) : tx.pure.option('string', null),
        tx.pure.vector('string', tags),
      ],
    });

    return tx;
  }

  /**
   * Build transaction to archive a profile
   */
  buildArchiveProfileTx(
    globalConfigId: string,
    workspaceId: string,
    adminCapId: string,
    profileId: string,
    expectedVersion: number,
  ): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.crmCorePackageId}::profile::archive`,
      arguments: [
        tx.object(globalConfigId),
        tx.object(workspaceId),
        tx.object(adminCapId),
        tx.object(profileId),
        tx.pure.u64(expectedVersion),
      ],
    });

    return tx;
  }

  /**
   * Build transaction to update profile tags
   */
  buildUpdateProfileTagsTx(
    globalConfigId: string,
    workspaceId: string,
    adminCapId: string,
    profileId: string,
    tags: string[],
    expectedVersion: number,
  ): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.crmCorePackageId}::profile::set_metadata`,
      arguments: [
        tx.object(globalConfigId),
        tx.object(workspaceId),
        tx.object(adminCapId),
        tx.object(profileId),
        tx.pure.vector('string', tags),
        tx.pure.u64(expectedVersion),
      ],
    });

    return tx;
  }

  /**
   * Build transaction to create an organization
   */
  buildCreateOrganizationTx(
    globalConfigId: string,
    workspaceId: string,
    adminCapId: string,
    name: string,
    domain: string | null,
    tags: string[],
  ): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.crmCorePackageId}::organization::create`,
      arguments: [
        tx.object(globalConfigId),
        tx.object(workspaceId),
        tx.object(adminCapId),
        tx.pure.string(name),
        domain ? tx.pure.option('string', domain) : tx.pure.option('string', null),
        tx.pure.vector('string', tags),
      ],
    });

    return tx;
  }

  /**
   * Build transaction to update an organization
   */
  buildUpdateOrganizationTx(
    globalConfigId: string,
    workspaceId: string,
    adminCapId: string,
    organizationId: string,
    name?: string,
    domain?: string | null,
    tags?: string[],
    expectedVersion?: number,
  ): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.crmCorePackageId}::organization::update`,
      arguments: [
        tx.object(globalConfigId),
        tx.object(workspaceId),
        tx.object(adminCapId),
        tx.object(organizationId),
        name ? tx.pure.option('string', name) : tx.pure.option('string', null),
        domain !== undefined
          ? (domain ? tx.pure.option('string', domain) : tx.pure.option('string', null))
          : tx.pure.option('string', null),
        tags ? tx.pure.option('vector<string>', tags) : tx.pure.option('vector<string>', null),
        tx.pure.u64(expectedVersion ?? 0),
      ],
    });

    return tx;
  }

  /**
   * Build transaction to link profile to organization
   */
  buildLinkProfileToOrgTx(
    globalConfigId: string,
    workspaceId: string,
    adminCapId: string,
    organizationId: string,
    profileId: string,
  ): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.crmCorePackageId}::relation::create`,
      arguments: [
        tx.object(globalConfigId),
        tx.object(workspaceId),
        tx.object(adminCapId),
        tx.object(organizationId),
        tx.object(profileId),
      ],
    });

    return tx;
  }

  /**
   * Build transaction to create a deal
   */
  buildCreateDealTx(
    globalConfigId: string,
    workspaceId: string,
    adminCapId: string,
    profileId: string,
    title: string,
    amountUsd: number,
    stage: string,
  ): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.crmCorePackageId}::deal::create_deal`,
      arguments: [
        tx.object(globalConfigId),
        tx.object(workspaceId),
        tx.object(adminCapId),
        tx.pure.address(profileId),
        tx.pure.string(title),
        tx.pure.u64(amountUsd),
        tx.pure.u8(stageToU8(stage)),
      ],
    });

    return tx;
  }

  /**
   * Build transaction to update a deal
   */
  buildUpdateDealTx(
    globalConfigId: string,
    workspaceId: string,
    adminCapId: string,
    dealObjectId: string,
    expectedVersion: number,
    title: string,
    amountUsd: number,
    stage: string,
  ): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.crmCorePackageId}::deal::update_deal`,
      arguments: [
        tx.object(globalConfigId),
        tx.object(workspaceId),
        tx.object(adminCapId),
        tx.object(dealObjectId),
        tx.pure.u64(expectedVersion),
        tx.pure.string(title),
        tx.pure.u64(amountUsd),
        tx.pure.u8(stageToU8(stage)),
      ],
    });

    return tx;
  }

  /**
   * Build transaction to archive a deal
   */
  buildArchiveDealTx(
    globalConfigId: string,
    workspaceId: string,
    adminCapId: string,
    dealObjectId: string,
    expectedVersion: number,
  ): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.crmCorePackageId}::deal::archive_deal`,
      arguments: [
        tx.object(globalConfigId),
        tx.object(workspaceId),
        tx.object(adminCapId),
        tx.object(dealObjectId),
        tx.pure.u64(expectedVersion),
      ],
    });

    return tx;
  }

  /**
   * Build transaction to create a segment
   */
  buildCreateSegmentTx(
    globalConfigId: string,
    workspaceId: string,
    adminCapId: string,
    name: string,
    description: string,
    rulesJson: string,
  ): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.crmDataPackageId}::segment::create`,
      arguments: [
        tx.object(globalConfigId),
        tx.object(workspaceId),
        tx.object(adminCapId),
        tx.pure.string(name),
        tx.pure.string(description),
        tx.pure.string(rulesJson),
      ],
    });

    return tx;
  }

  /**
   * Build transaction to update a segment
   */
  buildUpdateSegmentTx(
    globalConfigId: string,
    workspaceId: string,
    adminCapId: string,
    segmentId: string,
    name?: string,
    description?: string,
    rulesJson?: string,
    expectedVersion?: number,
  ): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.crmDataPackageId}::segment::update`,
      arguments: [
        tx.object(globalConfigId),
        tx.object(workspaceId),
        tx.object(adminCapId),
        tx.object(segmentId),
        name ? tx.pure.option('string', name) : tx.pure.option('string', null),
        description ? tx.pure.option('string', description) : tx.pure.option('string', null),
        rulesJson ? tx.pure.option('string', rulesJson) : tx.pure.option('string', null),
        tx.pure.u64(expectedVersion ?? 0),
      ],
    });

    return tx;
  }

  /**
   * Build transaction to create a campaign
   */
  buildCreateCampaignTx(
    globalConfigId: string,
    workspaceId: string,
    adminCapId: string,
    name: string,
    description: string,
    segmentId: string,
  ): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.crmActionPackageId}::campaign::create`,
      arguments: [
        tx.object(globalConfigId),
        tx.object(workspaceId),
        tx.object(adminCapId),
        tx.pure.string(name),
        tx.pure.string(description),
        tx.object(segmentId),
      ],
    });

    return tx;
  }

  // ─── Escrow TX builders ───────────────────────────────────────────────────

  /**
   * Build transaction to fund an escrow with a Coin<T>.
   * Calls crm_escrow::escrow::fund_escrow<T>(escrow, coin, clock, ctx).
   */
  buildFundEscrowTx(
    escrowObjectId: string,
    coinObjectId: string,
    tokenType = '0x2::sui::SUI',
  ): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.crmEscrowPackageId}::escrow::fund_escrow`,
      typeArguments: [tokenType],
      arguments: [
        tx.object(escrowObjectId),
        tx.object(coinObjectId),
        tx.object('0x6'), // Sui Clock
      ],
    });

    return tx;
  }

  /**
   * Build transaction to release funds from escrow to payee.
   * Calls crm_escrow::escrow::release<T>(escrow, amount, clock, ctx).
   */
  buildReleaseEscrowTx(
    escrowObjectId: string,
    amount: bigint,
    tokenType = '0x2::sui::SUI',
  ): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.crmEscrowPackageId}::escrow::release`,
      typeArguments: [tokenType],
      arguments: [
        tx.object(escrowObjectId),
        tx.pure.u64(amount),
        tx.object('0x6'), // Sui Clock
      ],
    });

    return tx;
  }

  /**
   * Build transaction to refund an escrow back to payer.
   * Calls crm_escrow::escrow::refund<T>(escrow, clock, ctx).
   */
  buildRefundEscrowTx(
    escrowObjectId: string,
    tokenType = '0x2::sui::SUI',
  ): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.crmEscrowPackageId}::escrow::refund`,
      typeArguments: [tokenType],
      arguments: [
        tx.object(escrowObjectId),
        tx.object('0x6'), // Sui Clock
      ],
    });

    return tx;
  }

  // ─── Vault TX builders ──────────────────────────────────────────────────

  /**
   * Build transaction to enforce vault secret expiry on-chain.
   * Calls crm_vault::vault::enforce_expiry(vault, clock).
   */
  buildEnforceVaultExpiryTx(vaultObjectId: string): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.crmVaultPackageId}::vault::enforce_expiry`,
      arguments: [tx.object(vaultObjectId), tx.object('0x6')],
    });

    return tx;
  }

  /**
   * Build transaction to update a campaign
   */
  buildUpdateCampaignTx(
    globalConfigId: string,
    workspaceId: string,
    adminCapId: string,
    campaignId: string,
    name?: string,
    description?: string,
    status?: string,
    expectedVersion?: number,
  ): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.crmActionPackageId}::campaign::update`,
      arguments: [
        tx.object(globalConfigId),
        tx.object(workspaceId),
        tx.object(adminCapId),
        tx.object(campaignId),
        name ? tx.pure.option('string', name) : tx.pure.option('string', null),
        description ? tx.pure.option('string', description) : tx.pure.option('string', null),
        status ? tx.pure.option('string', status) : tx.pure.option('string', null),
        tx.pure.u64(expectedVersion ?? 0),
      ],
    });

    return tx;
  }

  // ─── Vault Policy TX builders ─────────────────────────────────────────

  buildCreateWorkspacePolicyTx(
    globalConfigId: string,
    workspaceId: string,
    adminCapId: string,
    name: string,
    expiresAtMs: string, // u64 as string
  ): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.crmVaultPackageId}::policy::create_workspace_policy`,
      arguments: [
        tx.object(globalConfigId),
        tx.object(workspaceId),
        tx.object(adminCapId),
        tx.pure.string(name),
        tx.pure.u64(BigInt(expiresAtMs)),
      ],
    });
    return tx;
  }

  buildCreateAddressPolicyTx(
    globalConfigId: string,
    workspaceId: string,
    adminCapId: string,
    name: string,
    allowedAddresses: string[],
    expiresAtMs: string,
  ): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.crmVaultPackageId}::policy::create_address_policy`,
      arguments: [
        tx.object(globalConfigId),
        tx.object(workspaceId),
        tx.object(adminCapId),
        tx.pure.string(name),
        tx.pure.vector('address', allowedAddresses),
        tx.pure.u64(BigInt(expiresAtMs)),
      ],
    });
    return tx;
  }

  buildCreateRolePolicyTx(
    globalConfigId: string,
    workspaceId: string,
    adminCapId: string,
    name: string,
    minRoleLevel: number,
    expiresAtMs: string,
  ): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.crmVaultPackageId}::policy::create_role_policy`,
      arguments: [
        tx.object(globalConfigId),
        tx.object(workspaceId),
        tx.object(adminCapId),
        tx.pure.string(name),
        tx.pure.u8(minRoleLevel),
        tx.pure.u64(BigInt(expiresAtMs)),
      ],
    });
    return tx;
  }
}
