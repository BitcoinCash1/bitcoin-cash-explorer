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

Build and copy the native Rust addons (GBT and the filter scan) first, then install dependencies and build the backend:

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
Rust READMEs ([GBT](../rust/gbt/README.md), [filter scan](../rust/filter-scan/README.md)). Database integration tests are separate
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

With `"BACKEND": "p2p"` the backend gets address data from a Bitcoin Cash node the way a light wallet does, over P2P with compact script filters (filter type 1). The node builds one filter per block, the same for every client, and serves filters, blocks and transactions. The explorer does all matching itself, so the node never needs an index of addresses or transactions and nothing grows per address or per transaction.

How an address is read:

1. The backend keeps its own copy of the node's type 1 filters: for every block its hash, header Merkle root, filter header and filter, downloaded with `getheaders`, `getcfheaders`, `getcfcheckpt` and `getcfilters`. Block headers must chain and meet their targets, filter headers must chain from zero and match the node's checkpoints, and every filter must hash to its header. A reorganization truncates the copy at the fork. The copy is three flat files in `FILTER_DIR` (by default `<CACHE_DIR>/p2p-filters/<network>`): the filters, one record per block, and a commit record of how many blocks are whole. It only grows by blocks and a scan reads it front to back, which files do better than the database.
2. For an address, the key is the SHA-256 of its locking script (the Electrum scripthash before byte reversal). Each block's filter is tested for the key, here, without asking the node. The test runs in the native filter scan addon ([`rust/filter-scan`](../rust/filter-scan/README.md)), which reads the filter files on all cores; lookups that arrive while a scan of many blocks runs are tested together in the next pass.
3. For a block that matches, `MATCH_MODE` decides how the explorer learns what the block does to the address (below).
4. History, balance, sent and received totals and unspent outputs follow from the outputs that pay the address and the inputs that spend them. The mempool part comes from the explorer's own mempool copy.
5. Transactions are shown from the node's RPC as `getrawtransaction <txid> 2 <blockhash>`: the explorer knows the block, so the node needs no transaction index for address pages.

A transaction looked up by its id alone (a transaction page, its raw hex, its outspends or its Merkle proof) is asked from the node first. When the node does not find it, because it keeps no transaction index or, for Knuth, because the transaction is confirmed and all its outputs are spent, the explorer finds its block in the filters: type 1 filters have a leaf of kind 4 for every transaction, keyed on the SHA-256 of 0x02 and the txid. In `block` mode the explorer downloads the blocks whose filter matches that key and looks for the txid in them; in `range` mode it asks `getcfrange` for the full key, whose kind 4 leaf names the transaction's place in the block. It then reads the transaction with `getrawtransaction <txid> 2 <blockhash>`. Filters built before transaction leaves were added match no block, and the node's own error is shown.

The two match modes, and what each shows the node:

- **`block` (default, as a Neutrino wallet):** the explorer downloads each matching block (`getdata`), checks it against its own header (Merkle root) and against the filter (every output the block creates must be in it), and finds the address's outputs and the inputs that spend them by reading the block itself. Spends are recognized by outpoint, from the outputs earlier in the address's history, so a history is always read from the first block on. The node learns only which blocks were downloaded: never the address, its key or its transactions. The blocks downloaded are still a hint: they are the blocks of the address plus a rare false positive (about one in 784,931 per block), so a node that compared the scripts of all of them could narrow the address down. Showing transactions over RPC tells the node which transactions are displayed, as any explorer page does.
- **`range` (opt-in):** for each matching block the explorer asks `getcfrange` for the leaves with the address's key and checks them against the root in the filter, then `getcfproof` for each transaction, which brings the transaction and its branch to the block header. Far less is downloaded than whole blocks, but the node learns the key (or, with `RANGE_PREFIX_BITS` below 256, a prefix of it that a bucket of addresses shares) for every matching block, and exactly which transactions are the address's.

What the node must serve:

- **P2P:** BIP157 messages for filter type 1 and blocks (`getdata`); for `range` mode also `getcfrange` and `getcfproof`. BCHD with script filters ([gcash/bchd#776](https://github.com/gcash/bchd/pull/776), [#777](https://github.com/gcash/bchd/pull/777); on unless `--nocfilters` or `--noscriptfilters`) and Knuth ([k-nuth/kth#1002](https://github.com/k-nuth/kth/pull/1002) to [#1004](https://github.com/k-nuth/kth/pull/1004)) serve them.
- **RPC** (`CORE_RPC`, which may be another node on the same network): `validateaddress`, `getrawtransaction` with a block hash, `getblock`, and the mempool calls the explorer already uses.
- **No Electrum Server and no index**: no address index and no transaction index. Without transaction leaves in the node's filters, transaction pages opened by a bare txid of a confirmed transaction still need the node to find it by its id (a transaction index, or for Knuth an unspent output of it).

In `range` mode the explorer sends one range per matching block and one proof per transaction. BCHD adds each `getcfrange` and `getcfproof` to the peer's ban score and drops a peer after about a hundred within a minute or so, unless the peer is whitelisted (`whitelist=<explorer address>`). A `getdata` for one block adds nothing, so `block` mode needs no whitelisting.

One process writes the filter copy: the backend process, or with `SPAWN_CLUSTER_PROCS` above 0 the primary process, which then syncs the filters and serves no requests. The workers read the same files: each sees the blocks the primary has committed, and when the primary cuts blocks off at a reorganization it marks the commit record first, so a worker drops what it read from those blocks and follows the new chain. Two explorers need two `FILTER_DIR`s.

A first lookup of an address scans every filter and downloads the blocks that match, which costs time in proportion to the size of the filters and of those blocks; the history is cached and later lookups only scan the blocks that came since. Downloaded blocks are not kept. On a 16-core desktop CPU (32 threads) with the filters in the page cache, the scan of 100,000 synthetic blocks of mainnet's average filter size (1,850 entries, about 4.9 KB each) took 66 ms; for mainnet's 977,620 blocks that is about 0.65 s, where the TypeScript matcher took about 20 s. A pass with 1,000 keys took 0.4 s. Filters that are not in the page cache are read from disk first, about 5 GB for mainnet.

| `P2P` setting | Default | Meaning |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | The node's P2P host. |
| `PORT` | `0` | The node's P2P port; 0 takes the network's default port. |
| `NETWORK` | `""` | The P2P network; empty takes `EXPLORER.NETWORK`. Also `regtest`, `testnet3` or `simnet`. |
| `TIMEOUT` | `30000` | Milliseconds a request may wait with nothing of its answer arriving before the connection is dropped and made again. |
| `FILTER_DIR` | `""` | Where the filter copy is kept; empty is `<CACHE_DIR>/p2p-filters/<network>`. |
| `MATCH_MODE` | `block` | `block` downloads matching blocks and shows the node no address; `range` asks for leaves and proofs and shows the node the address's key and transactions. |
| `RANGE_PREFIX_BITS` | `256` | `range` mode only: bits of the key named in `getcfrange`. Fewer bits show the node a bucket of keys rather than the key, at the cost of more leaves per answer. |
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
