import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
  ArrayMinSize,
} from 'class-validator';

export class CreateEscrowDto {
  @IsString()
  payee: string;

  @IsNumber()
  @Min(0)
  totalAmount: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  arbitrators: string[];

  @IsNumber()
  @Min(1)
  arbiterThreshold: number;

  @IsOptional()
  @IsString()
  expiryAt?: string;

  @IsOptional()
  @IsString()
  tokenType?: string;
}
