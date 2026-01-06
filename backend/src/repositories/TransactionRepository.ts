import DB from '../database';
import logger from '../logger';
import { Ancestor } from '../mempool.interfaces';

class TransactionRepository {
  public async $setCluster(txid: string, clusterRoot: string): Promise<void> {
    try {
      await DB.query(
        `
          INSERT INTO compact_transactions
          (
            txid,
            cluster
          )
          VALUE (UNHEX(?), UNHEX(?))
          ON DUPLICATE KEY UPDATE
            cluster = UNHEX(?)
        ;`,
        [txid, clusterRoot, clusterRoot]
      );
    } catch (e: any) {
      logger.err(
        `Cannot save transaction cpfp cluster into db. Reason: ` +
          (e instanceof Error ? e.message : e)
      );
      throw e;
    }
  }

  public async $removeTransaction(txid: string): Promise<void> {
    try {
      await DB.query(
        `
          DELETE FROM compact_transactions
          WHERE txid = UNHEX(?)
        `,
        [txid]
      );
    } catch (e) {
      logger.warn(
        'Cannot delete transaction cpfp info from db. Reason: ' +
          (e instanceof Error ? e.message : e)
      );
      throw e;
    }
  }
}

export default new TransactionRepository();
