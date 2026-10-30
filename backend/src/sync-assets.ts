import axios from 'axios';
import * as fs from 'fs';
import config from './config';
import backendInfo from './api/backend-info';
import logger from './logger';
import { getSocksProxyOptions } from './utils/socks-proxy';
import { pipeline } from 'stream/promises';

const PATH = './';

class SyncAssets {
  public async syncAssets$() {
    for (const url of config.EXPLORER.EXTERNAL_ASSETS) {
      try {
        await this.downloadFile$(url);
      } catch (e) {
        throw new Error(`Failed to download external asset. ` + (e instanceof Error ? e.message : e), { cause: e });
      }
    }
  }

  private async downloadFile$(url: string): Promise<void> {
    const fileName = url.split('/').slice(-1)[0];
    const viaTor = config.SOCKS5PROXY.ENABLED;
    logger.info(`Downloading external asset ${fileName} over ${viaTor ? 'the Tor network' : 'clearnet'}...`);
    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          config.EXPLORER.USER_AGENT === 'explorer'
            ? `BCHExplorer/v${backendInfo.getBackendInfo().version}`
            : `${config.EXPLORER.USER_AGENT}`,
      },
      ...getSocksProxyOptions(),
      responseType: 'stream',
      timeout: 30000,
    });
    await pipeline(response.data, fs.createWriteStream(PATH + fileName));
    logger.info(`External asset ${fileName} saved to ${PATH + fileName}`);
  }
}

export default new SyncAssets();
