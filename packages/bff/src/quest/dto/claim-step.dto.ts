import { IsString, IsOptional, IsObject } from 'class-validator';
import { Allow } from 'class-validator';

export class ClaimStepDto {
  @IsString()
  profileId: string;

  @IsOptional()
  @IsObject()
  claimData?: Record<string, unknown>;
}
