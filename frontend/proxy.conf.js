const fs = require('fs');

let PROXY_CONFIG;
let configContent;

const CONFIG_FILE_NAME = 'explorer-frontend-config.json';

try {
    const rawConfig = fs.readFileSync(CONFIG_FILE_NAME);
    configContent = JSON.parse(rawConfig);
    console.log(`${CONFIG_FILE_NAME} file found, using provided config`);
} catch (e) {
    console.log(e);
    if (e.code !== 'ENOENT') {
      throw new Error(e);
  } else {
      console.log(`${CONFIG_FILE_NAME} file not found, using default config`);
  }
}

PROXY_CONFIG = [
    {
        context: ['*',
        '/api/**', '!/api/v1/ws',
        '/testnet/api/**', '/signet/api/**', '/testnet4/api/**'
        ],
        target: "https://explorer.melroy.org",
        ws: true,
        secure: false,
        changeOrigin: true
    },
    {
        context: ['/api/v1/ws'],
        target: "https://explorer.melroy.org",
        ws: true,
        secure: false,
        changeOrigin: true,
    },
    {
      context: ['/resources/mining-pools/**'],
      target: "https://explorer.melroy.org",
      secure: false,
      changeOrigin: true
  }
];


PROXY_CONFIG.push({
    context: ['/resources/assets.json', '/resources/assets.minimal.json', '/resources/worldmap.json'],
    target: "https://explorer.melroy.org",
    secure: false,
    changeOrigin: true,
});

module.exports = PROXY_CONFIG;
