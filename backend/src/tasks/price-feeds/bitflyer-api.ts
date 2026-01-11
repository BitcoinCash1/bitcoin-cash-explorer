import { query } from '../../utils/axios-query';
import { PriceFeed, PriceHistory } from '../price-updater';

class BitflyerApi implements PriceFeed {
  public name: string = 'Bitflyer';
  public currencies: string[] = ['BTC']; // I know right? this only supports BCH/BTC. Not BCH/USD.

  public url: string = 'https://api.bitflyer.com/v1/ticker?product_code=BCH_';
  public urlHist: string = '';

  constructor() {}

  public async $fetchPrice(currency): Promise<number> {
    const response = await query(this.url + currency);
    if (response && response['ltp']) {
      return parseInt(response['ltp'], 10);
    } else {
      return -1;
    }
  }

  public async $fetchRecentPrice(currencies: string[], type: 'hour' | 'day'): Promise<PriceHistory> {
    return [];
  }
}

export default BitflyerApi;
