import { CloseResultSetCommand, FetchCommand } from './commands';
import { Connection } from './connection';
import { GeneralSqlError, newIncompleteFetchError, newSqlError } from './errors/errors';
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
  // [impl->dsn~runtime-query-execution~4]
  const batchResponse = rawData.responseData;
  // 0 and negative values mean no limit, see Config.resultSetMaxRows.
  const maxRows = resultSetMaxRows && resultSetMaxRows > 0 ? resultSetMaxRows : undefined;

  const results = (batchResponse?.results ?? []).slice(0, batchResponse?.numResults ?? 0);
  const resultSetHandles = results
    .map((response) => response?.resultSet?.resultSetHandle)
    .filter((handle): handle is number => !!handle);

  try {
    for (const response of results) {
      if (response?.resultType === 'resultSet' && response.resultSet) {
        limitRowsInMessage(response.resultSet, maxRows);
        logger.debug('[WebSQL]: Fetch more data for: ', response.resultSet.resultSetHandle);
        // Result sets are fetched one after another on purpose: they share one connection, whose commands run in order.
        response.resultSet = await fetchMoreData( // NOSONAR
          response.resultSet,
          response.resultSet.numRowsInMessage,
          Math.min(response.resultSet.numRows, maxRows ?? response.resultSet.numRows),
          maxRows ?? response.resultSet.numRows,
          connection,
          fetchSizeBytes,
          logger
        );
      }
    }
    logger.debug('[WebSQL]: Loaded all data');
  } finally {
    // Also when fetching fails: open result sets would otherwise stay open until the session ends.
    await closeResultSets(resultSetHandles, connection, logger);
  }
  return {
    ...rawData,
    responseData: batchResponse,
  };
};

/**
 * Truncates the rows that Exasol sent directly in the execute response to `resultSetMaxRows`.
 * Small results arrive completely in that response, so no fetch would apply the limit to them.
 */
const limitRowsInMessage = (resultSet: ResultSet, resultSetMaxRows: number | undefined): void => {
  if (resultSetMaxRows === undefined || resultSet.numRowsInMessage <= resultSetMaxRows) {
    return;
  }
  // Data is column-major: one array of row values per column.
  resultSet.data = resultSet.data?.map((column) => column.slice(0, resultSetMaxRows));
  resultSet.numRowsInMessage = resultSetMaxRows;
};

const closeResultSets = async (resultSetHandles: number[], connection: Connection, logger: ILogger) => {
  if (resultSetHandles.length === 0) {
    return;
  }
  logger.debug('[WebSQL]: Closing ResultSets', resultSetHandles);
  try {
    await connection.sendCommand(new CloseResultSetCommand(resultSetHandles));
  } catch (error) {
    logger.warn('[WebSQL]: Closing ResultSets failed', error);
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
  // [impl->dsn~runtime-query-execution~4]
  logger.debug('[WebSQL]: fetchMoreData:', fetchedRows, expectedRows);
  if (fetchedRows < expectedRows && resultSet.resultSetHandle) {
    const resultSetHandle = resultSet.resultSetHandle;
    await sendFetchCommand(resultSetHandle, fetchedRows, connection, fetchSizeBytes).then(async (fetchResponse) => {
      // An empty page cannot advance the start position: fetching again would request the same page forever.
      if (!fetchResponse.responseData?.numRows) {
        throw newIncompleteFetchError(resultSetHandle, fetchedRows, expectedRows);
      }
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
