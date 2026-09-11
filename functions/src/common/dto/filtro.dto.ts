import { ApiProperty } from '@nestjs/swagger';
export class FiltroDto {
  @ApiProperty({ default: 1 })
  page?: number = 1;

  @ApiProperty({ default: 10 })
  count?: number = 10;

  @ApiProperty({ default: 'createdAt' })
  sort?: string = 'createdAt';

  @ApiProperty({ default: 'asc' })
  direction?: 'asc' | 'desc' = 'asc';

  [key: string]: any; // permite filtros dinâmicos
}
