import { ExasolDriver } from '@exasol/exasol-driver-ts/browser';
import support from './support.cjs';

// [itest->dsn~decision-publish-cjs-and-esm~3]
// [itest->dsn~runtime-connect-basic-authentication~1]
await support.verifyBrowserEntry(ExasolDriver);
