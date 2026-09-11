import { startNewDockerContainer } from '../exasolContainer';

// [impl->dsn~decision-use-vitest-browser-mode~1]

export interface BrowserConnectionSettings {
  host: string;
  port: number;
  user: string;
  password: string;
}

export default async function setup({ provide }: { provide: (key: 'browserConnection', value: BrowserConnectionSettings) => void }) {
  const container = await startNewDockerContainer();
  provide('browserConnection', {
    host: container.getHost(),
    port: container.getPort(),
    user: 'sys',
    password: 'exasol',
  } satisfies BrowserConnectionSettings);
}
