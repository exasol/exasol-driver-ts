import { ExasolDriver } from '@exasol/exasol-driver-ts';
import support from './support.cjs';

// [itest->dsn~runtime-packaging~2]
// [itest->dsn~runtime-connect-basic-authentication~1]
await support.verifyNodeEntry(ExasolDriver);
