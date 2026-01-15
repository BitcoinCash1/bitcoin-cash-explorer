// const fs = require('fs');

// const FRONTEND_CONFIG_FILE_NAME = 'explorer-frontend-config.json';

// let configContent;

// Read frontend config
// try {
//     const rawConfig = fs.readFileSync(FRONTEND_CONFIG_FILE_NAME);
//     configContent = JSON.parse(rawConfig);
//     console.log(`${FRONTEND_CONFIG_FILE_NAME} file found, using provided config`);
// } catch (e) {
//     console.log(e);
//     if (e.code !== 'ENOENT') {
//       throw new Error(e);
//   } else {
//       console.log(`${FRONTEND_CONFIG_FILE_NAME} file not found, using default config`);
//   }
// }

let PROXY_CONFIG = [];

PROXY_CONFIG.push(...[
  {
    context: ['/api/v1/services/**'],
    target: `http://localhost:9000`,
    secure: false,
    ws: true,
    changeOrigin: true,
    proxyTimeout: 30000,
  },
  {
    context: ['/api/v1/**'],
    target: `http://localhost:8999`,
    secure: false,
    ws: true,
    changeOrigin: true,
    proxyTimeout: 30000,
  },
  {
    context: ['/api/**'],
    target: `http://localhost:8999`,
    secure: false,
    changeOrigin: true,
    proxyTimeout: 30000,
    pathRewrite: {
        "^/api/": "/api/v1/"
    },
  }
]);

console.log(PROXY_CONFIG);

module.exports = PROXY_CONFIG;
