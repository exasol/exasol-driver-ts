/**
 * See https://docs.exasol.com/db/latest/sql/import.htm#Usagenotes
 */
export interface CsvFormatOptions {
  columnSeparator?: string;
  columnDelimiter?: string;
  /**
   * Defines the line break character.
   */
  rowSeparator?: RowSeparator;

  encoding?: Encoding;
  skip?: number;
  trim?: string;
  /**
   * Additional representation of NULL values. This option is only supported for CSV files and only applies to fields not enclosed in field delimiters.
   * Regardless of this option, an empty string in the input data always represents a NULL value.
   */
  null?: string;
}

export interface InternalAddress {
  host: string;
  port: number;
}

/** Defines the line break character. */
export enum RowSeparator {
  /** Default: corresponds to the ASCII character 0x0a (Unix/Linux) */
  LF = 'LF',
  /** Corresponds to the ASCII character 0x0d (macOS) */
  CR = 'CR',
  /** Corresponds to the ASCII characters 0x0d and 0x0a (Windows) */
  CRLF = 'CRLF',
  /** None means no line break. This is only allowed in FBV files */
  NONE = 'NONE',
}
export type ColumnNameMode = 'quoted' | 'sanitized';
/**
 * Defines whether spaces are removed at the border of CSV columns.
 */
export enum TrimMode {
  /** Default: no spaces are removed */
  NONE = 'none',
  /** Trim from the left */
  LEADING = 'LTRIM',
  /** Trim from the right */
  TRAILING = 'RTRIM',
  /** Trim from both sides */
  BOTH = 'TRIM',
}


/**
  * See https://docs.exasol.com/db/latest/loading_data/file_formats.htm#Supported_Encodings
  */
export type Encoding =
  'ASCII' |
  'ISO-8859-1' |
  'ISO-8859-2' |
  'ISO-8859-3' |
  'ISO-8859-4' |
  'ISO-8859-5' |
  'ISO-8859-6' |
  'ISO-8859-7' |
  'ISO-8859-8' |
  'ISO-8859-9' |
  'ISO-8859-11' |
  'ISO-8859-13' |
  'ISO-8859-15' |
  'IBM850' |
  'IBM852' |
  'IBM855' |
  'IBM856' |
  'IBM857' |
  'IBM860' |
  'IBM861' |
  'IBM862' |
  'IBM863' |
  'IBM864' |
  'IBM865' |
  'IBM866' |
  'IBM868' |
  'IBM869' |
  'WINDOWS-1250' |
  'WINDOWS-1251' |
  'WINDOWS-1252' |
  'WINDOWS-1253' |
  'WINDOWS-1254' |
  'WINDOWS-1255' |
  'WINDOWS-1256' |
  'WINDOWS-1257' |
  'WINDOWS-1258' |
  'WINDOWS-874' |
  'WINDOWS-31J' |
  'WINDOWS-936' |
  'CP949' |
  'BIG5' |
  'SHIFT-JIS' |
  'UTF-8';

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
