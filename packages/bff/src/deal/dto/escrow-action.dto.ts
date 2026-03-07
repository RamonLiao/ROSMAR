import { IsNumber, IsOptional, IsString, IsArray, Min } from 'class-validator';
import { Allow } from 'class-validator';

export class ReleaseDto {
  @IsNumber()
  @Min(1)
  amount: number;
}

export class VoteDto {
  @IsString()
  decision: 'release' | 'refund';
}

export class AddVestingDto {
  @IsString()
  vestingType: 'LINEAR' | 'MILESTONE';

  @IsOptional()
  @IsNumber()
  cliffMs?: number;

  @IsOptional()
  @IsNumber()
  totalDurationMs?: number;

  @IsOptional()
  @IsArray()
  @Allow()
  milestones?: { description: string; percentage: number }[];
}

export class CreateSaftTemplateDto {
  @IsString()
  name: string;

  @Allow()
  terms: Record<string, any>;
}

export class AttachSaftDto {
  @IsString()
  escrowId: string;
}

export class UploadSignedSaftDto {
  @IsString()
  walrusBlobId: string;
}
