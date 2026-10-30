import { SocksProxyAgent } from 'socks-proxy-agent';
import type { AxiosRequestConfig } from 'axios';
import config from '../config';

/** Keep HTTP and HTTPS requests on the proxy, including remote DNS resolution. */
export function getSocksProxyOptions(attempt = 0): Pick<AxiosRequestConfig, 'httpAgent' | 'httpsAgent' | 'proxy'> {
  if (!config.SOCKS5PROXY.ENABLED) {
    return {};
  }

  const host = config.SOCKS5PROXY.HOST;
  const hostname = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
  const proxyUrl = new URL(`socks5h://${hostname}:${config.SOCKS5PROXY.PORT}`);
  if (config.SOCKS5PROXY.USERNAME) {
    proxyUrl.username = encodeURIComponent(config.SOCKS5PROXY.USERNAME);
    proxyUrl.password = encodeURIComponent(config.SOCKS5PROXY.PASSWORD);
  } else {
    // Tor can isolate retry streams by SOCKS authentication credentials.
    proxyUrl.username = `circuit${attempt}`;
  }

  const agent = new SocksProxyAgent(proxyUrl, { keepAlive: true });
  return { httpAgent: agent, httpsAgent: agent, proxy: false };
}
