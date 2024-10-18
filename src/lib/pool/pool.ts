import { newPoolSizeErr } from '../errors/errors';
import { ILogger } from '../logger/logger';

export interface PoolItem {
  broken?: boolean;
  active?: boolean;
  name: string;
}

export class ConnectionPool<T extends PoolItem> {
  private readonly pool = new Map<string, { claimed: boolean; connection: T }>();
  constructor(private readonly max = 1, private readonly logger: ILogger) {}

  async add(connection: T): Promise<void> {
    this.logger.debug(`[Pool:${connection.name}] Add connection`);
    const keys = Array.from(this.pool.keys());
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index];
      const item = this.pool.get(key);
      if (item && item?.connection.broken) {
        this.logger.debug(`[Pool:${connection.name}] Delete connection`, item);
        this.pool.delete(key);
      }
    }

    if (this.pool.size === this.max) {
      return Promise.reject(newPoolSizeErr(this.max));
    }

    this.pool.set(connection.name, { claimed: false, connection });
    return;
  }

  getAll(): T[] {
    return Array.from(this.pool.values()).map((item) => item.connection);
  }

  clear() {
    this.pool.clear();
  }

  release(connection: T) {
    this.logger.debug(`[Pool:${connection.name}] Release connection`);
    this.pool.set(connection.name, { claimed: false, connection });
  }

  acquire(): T | undefined {
    const keys = Array.from(this.pool.keys());
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index];
      const item = this.pool.get(key);

      if (!item) {
        continue;
      }

      if (item.claimed) {
        continue;
      }
      const connection = item.connection;
      if (!connection.active && !connection?.broken) {
        item.claimed = true;
        this.logger.debug(`[Pool:${connection.name}] Assign connection`);
        return connection;
      }
    }

    return undefined;
  }
  atMaxSize() {
    return this.pool.size == this.max;
  }
}
