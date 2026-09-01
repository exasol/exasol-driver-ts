import { Attributes, LoginOptions } from './commands';
import packageMetadata from '../../package.json';

export const driverVersion = `v${packageMetadata.version}`;

interface LoginOptionsConfig {
  autocommit: boolean;
  clientName: string;
  clientOs?: string;
  clientOsUsername?: string;
  clientRuntime?: string;
  clientVersion: string;
  compression: boolean;
  schema?: string;
}

interface NodeProcess {
  arch?: string;
  env?: Record<string, string | undefined>;
  platform?: string;
  version?: string;
  versions?: {
    node?: string;
  };
}

interface BrowserNavigator {
  platform?: string;
  userAgent?: string;
  userAgentData?: {
    platform?: string;
  };
}

interface LoginMetadataEnvironment {
  navigator?: BrowserNavigator;
  process?: NodeProcess;
}

interface LoginMetadata {
  clientOs: string;
  clientOsUsername?: string;
  clientRuntime: string;
}

// [impl->dsn~runtime-login-metadata~1]
export function createLoginOptions(config: LoginOptionsConfig, environment: LoginMetadataEnvironment = globalThis as LoginMetadataEnvironment): LoginOptions {
  const metadata = getDefaultLoginMetadata(environment);
  return {
    useCompression: config.compression,
    clientName: config.clientName,
    driverName: `exasol-driver-ts ${driverVersion}`,
    clientOs: config.clientOs || metadata.clientOs,
    clientOsUsername: config.clientOsUsername || metadata.clientOsUsername,
    clientVersion: config.clientVersion,
    clientRuntime: config.clientRuntime || metadata.clientRuntime,
    attributes: getSessionAttributes(config),
  };
}

function getSessionAttributes(config: LoginOptionsConfig): Attributes {
  return {
    autocommit: config.autocommit,
    currentSchema: config.schema,
    compressionEnabled: config.compression,
  };
}

function getDefaultLoginMetadata(environment: LoginMetadataEnvironment): LoginMetadata {
  if (environment.process?.versions?.node) {
    return {
      clientOs: `${environment.process.platform ?? 'Node.js'} ${environment.process.arch ?? ''}`.trim(),
      clientOsUsername: environment.process.env?.['USER'] || environment.process.env?.['USERNAME'],
      clientRuntime: `Node.js ${environment.process.version ?? environment.process.versions.node}`,
    };
  }

  const navigator = environment.navigator;
  return {
    clientOs: navigator?.userAgentData?.platform || navigator?.platform || 'Browser',
    clientRuntime: navigator?.userAgent || 'Browser',
  };
}
