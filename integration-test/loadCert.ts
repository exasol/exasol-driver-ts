import { StartedTestContainer } from 'testcontainers';
import { CertificateProvider } from './certificateProvider';

export async function loadCert(container: StartedTestContainer) {
  const certProvider: CertificateProvider = new CertificateProvider(container);
  const certStr = await certProvider.readCertificate();
  return certStr;
}
export async function loadCA(container: StartedTestContainer) {
  const certProvider: CertificateProvider = new CertificateProvider(container);
  const certStr = await certProvider.readCA();
  return certStr;
}
export async function loadKey(container: StartedTestContainer) {
  const certProvider: CertificateProvider = new CertificateProvider(container);
  const certStr = await certProvider.readKey();
  return certStr;
}
export async function loadCAKey(container: StartedTestContainer) {
  const certProvider: CertificateProvider = new CertificateProvider(container);
  const certStr = await certProvider.readCAKey();
  return certStr;
}