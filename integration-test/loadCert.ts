import { StartedTestContainer } from 'testcontainers';
import { CertificateProvider } from './certificateProvider';

export async function loadCert(container: StartedTestContainer) {
  const certProvider: CertificateProvider = new CertificateProvider(container);
  const certStr = await certProvider.readCertificate();
  return certStr;
}
