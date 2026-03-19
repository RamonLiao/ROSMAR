import {
  IsString,
  IsNumber,
  IsNotEmpty,
  ValidateNested,
  IsArray,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class WhaleThresholdItem {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsNumber()
  @Min(0)
  amount: number;
}

export class SetWhaleThresholdsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhaleThresholdItem)
  thresholds: WhaleThresholdItem[];
}
