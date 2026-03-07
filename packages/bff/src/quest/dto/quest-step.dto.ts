import { IsString, IsOptional, IsObject } from 'class-validator';
import { Allow } from 'class-validator';

export class QuestStepDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  actionType: string; // SWAP|STAKE|VOTE|HOLD_NFT|HOLD_TOKEN|JOIN_DISCORD|CUSTOM

  @IsOptional()
  @IsObject()
  actionConfig?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  verificationMethod?: string; // INDEXER|RPC|MANUAL

  @IsOptional()
  @IsString()
  chain?: string; // SUI|EVM|SOLANA
}
