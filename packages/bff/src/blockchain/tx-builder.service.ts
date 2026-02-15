import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transaction } from '@mysten/sui/transactions';

@Injectable()
export class TxBuilderService {
  private crmCorePackageId: string;
  private crmDataPackageId: string;
  private crmVaultPackageId: string;
  private crmActionPackageId: string;

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
      target: `${this.crmDataPackageId}::deal::create`,
      arguments: [
        tx.object(globalConfigId),
        tx.object(workspaceId),
        tx.object(adminCapId),
        tx.object(profileId),
        tx.pure.string(title),
        tx.pure.u64(amountUsd),
        tx.pure.string(stage),
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
    dealId: string,
    title?: string,
    amountUsd?: number,
    stage?: string,
    expectedVersion?: number,
  ): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.crmDataPackageId}::deal::update`,
      arguments: [
        tx.object(globalConfigId),
        tx.object(workspaceId),
        tx.object(adminCapId),
        tx.object(dealId),
        title ? tx.pure.option('string', title) : tx.pure.option('string', null),
        amountUsd !== undefined ? tx.pure.option('u64', amountUsd) : tx.pure.option('u64', null),
        stage ? tx.pure.option('string', stage) : tx.pure.option('string', null),
        tx.pure.u64(expectedVersion ?? 0),
      ],
    });

    return tx;
  }

  /**
   * Build transaction to update deal stage
   */
  buildUpdateDealStageTx(
    globalConfigId: string,
    workspaceId: string,
    adminCapId: string,
    dealId: string,
    stage: string,
    expectedVersion: number,
  ): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.crmDataPackageId}::deal::update_stage`,
      arguments: [
        tx.object(globalConfigId),
        tx.object(workspaceId),
        tx.object(adminCapId),
        tx.object(dealId),
        tx.pure.string(stage),
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
}
