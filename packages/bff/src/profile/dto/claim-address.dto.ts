import { IsString } from 'class-validator';

export class ClaimAddressDto {
  @IsString()
  address: string;

  @IsString()
  message: string;

  @IsString()
  signature: string;
}
