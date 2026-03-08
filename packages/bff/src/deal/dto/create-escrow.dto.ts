import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
  Max,
  ArrayMinSize,
  Matches,
} from 'class-validator';

export class CreateEscrowDto {
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{64}$/, { message: 'payee must be a valid SUI address' })
  payee: string;

  @IsNumber()
  @Min(1, { message: 'totalAmount must be at least 1' })
  totalAmount: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @Matches(/^0x[0-9a-fA-F]{64}$/, { each: true, message: 'each arbitrator must be a valid SUI address' })
  arbitrators: string[];

  @IsNumber()
  @Min(1)
  @Max(10)
  arbiterThreshold: number;

  @IsOptional()
  @IsString()
  expiryAt?: string;

  @IsOptional()
  @IsString()
  tokenType?: string;
}
