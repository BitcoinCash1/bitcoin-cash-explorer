# BCH Explorer

Bitcoin Cash Explorer is a fork of Mempool but tailored for Bitcoin Cash, a fully-featured mempool visualizer, explorer, and API service running at [bchexplorer.cash](https://bchexplorer.cash).

The BCH Explorer is created by Melroy van den Berg and is fully open source, under the same AGPL license.

If you wish to support my work on this BCH Explorer project, you can donate to my Bitcoin Cash Address: `bitcoincash:qzqmakefvntudp0fv7sunt5fjxdswlxv2yhezq7pdl` or use other donation options available on [my personal website](https://melroy.org/donate.html).

In the near future, I will allow sponsorship options for this project, to support the development of this project in the future. Which would make it possible for me to continue working on this project for the years to come and extend the BCH Explorer with BCH-specific features and capabilities.

# Installation Methods

**Note:** Currently we are not yet listed on all these various "one-click installation" methods. For now, use the <a href="#advanced-installation-methods">Advanced Installation Methods</a>.

---

BCH Explorer can be self-hosted on a wide variety of your own hardware, ranging from a simple one-click installation on a Raspberry Pi full-node distro all the way to a robust production instance on a powerful FreeBSD server. 

Most people should use a <a href="#one-click-installation">one-click install method</a>.

Other install methods are meant for developers and others with experience managing servers. If you want support for your own production instance of BCH Explorer.

We do **not** offer any paid Enterprise versions, everything is open-source and you will need to host it yourself, if you wish to run your own instance and having fun!

<a id="one-click-installation"></a>
## One-Click Installation

BCH Explorer can be conveniently installed on the following full-node distros: 
- [Umbrel](https://github.com/getumbrel/umbrel)
- [myNode](https://github.com/mynodebtc/mynode)
- [StartOS](https://github.com/Start9Labs/start-os)
- [nix-bitcoin](https://github.com/fort-nix/nix-bitcoin/blob/a1eacce6768ca4894f365af8f79be5bbd594e1c3/examples/configuration.nix#L129)

No matter which option you pick, you'll be able to get your own fully-sovereign instance of BCH Explorer up quickly without needing to fiddle with any settings.

## Advanced Installation Methods

BCH Explorer can be installed in other ways too, but we only recommend doing so if you're a developer, have experience managing servers, or otherwise know what you're doing.

- See the [`docker/`](./docker/) directory for instructions on deploying BCH Explorer with Docker.
- See the [`backend/`](./backend/) and [`frontend/`](./frontend/) directories for manual install instructions oriented for developers.
- See the [`production/`](./production/) directory for guidance on setting up a more serious BCH Explorer instance designed for high performance at scale.
