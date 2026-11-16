# BCH Explorer Backend

These instructions are mostly intended for developers.

If you choose to use these instructions for a production setup, be aware that you will still probably need to do additional configuration for your specific OS, environment, use-case, etc.

See other ways to set up BCH Explorer on [the main README](/../../#installation-methods).

Jump to a section in this doc:

- [Set Up the Backend](#setup)
- [Development Tips](#development-tips)

## Setup

### 1. Clone BCH Explorer Repository

Get the latest BCH Explorer code:

```sh
git clone https://gitlab.melroy.org/bitcoincash/bitcoin-cash-explorer.git
cd bitcoin-cash-explorer
```

Check out the latest release:

```sh
latestrelease=$(curl -s https://gitlab.melroy.org/latest/release/....|grep tag_name|head -1|cut -d '"' -f4)
git checkout $latestrelease
```

### 2. Configure Bitcoin Core

Turn on `txindex`, enable RPC, and set RPC credentials in `bitcoin.conf`:

```ini
txindex=1
server=1
rpcuser=explorer
rpcpassword=explorer
```

### 3. Configure Electrum Server

[Pick an Electrum Server implementation](https://bchexplorer.cash/docs/faq#address-lookup-issues), configure it, and make sure it's synced.

**This step is optional.** You can run BCH Explorer without configuring an Electrum Server for it, but address lookups will be disabled, unless you use the [`p2p` backend](#address-lookups-as-a-p2p-light-client-the-p2p-backend), which needs no Electrum Server.

### 4. Configure MariaDB

_BCH Explorer needs MariaDB v10.5 or later. If you already have MySQL installed, make sure to migrate any existing databases **before** installing MariaDB._

Get MariaDB from your operating system's package manager:

```
# Debian, Ubuntu, etc.
apt install mariadb-server mariadb-client

# macOS
brew install mariadb
mysql.server start
```

Create a database and grant privileges:

```
MariaDB [(none)]> drop database explorer;
Query OK, 0 rows affected (0.00 sec)

MariaDB [(none)]> create database explorer;
Query OK, 1 row affected (0.00 sec)

MariaDB [(none)]> grant all privileges on explorer.* to 'explorer'@'%' identified by 'explorer';
Query OK, 0 rows affected (0.00 sec)
```

### 5. Prepare BCH Explorer Backend

#### Build

_Use Node.js 26.13.0 or newer in the 26.x LTS series and the pinned [pnpm 12.18.0](https://pnpm.io/installation) from `package.json`. CI uses Node.js 26.13.0._

Use [nvm](https://github.com/nvm-sh/nvm#installing-and-updating) for local development. From the repository root, run `nvm install` and `nvm use`; the root `.nvmrc` selects Node.js 26.13.0.

_The build process requires [Rust](https://www.rust-lang.org/tools/install) to be installed._

Build and copy the native Rust addon first, then install dependencies and build the backend:

```sh
cd backend
# Run preinstall first (pnpm doesn't run it automatically for security reasons)
pnpm preinstall
pnpm install
pnpm build
```

#### Configure

In the backend folder, make a copy of the sample config file:

```sh
cp explorer-config.sample.json explorer-config.json
```

Edit `explorer-config.json` as needed.

In particular, make sure:

- the correct Bitcoin Cash Node RPC credentials are specified in `CORE_RPC`
- the correct `BACKEND` is specified in `explorer`:
  - "electrum" for [cculianu/Fulcrum](https://github.com/cculianu/Fulcrum)
  - "p2p" to read addresses as a light client of the node, with no Electrum Server ([see below](#address-lookups-as-a-p2p-light-client-the-p2p-backend))
  - "none" if you're not using any Electrum Server

### 6. Run BCH Explorer Backend

Run the BCH Explorer backend:

```sh
pnpm start
```

You can also set env var `EXPLORER_CONFIG_FILE` to specify a custom config file location:

```sh
EXPLORER_CONFIG_FILE=/path/to/explorer-config.json pnpm start
```

When it's running, you should see output like this:

```sh
BCH Explorer updated in 0.189 seconds
Updating BCH Explorer
BCH Explorer updated in 0.096 seconds
Updating BCH Explorer
BCH Explorer updated in 0.099 seconds
Updating BCH Explorer
Calculated fee for transaction 1 / 10
Calculated fee for transaction 2 / 10
Calculated fee for transaction 3 / 10
Calculated fee for transaction 4 / 10
Calculated fee for transaction 5 / 10
Calculated fee for transaction 6 / 10
Calculated fee for transaction 7 / 10
Calculated fee for transaction 8 / 10
Calculated fee for transaction 9 / 10
Calculated fee for transaction 10 / 10
BCH Explorer updated in 0.243 seconds
Updating BCH Explorer
```

### 7. Set Up BCH Explorer Frontend

With the backend configured and running, proceed to set up the [BCH Explorer frontend](../frontend#manual-setup).

## Development Tips

### Set Up Backend Watchers

For development, use the project's installed `tsx` watcher:

```sh
pnpm dev
```

For validation, run:

```sh
pnpm lint
pnpm prettier:check
pnpm test:ci --runInBand
pnpm build
```

The GitLab backend test job also runs Rust and native-binding tests; see the
[Rust README](../rust/gbt/README.md). Database integration tests are separate
from the default Jest suite; use `pnpm test:with-db` for the isolated database
setup provided by the project.

### Useful Regtest Commands

Helpful link: https://gist.github.com/System-Glitch/cb4e87bf1ae3fec9925725bb3ebe223a

Run bitcoind on regtest:

```sh
bitcoind -regtest
```

Create a new wallet, if needed:

```sh
bitcoin-cli -regtest createwallet test
```

Load wallet (this command may take a while if you have a lot of UTXOs):

```sh
bitcoin-cli -regtest loadwallet test
```

Get a new address:

```sh
address=$(bitcoin-cli -regtest getnewaddress)
```

Mine blocks to the previously generated address. You need at least 101 blocks before you can spend. This will take some time to execute (~1 min):

```sh
bitcoin-cli -regtest generatetoaddress 101 $address
```

Send 0.1 BTC at 5 sat/vB to another address:

```sh
bitcoin-cli -named -regtest sendtoaddress address=$(bitcoin-cli -regtest getnewaddress) amount=0.1 fee_rate=5
```

See more example of `sendtoaddress`:

```sh
bitcoin-cli sendtoaddress # will print the help
```

Mini script to generate random network activity (random TX count with random tx fee-rate). It's slow so don't expect to use this to test BCH Explorer spam, except if you let it run for a long time, or maybe with multiple regtest nodes connected to each other.

```sh
#!/bin/bash
address=$(bitcoin-cli -regtest getnewaddress)
bitcoin-cli -regtest generatetoaddress 101 $address
for i in {1..1000000}
do
   for y in $(seq 1 "$(jot -r 1 1 1000)")
   do
      bitcoin-cli -regtest -named sendtoaddress address=$address amount=0.01 fee_rate=$(jot -r 1 1 100)
   done
   bitcoin-cli -regtest generatetoaddress 1 $address
   sleep 5
done
```

Generate block at regular interval (every 10 seconds in this example):

```sh
watch -n 10 "bitcoin-cli -regtest generatetoaddress 1 $address"
```

### Mining pools update

By default, mining pools will be not automatically updated regularly (`config.explorer.AUTOMATIC_POOLS_UPDATE` is set to `false`).

To manually update your mining pools, you can use the `--update-pools` command line flag when you run the nodejs backend. For example `pnpm start --update-pools`. This will trigger the mining pools update and automatically re-index appropriate blocks.

You can enable the automatic mining pools update by settings `config.explorer.AUTOMATIC_POOLS_UPDATE` to `true` in your `explorer-config.json`.

When a `coinbase tag` or `coinbase address` change is detected, pool assignments for all relevant blocks (tagged to that pool or the `unknown` mining pool, starting from height 130635) are updated using the new criteria.

### Re-index tables

You can manually force the nodejs backend to drop all data from a specified set of tables for future re-index. This is mostly useful for the mining dashboard.

Use the `--reindex-blocks` command to truncate the `blocks`, `hashrates`, `difficulty_adjustments`, and `pools` tables. Note that a 5 seconds delay will be observed before truncating tables in order to give you a chance to cancel (CTRL+C) in case of misuse of the command.

Usage:

```sh
pnpm start --reindex-blocks
```

Example output:

```sh
Feb 13 14:55:27 [63246] WARN: Truncating pools, blocks, hashrates and difficulty_adjustments tables for re-indexing (using '--reindex-blocks'). You can cancel this command within 5 seconds
```

## Address lookups as a P2P light client: the `p2p` backend

With `"BACKEND": "p2p"` the backend gets address data from a Bitcoin Cash node the way a light wallet does, over P2P with compact script filters (filter type 1). The node builds one filter per block, the same for every client, and serves filters, proofs and transactions. The explorer does all matching itself, so the node never needs an index of addresses or transactions and nothing grows per address or per transaction.

How an address is read:

1. The backend keeps its own copy of the node's type 1 filters: for every block its hash, header Merkle root, filter header and filter, downloaded with `getheaders`, `getcfheaders`, `getcfcheckpt` and `getcfilters`. Block headers must chain and meet their targets, filter headers must chain from zero and match the node's checkpoints, and every filter must hash to its header. A reorganization truncates the copy at the fork. The copy is two flat files in `FILTER_DIR` (by default `<CACHE_DIR>/p2p-filters/<network>`): it only grows by blocks and a scan reads it front to back, which files do better than the database.
2. For an address, the key is the SHA-256 of its locking script (the Electrum scripthash before byte reversal). Each block's filter is tested for the key.
3. For a block that matches, `getcfrange` returns the leaves with the key (transaction index, input or output index, kind) together with the leaves on either side and the edge hashes; they must rebuild the root at the front of the filter, which proves that the block has no other leaf with that key.
4. For each transaction, `getcfproof` returns the transaction with its branch to the block header's Merkle root. A leaf for a created output gives its value; a leaf for a spent output names the spending input, and so the output it spends. History, balance, sent and received totals and unspent outputs follow from these leaves.
5. Transactions are shown from the node's RPC as `getrawtransaction <txid> 2 <blockhash>`: the explorer knows the block, so the node needs no transaction index for address pages. The mempool part of an address comes from the explorer's own mempool copy.

What the node must serve:

- **P2P:** BIP157 messages for filter type 1, plus `getcfrange` and `getcfproof`. BCHD with script filters ([gcash/bchd#776](https://github.com/gcash/bchd/pull/776), [#777](https://github.com/gcash/bchd/pull/777); on unless `--nocfilters` or `--noscriptfilters`) and Knuth ([k-nuth/kth#1002](https://github.com/k-nuth/kth/pull/1002) to [#1004](https://github.com/k-nuth/kth/pull/1004)) serve them.
- **RPC** (`CORE_RPC`, which may be another node on the same network): `validateaddress`, `getrawtransaction` with a block hash, `getblock`, and the mempool calls the explorer already uses.
- **No Electrum Server and no index**: no address index, and no transaction index for address data. Transaction pages that look a transaction up by its id alone still need the node's transaction index, as with the other backends.

The explorer asks one range per matching block and one proof per transaction, far more than one wallet does, so let the node treat it as a trusted peer: BCHD adds each `getcfrange` and `getcfproof` to the peer's ban score and drops a peer after about a hundred in a short time, unless it is whitelisted (`whitelist=<explorer address>`). The filter copy is owned by one process: run the `p2p` backend with `SPAWN_CLUSTER_PROCS` set to 0.

A first lookup of an address scans every filter, which costs time in proportion to the size of the filters; the result is cached and later lookups only scan the blocks that came since. The paginated address endpoints (`/address/:address/transactions`, `/transaction-count`) scan window by window. The frontend uses those only with the `electrum` backend and otherwise reads the whole history at once (`/address/:address`, `/txs`, `/utxo`).

| `P2P` setting | Default | Meaning |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | The node's P2P host. |
| `PORT` | `0` | The node's P2P port; 0 takes the network's default port. |
| `NETWORK` | `""` | The P2P network; empty takes `EXPLORER.NETWORK`. Also `regtest`, `testnet3` or `simnet`. |
| `TIMEOUT` | `30000` | Milliseconds a request may wait for each message of its answer before the connection is dropped and made again. |
| `FILTER_DIR` | `""` | Where the filter copy is kept; empty is `<CACHE_DIR>/p2p-filters/<network>`. |
| `RANGE_PREFIX_BITS` | `256` | Bits of the key named in `getcfrange`. Fewer bits show the node a bucket of keys rather than the key, at the cost of more leaves per answer. |
| `MAX_HISTORY_TXS` | `100000` | Addresses with more transactions are refused, as Electrum servers refuse large histories. |

## Request limits

The `EXPLORER` configuration retains the existing WebSocket defaults:

| Key                     |  Default | Meaning                                                            |
| ----------------------- | -------: | ------------------------------------------------------------------ |
| `MAX_BUFFERED_AMOUNT`   | 15000000 | Buffered response bytes before disconnect                          |
| `MAX_MESSAGE_SIZE`      |   100000 | Maximum inbound message bytes                                      |
| `MAX_TRACKED_TXS`       |      500 | Transactions tracked per connection                                |
| `MSG_RATE_LIMIT`        |      200 | Messages accepted per rate window                                  |
| `MSG_RATE_WINDOW`       |    10000 | Rate window in milliseconds                                        |
| `MAX_OUTSPENDS_OUTPUTS` |        0 | Cumulative outputs per public outspends request; zero is unlimited |

For a finite public outspends budget, set `EXPLORER.MAX_OUTSPENDS_OUTPUTS` to,
for example, `100000`. Both single and batched requests return HTTP 400 when
they exceed the budget. Duplicate transaction IDs each consume their output
count. Internal calls remain unlimited. Docker exposes the same keys with
the `EXPLORER_` prefix; see [Docker configuration](../docker/README.md).

### Optional Unix socket listener

Set `EXPLORER.UNIX_SOCKET_PATH` to serve the backend API and WebSocket endpoint over a local Unix socket in addition to its TCP port. Leave it empty to use TCP only. This setting is separate from BCHN RPC connection pooling and the Valkey socket configuration.

Use a directory owned by the backend service account, writable only by trusted administrators and that account. Before starting listeners or cluster workers, the primary process probes an existing socket for up to one second. It removes a stale socket only after connection refusal and an unchanged filesystem identity. An active listener, regular file, symlink, timeout, or permission error stops startup with a diagnostic; resolve that condition before restarting. The service does not create the parent directory or remove arbitrary files.
