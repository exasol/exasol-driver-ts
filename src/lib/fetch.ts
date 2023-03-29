import { FetchResponse, ResultSet, SQLQueriesResponse, SQLResponse } from './types';
import { ILogger } from './logger/logger';
import { Connection } from './connection';
import { CloseResultSetCommand, FetchCommand } from './commands';

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
  resultSetMaxRows?: number
): Promise<SQLResponse<SQLQueriesResponse>> => {
  const batchResponse = rawData.responseData;

  for (let index = 0; index < batchResponse?.numResults ?? 0; index++) {
    const response = batchResponse.results[index];
    logger.debug('[WebSQL]: Fetch more data for: ', response?.resultSet?.resultSetHandle);

    if (response?.resultType === 'resultSet' && response.resultSet) {
      const fetched = await fetchMoreData(
        response.resultSet,
        response.resultSet.numRowsInMessage,
        Math.min(response.resultSet.numRows, resultSetMaxRows ?? response.resultSet.numRows),
        resultSetMaxRows ?? response.resultSet.numRows,
        connection,
        logger
      );
      batchResponse.results[index].resultSet = fetched;

      logger.debug('[WebSQL]: Closing ResultSet', response.resultSet.resultSetHandle);
      if (response.resultSet.resultSetHandle) {
        connection.sendCommandWithNoResult(new CloseResultSetCommand([response.resultSet.resultSetHandle]));
      }

      logger.debug('[WebSQL]: Loaded all data');
    }
  }
  return {
    responseData: batchResponse,
    status: rawData.status,
    exception: rawData.exception,
  };
};

const fetchMoreData = async (
  resultSet: ResultSet,
  fetchedRows: number,
  expectedRows: number,
  resultSetMaxRows: number,
  connection: Connection,
  logger: ILogger
): Promise<ResultSet> => {
  logger.debug('[WebSQL]: fetchMoreData:', fetchedRows, expectedRows);
  if (fetchedRows < expectedRows && resultSet.resultSetHandle) {
    await sendFetchCommand(resultSet.resultSetHandle, fetchedRows, connection).then(async (fetchResponse) => {
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
        logger
      );
      return;
    });
  }
  return resultSet;
};

const sendFetchCommand = async (
  resultSetHandle: number,
  startPosition: number,
  connection: Connection
): Promise<SQLResponse<FetchResponse>> => {
  return connection.sendCommand<FetchResponse>(
    new FetchCommand({
      numBytes: 10000,
      resultSetHandle,
      startPosition,
    })
  );
};
