import { CloseResultSetCommand, FetchCommand } from './commands';
import { Connection } from './connection';
import { GeneralSqlError, newSqlError } from './errors/errors';
import { ILogger } from './logger/logger';
import { FetchResponse, ResultSet, SQLQueriesResponse, SQLResponse } from './types';

/** Default number of bytes requested per fetch command (1 MiB). */
export const DEFAULT_FETCH_SIZE_BYTES = 1024 * 1024;

export interface SqlStatementsPagedResponse {
  pageSize: number;
  data: SQLQueriesResponse;
  sqlStatements: string[];
  fetchPage: (resultSet: ResultSet, startIndex: number) => Promise<ResultSet>;
  /**
   * Closes all resultSets.
   * Must be called, once the SqlStatementsPagedResponse is no longer needed.
   */
  closeAllResultSets: () => void;
  isClosed: () => boolean;
}

/**
 * Get all resultSets contained in a SQLQueriesResponse
 * @param batch
 * @returns
 */
export function resultSets(batch: SQLQueriesResponse): ResultSet[] {
  return batch.results
    .filter((response) => response?.resultType === 'resultSet' && response.resultSet)
    .map((response) => response.resultSet as ResultSet);
}

export const fetchData = async (
  rawData: SQLResponse<SQLQueriesResponse>,
  connection: Connection,
  logger: ILogger,
  fetchSizeBytes: number,
  resultSetMaxRows?: number
): Promise<SQLResponse<SQLQueriesResponse>> => {
  // [impl->dsn~runtime-query-execution~3]
  const batchResponse = rawData.responseData;

  const numResults = batchResponse?.numResults ?? 0;
  for (let index = 0; index < numResults; index++) {
    const response = batchResponse.results[index];
    logger.debug('[WebSQL]: Fetch more data for: ', response?.resultSet?.resultSetHandle);

    if (response?.resultType === 'resultSet' && response.resultSet) {
      try {
        batchResponse.results[index].resultSet = await fetchMoreData(
          response.resultSet,
          response.resultSet.numRowsInMessage,
          Math.min(response.resultSet.numRows, resultSetMaxRows ?? response.resultSet.numRows),
          resultSetMaxRows ?? response.resultSet.numRows,
          connection,
          fetchSizeBytes,
          logger
        );
      } catch (error) {
        // Close this and all remaining result sets, they would otherwise stay open until the session ends.
        for (let remaining = index; remaining < numResults; remaining++) {
          await closeResultSet(batchResponse.results[remaining]?.resultSet?.resultSetHandle, connection, logger);
        }
        throw error;
      }

      await closeResultSet(response.resultSet.resultSetHandle, connection, logger);
      logger.debug('[WebSQL]: Loaded all data');
    }
  }
  return {
    responseData: batchResponse,
    status: rawData.status,
    exception: rawData.exception,
  };
};

const closeResultSet = async (resultSetHandle: number | undefined, connection: Connection, logger: ILogger) => {
  if (!resultSetHandle) {
    return;
  }
  logger.debug('[WebSQL]: Closing ResultSet', resultSetHandle);
  try {
    await connection.sendCommand(new CloseResultSetCommand([resultSetHandle]));
  } catch (error) {
    logger.warn('[WebSQL]: Closing ResultSet failed', error);
  }
};

const fetchMoreData = async (
  resultSet: ResultSet,
  fetchedRows: number,
  expectedRows: number,
  resultSetMaxRows: number,
  connection: Connection,
  fetchSizeBytes: number,
  logger: ILogger
): Promise<ResultSet> => {
  // [impl->dsn~runtime-query-execution~3]
  logger.debug('[WebSQL]: fetchMoreData:', fetchedRows, expectedRows);
  if (fetchedRows < expectedRows && resultSet.resultSetHandle) {
    await sendFetchCommand(resultSet.resultSetHandle, fetchedRows, connection, fetchSizeBytes).then(async (fetchResponse) => {
      resultSet.data = resultSet.data ?? [];

      if (fetchResponse.responseData.data) {
        for (let index = 0; index < fetchResponse.responseData.data.length; index++) {
          const rows = fetchResponse.responseData.data[index];
          const alreadyFetchedRows = resultSet.data[index] ?? [];

          const rowsUntilMax = Math.min(rows.length, resultSetMaxRows - alreadyFetchedRows.length);

          resultSet.data[index] = [...alreadyFetchedRows, ...rows.slice(0, rowsUntilMax)];
        }
      }

      if ((resultSet.data[0] ?? []).length === resultSetMaxRows) {
        resultSet.numRowsInMessage = resultSetMaxRows;
        return resultSet;
      }

      resultSet.numRowsInMessage = fetchedRows + fetchResponse.responseData.numRows;
      resultSet = await fetchMoreData(
        resultSet,
        fetchedRows + fetchResponse.responseData.numRows,
        expectedRows,
        resultSetMaxRows,
        connection,
        fetchSizeBytes,
        logger
      );
      return undefined;
    });
  }
  return resultSet;
};

const sendFetchCommand = async (
  resultSetHandle: number,
  startPosition: number,
  connection: Connection,
  fetchSizeBytes: number
): Promise<SQLResponse<FetchResponse>> => {
  // [impl->dsn~runtime-query-fetch-size~1]
  const response = await connection.sendCommand<FetchResponse>(
    new FetchCommand({
      numBytes: fetchSizeBytes,
      resultSetHandle,
      startPosition,
    })
  );
  // SQL errors resolve with status 'error', an exception and no responseData. Error responses without an exception
  // are already rejected by Connection (E-EDJS-27); GeneralSqlError is only a defensive fallback.
  if (response.status !== 'ok') {
    throw response.exception ? newSqlError(response.exception) : GeneralSqlError;
  }
  return response;
};
