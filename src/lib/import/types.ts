export interface CsvFormatOptions {
  columnSeparator?: string;
  columnDelimiter?: string;
  rowSeparator?: string;
  encoding?: string;
  skip?: number;
  trim?: string;
  null?: string;
}

export interface InternalAddress {
  host: string;
  port: number;
}

export type ColumnNameMode = 'quoted' | 'sanitized';

export interface ParquetImportOptions {
  columns?: string[];
  createTableIfNotExists?: boolean;
  columnNameMode?: ColumnNameMode;
  csvOptions?: CsvFormatOptions;
}

export interface ParquetColumnInfo {
  name: string;
  exasolType: string;
}

export interface ParquetSchemaInfo {
  columns: ParquetColumnInfo[];
  rowCount: number;
  toDDL(tableName: string, schemaName?: string): string;
}
