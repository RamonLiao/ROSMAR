import { IsString, IsNotEmpty, IsArray, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CollectionEntryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  contractAddress: string;

  @IsString()
  @IsIn(['sui', 'evm', 'solana'])
  chain: string;
}

export class SetCollectionWatchlistDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CollectionEntryDto)
  collections: CollectionEntryDto[];
}
