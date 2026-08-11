import JSDOMEnvironment from 'jest-environment-jsdom';
import { ResourceLoader } from 'jsdom';

/**
 * jsdom uses Node's `ws` client for `wss://` connections, but offers no public
 * way to provide the dynamically generated Exasol Docker certificate. Keep the
 * temporary verification bypass confined to integration-test/browser while
 * preserving TLS encryption. Replace this with real-browser certificate
 * pinning as tracked in https://github.com/exasol/exasol-driver-ts/issues/78.
 */
export default class DockerDatabaseJSDOMEnvironment extends JSDOMEnvironment {
  constructor(config, context) {
    super(
      {
        ...config,
        projectConfig: {
          ...config.projectConfig,
          testEnvironmentOptions: {
            ...config.projectConfig.testEnvironmentOptions,
            resources: new ResourceLoader({ strictSSL: false }),
          },
        },
      },
      context,
    );
  }
}
