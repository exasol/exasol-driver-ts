import { newInvalidHostRangeLimits } from './errors/errors';

export const getURIScheme = (encryption: boolean): string => {
  return encryption ? 'wss' : 'ws';
};

export const resolveHosts = async (host: string): Promise<string[]> => {
  const hosts: string[] = [];
  const hostRangeRegex = /^((.+?)(\d+))\.\.(\d+)$/;

  const splittedHost = host.split(',');

  for (let index = 0; index < splittedHost.length; index++) {
    const host = splittedHost[index];

    if (host.match(hostRangeRegex)) {
      const parsedHosts = await parseRange(hostRangeRegex, host);
      hosts.push(...parsedHosts);
    } else {
      hosts.push(host);
    }
  }

  return hosts;
};

const parseRange = async (hostRangeRegex: RegExp, host: string): Promise<string[]> => {
  const matches = host.match(hostRangeRegex);
  if (!matches || matches.length < 5) {
    return Promise.reject(newInvalidHostRangeLimits(host));
  }
  const prefix = matches[2];
  const lowerRange = parseInt(matches[3]);
  const higherRange = parseInt(matches[4]);

  if (higherRange < lowerRange) {
    return Promise.reject(newInvalidHostRangeLimits(host));
  }

  const hosts = [];
  for (let index = lowerRange; index <= higherRange; index++) {
    hosts.push(`${prefix}${index}`);
  }

  return hosts;
};
