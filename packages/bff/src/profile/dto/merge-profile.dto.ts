import { IsString } from 'class-validator';

export class MergeProfileDto {
  @IsString()
  sourceProfileId: string;
}
