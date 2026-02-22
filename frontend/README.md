# BCH Explorer Frontend

You can build and run the BCH Explorer frontend and proxy to the production BCH Explorer backend (for easier frontend development), or you can connect it to your own backend for a full BCH Explorer development instance, custom deployment, etc.

Jump to a section in this doc:
- [Quick Setup for Frontend Development](#quick-setup-for-frontend-development)
- [Manual Frontend Setup](#manual-setup)
- [Translations](#translations-transifex-project)

## Quick Setup for Frontend Development

If you want to quickly improve the UI, fix typos, or make other updates that don't require any backend changes, you don't need to set up an entire backend—you can simply run the BCH Explorer frontend locally.

### 1. Clone BCH Explorer Repository

Get the latest BCH Explorer code:

```sh
git clone git@gitlab.melroy.org:bitcoincash/bitcoin-cash-explorer.git
cd bitcoin-cash-explorer/frontend
```

### 2. Specify Website

The same frontend codebase is used for https://bchexplorer.cash.

Configure the frontend for the site you want by running the corresponding command:

```sh
$ npm run config:defaults:explorer
```

### 3. Run the Frontend

_Make sure to use Node.js 24.x and npm 10.x or newer._

Install project dependencies and run the frontend server:

```sh
$ npm install
$ npm run serve:local-prod
```

The frontend will be available at http://localhost:4200/ and all API requests will be proxied to the production server at https://bchexplorer.cash.

### 4. Test

After making your changes, you can run our end-to-end automation suite and check for possible regressions.

Headless:

```sh
$ npm run config:defaults:explorer && npm run cypress:run
```

Interactive:

```sh
$ npm run config:defaults:explorer && npm run cypress:open
```

This will open the Cypress test runner, where you can select any of the test files to run.

If all tests are green, submit your PR, and it will be reviewed by someone on the team as soon as possible.

## Manual Setup

Set up the [BCH Explorer backend](../backend/) first, if you haven't already.

### 1. Build the Frontend

_Make sure to use Node.js 24.x and npm 10.x or newer._

Build the frontend:

```sh
cd frontend
npm install
npm run build
```

### 2. Run the Frontend

#### Development

To run your local BCH Explorer frontend with your local BCH Explorer backend:

First run only once, which will retrieve the image resources:

```sh
npm run sync-assets-dev
```

Then run:

```sh
npm run serve
```

#### Production

The `npm run build` command from step 1 above should have generated a `dist` directory. Put the contents of `dist/` onto your web server.

You will probably want to set up a reverse proxy, TLS, etc. There are sample nginx configuration files in the top level of the repository for reference, but note that support for such tasks is outside the scope of this project.

### SSR

*Note:* Server-side rendering can be supported but it is not enabled by default nor tested. I don't use SSR at all (hence `outputMode` is set to `static` in `angular.json`).

Running SSR would also require changes to `angular.json`:

```json
    "outputMode": "server",
    "ssr": {
      "entry": "src/server.ts"
    }
```

## Translations: Transifex Project

The Explorer frontend strings are localized into 20+ locales:
https://www.transifex.com/mempool/mempool/dashboard/

### Translators

* Arabic @baro0k
* Czech @pixelmade2
* Danish @pierrevendelboe
* German @Emzy
* English (default)
* Spanish @maxhodler @bisqes
* Persian @techmix
* French @Bayernatoor
* Korean @kcalvinalvinn @sogoagain
* Italian @HodlBits
* Lithuanian @eimze21
* Hebrew @rapidlab309
* Georgian @wyd_idk
* Hungarian @btcdragonlord
* Dutch @m__btc
* Japanese @wiz @japananon
* Norwegian @T82771355
* Polish @maciejsoltysiak
* Portugese @jgcastro1985
* Slovenian @thepkbadger
* Finnish @bio_bitcoin
* Swedish @softsimon_
* Thai @Gusb3ll
* Turkish @stackmore
* Ukrainian @volbil
* Vietnamese @BitcoinvnNews
* Chinese @wdljt
* Russian @TonyCrusoe @Bitconan
* Romanian @mirceavesa
* Macedonian @SkechBoy
* Nepalese @kebinm
