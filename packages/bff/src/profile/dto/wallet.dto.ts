import { IsString, IsIn, IsOptional } from 'class-validator';

export class CreateWalletDto {
  @IsString()
  @IsIn(['sui', 'evm', 'solana'])
  chain: string;

  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  ensName?: string;

  @IsOptional()
  @IsString()
  snsName?: string;
}

export class WalletResponseDto {
  id: string;
  profileId: string;
  chain: string;
  address: string;
  ensName: string | null;
  snsName: string | null;
  verified: boolean;
  createdAt: string;
}
