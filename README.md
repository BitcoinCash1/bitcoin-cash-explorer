# BCH Explorer

Bitcoin Cash Explorer is a Bitcoin Cash-focused explorer, developed by Melroy van den Berg. It provides a comprehensive mempool visualizer, blockchain explorer, and API service, which powers [bchexplorer.cash](https://bchexplorer.cash).

Created and maintained by Melroy van den Berg, the BCH Explorer is fully open source under the AGPL license.

To support the continued development of this project, you can donate via Bitcoin Cash to: `bitcoincash:qzqmakefvntudp0fv7sunt5fjxdswlxv2yhezq7pdl`. Additional donation options are available on [my personal website](https://melroy.org/donate.html).

Looking ahead, I plan to introduce sponsorship opportunities to ensure the long-term sustainability of this project. This support will enable continued development and the addition of Bitcoin Cash-specific features and capabilities.

# Installation Methods

BCH Explorer can be self-hosted on Linux or FreeBSD. Use one of the
[advanced installation methods](#advanced-installation-methods) below.
One-click distribution packages are not currently listed here.

## Advanced Installation Methods

BCH Explorer can be installed in other ways too, but we only recommend doing so if you're a developer, have experience managing servers, or otherwise know what you're doing.

- See the [`docker/`](./docker/) directory for instructions on deploying BCH Explorer with Docker.
- See the [`backend/`](./backend/) and [`frontend/`](./frontend/) directories for manual install instructions oriented for developers.
- See the [`production/`](./production/) directory for guidance on setting up a more serious BCH Explorer instance designed for high performance at scale.

## Translations

The BCH Explorer frontend is translated into 30+ different languages.

We use Localazy for translation management, go to: [https://localazy.com/p/bch-explorer](https://localazy.com/p/bch-explorer) and help us improve the translations!

## Development and CI

Build and test instructions are maintained in the [backend](./backend/README.md),
[frontend](./frontend/README.md), and [Rust addon](./rust/gbt/README.md) READMEs.
[GitLab CI](./.gitlab-ci.yml) runs the configured checks and builds. Release tags
publish backend and frontend container images to the GitLab registry and GHCR.
