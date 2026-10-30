import axios, { AxiosResponse } from 'axios';
import { getSocksProxyOptions } from './socks-proxy';
import backendInfo from '../api/backend-info';
import config from '../config';
import logger from '../logger';
import * as https from 'https';

export async function query(path, throwOnFail = false): Promise<object | undefined> {
  type axiosOptions = {
    headers: {
      'User-Agent': string;
    };
    timeout: number;
    httpsAgent?: https.Agent;
  };
  const setDelay = (secs = 1): Promise<void> => new Promise((resolve) => setTimeout(() => resolve(), secs * 1000));
  const axiosOptions: axiosOptions = {
    headers: {
      'User-Agent':
        config.EXPLORER.USER_AGENT === 'explorer'
          ? `BCHExplorer/v${backendInfo.getBackendInfo().version}`
          : `${config.EXPLORER.USER_AGENT}`,
    },
    timeout: config.SOCKS5PROXY.ENABLED ? 30000 : 20000,
  };
  let retry = 0;
  let lastError: any = null;

  while (retry < config.EXPLORER.EXTERNAL_MAX_RETRY) {
    try {
      const data: AxiosResponse = await axios.get(path, { ...axiosOptions, ...getSocksProxyOptions(retry) });
      if (data.statusText === 'error' || !data.data) {
        throw new Error(`Could not fetch data from ${path}, Error: ${data.status}`);
      }
      return data.data;
    } catch (e) {
      lastError = e;
      logger.warn(
        `Could not connect to ${path} (Attempt ${retry + 1}/${config.EXPLORER.EXTERNAL_MAX_RETRY}). Reason: ` +
          (e instanceof Error ? e.message : e)
      );
      retry++;
    }
    if (retry < config.EXPLORER.EXTERNAL_MAX_RETRY) {
      await setDelay(config.EXPLORER.EXTERNAL_RETRY_INTERVAL);
    }
  }

  logger.err(`Could not connect to ${path}. All ${config.EXPLORER.EXTERNAL_MAX_RETRY} attempts failed`);

  if (throwOnFail && lastError) {
    throw lastError;
  }

  return undefined;
}
