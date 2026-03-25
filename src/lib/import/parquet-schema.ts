import * as fs from 'fs';
import { parquetMetadata, parquetSchema } from 'hyparquet';
import type { SchemaElement, FileMetaData, LogicalType } from 'hyparquet';
import { ExaErrorBuilder } from '../errors/error-reporting';
import { ParquetColumnInfo, ParquetSchemaInfo } from './types';

/**
 * Infers an Exasol-compatible table schema from a Parquet file's metadata.
 * Only reads the footer metadata — does not load row data.
 */
export async function inferParquetSchema(filePath: string): Promise<ParquetSchemaInfo> {
  let buffer: ArrayBuffer;
  try {
    const fileBuffer = await fs.promises.readFile(filePath);
    buffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
  } catch (err) {
    throw new ExaErrorBuilder('E-EDJS-17')
      .message('Failed to read Parquet file: {{path}}.', filePath)
      .mitigation('Verify the file path exists and is a valid Parquet file.')
      .error();
  }

  let metadata: FileMetaData;
  try {
    metadata = parquetMetadata(buffer);
  } catch (err) {
    throw new ExaErrorBuilder('E-EDJS-17')
      .message('Invalid Parquet file: {{path}}.', filePath)
      .mitigation('Verify the file is a valid Parquet file.')
      .error();
  }

  const tree = parquetSchema(metadata);
  const columns = tree.children.map((child) => mapColumn(child.element));
  const rowCount = Number(metadata.num_rows);

  return {
    columns,
    rowCount,
    toDDL(tableName: string, schemaName?: string): string {
      const fullName = schemaName ? `${schemaName}.${tableName}` : tableName;
      const columnDefs = columns.map((col) => `${col.name} ${col.exasolType}`);
      return `CREATE TABLE ${fullName} (${columnDefs.join(', ')})`;
    },
  };
}

function mapColumn(element: SchemaElement): ParquetColumnInfo {
  return {
    name: element.name,
    exasolType: mapParquetTypeToExasol(element),
  };
}

function mapParquetTypeToExasol(element: SchemaElement): string {
  const logicalType = element.logical_type;

  // Check logical type first (modern Parquet)
  if (logicalType) {
    const mapped = mapLogicalType(logicalType);
    if (mapped) return mapped;
  }

  // Check converted_type (legacy Parquet)
  if (element.converted_type !== undefined) {
    const mapped = mapConvertedType(element.converted_type, element);
    if (mapped) return mapped;
  }

  // Fall back to physical type
  return mapPhysicalType(element.type);
}

function mapLogicalType(logicalType: LogicalType): string | null {
  switch (logicalType.type) {
    case 'STRING':
    case 'ENUM':
    case 'JSON':
    case 'BSON':
    case 'UUID':
      return 'VARCHAR(2000000)';
    case 'DATE':
      return 'DATE';
    case 'TIMESTAMP': {
      const ts = logicalType as { type: 'TIMESTAMP'; isAdjustedToUTC: boolean };
      return ts.isAdjustedToUTC ? 'TIMESTAMP WITH LOCAL TIME ZONE' : 'TIMESTAMP';
    }
    case 'DECIMAL': {
      const dec = logicalType as { type: 'DECIMAL'; precision: number; scale: number };
      const precision = Math.min(dec.precision, 36);
      return `DECIMAL(${precision},${dec.scale})`;
    }
    case 'INTEGER': {
      const intType = logicalType as { type: 'INTEGER'; bitWidth: number; isSigned: boolean };
      return intType.bitWidth <= 32 ? 'DECIMAL(18,0)' : 'DECIMAL(36,0)';
    }
    case 'TIME':
      return 'VARCHAR(2000000)';
    default:
      return null;
  }
}

function mapConvertedType(convertedType: string, element: SchemaElement): string | null {
  switch (convertedType) {
    case 'UTF8':
      return 'VARCHAR(2000000)';
    case 'DATE':
      return 'DATE';
    case 'TIMESTAMP_MILLIS':
    case 'TIMESTAMP_MICROS':
      return 'TIMESTAMP';
    case 'DECIMAL':
      if (element.precision !== undefined && element.scale !== undefined) {
        const precision = Math.min(element.precision, 36);
        return `DECIMAL(${precision},${element.scale})`;
      }
      return 'DECIMAL(36,0)';
    case 'INT_8':
    case 'INT_16':
    case 'INT_32':
    case 'UINT_8':
    case 'UINT_16':
    case 'UINT_32':
      return 'DECIMAL(18,0)';
    case 'INT_64':
    case 'UINT_64':
      return 'DECIMAL(36,0)';
    default:
      return null;
  }
}

function mapPhysicalType(type?: string): string {
  switch (type) {
    case 'BOOLEAN':
      return 'BOOLEAN';
    case 'INT32':
      return 'DECIMAL(18,0)';
    case 'INT64':
      return 'DECIMAL(36,0)';
    case 'INT96':
      return 'TIMESTAMP';
    case 'FLOAT':
    case 'DOUBLE':
      return 'DOUBLE';
    case 'BYTE_ARRAY':
    case 'FIXED_LEN_BYTE_ARRAY':
    default:
      return 'VARCHAR(2000000)';
  }
}

/**
 * Reads Parquet file metadata and returns it along with column names.
 * Used internally by the Parquet import to determine row count and columns.
 */
export async function readParquetMetadata(
  filePath: string,
): Promise<{ metadata: FileMetaData; columnNames: string[] }> {
  let buffer: ArrayBuffer;
  try {
    const fileBuffer = await fs.promises.readFile(filePath);
    buffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
  } catch {
    throw new ExaErrorBuilder('E-EDJS-17')
      .message('Failed to read Parquet file: {{path}}.', filePath)
      .mitigation('Verify the file path exists and is a valid Parquet file.')
      .error();
  }

  let metadata: FileMetaData;
  try {
    metadata = parquetMetadata(buffer);
  } catch {
    throw new ExaErrorBuilder('E-EDJS-17')
      .message('Invalid Parquet file: {{path}}.', filePath)
      .mitigation('Verify the file is a valid Parquet file.')
      .error();
  }

  const tree = parquetSchema(metadata);
  const columnNames = tree.children.map((child) => child.element.name);
  return { metadata, columnNames };
}
