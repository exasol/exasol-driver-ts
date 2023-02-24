export interface SQLException {
  sqlCode: string;
  text: string;
}

export interface SQLResponse<T> {
  status: 'ok' | 'error';
  exception: SQLException | undefined;
  responseData: T;
}

export interface SendError {
  exception: SQLException | undefined;
}

export interface SQLPublicKeyResponse {
  publicKeyExponent: string;
  publicKeyModulus: string;
  publicKeyPem: string;
}

export interface SQLLoginResponse {
  databaseName: string;
  identifierQuoteString: string;
  maxDataMessageSize: number;
  maxIdentifierLength: number;
  maxVarcharLength: number;
  productName: string;
  protocolVersion: number;
  releaseVersion: string;
  sessionId: number;
  timeZone: string;
  timeZoneBehavior: string;
}

export interface PublicKeyResponse {
  publicKeyPem: string;
  publicKeyModulus: string;
  publicKeyExponent: string;
}

export interface SQLQueryColumnType {
  type: string;
  precision?: number;
  scale?: number;
  size?: number;
  characterSet?: string;
  withLocalTimeZone?: boolean;
  fraction?: number;
  srid?: number;
}

export interface SQLQueryColumn {
  name: string;
  dataType: SQLQueryColumnType;
}

export interface SQLQueryResponse {
  resultType: 'resultSet' | 'rowCount';
  rowCount?: number;
  resultSet?: ResultSet;
}

export interface ResultSet {
  resultSetHandle?: number;
  numColumns: number;
  /** total amount of rows available */
  numRows: number;
  /** amount of rows retrieved */
  numRowsInMessage: number;
  columns: SQLQueryColumn[];
  data?: Array<(string | number | boolean | null)[]>;
}

export interface SQLQueriesResponse {
  numResults: number;
  results: SQLQueryResponse[];
}

export interface FetchResponse {
  numRows: number;
  data: Array<(string | number | boolean | null)[]>;
}

export interface SqlStatementsResponse {
  data?: SQLQueriesResponse;
  sqlStatements: string[];
  error?: SQLException;
  resultLength: number;
}

export interface CreatePreparedStatementResponse {
  statementHandle: number;
  parameterData: ParameterData;
}

export interface ParameterData extends SQLQueriesResponse {
  numColumns: number;
  columns: SQLQueryColumn[];
}
