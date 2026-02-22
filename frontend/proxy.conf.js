const PROXY_CONFIG = [
  {
    context: [
      "/api/**",
      "/testnet/api/**",
      "/signet/api/**",
      "/testnet4/api/**",
    ],
    target: "https://bchexplorer.cash",
    ws: true,
    secure: false,
    changeOrigin: true,
  },
  {
    context: ["/resources/mining-pools/**"],
    target: "https://bchexplorer.cash",
    secure: false,
    changeOrigin: true,
  },
  {
    context: ["/api/v1/ws"],
    target: "https://bchexplorer.cash",
    ws: true,
    secure: false,
    changeOrigin: true,
  },
  {
    context: ["/resources/worldmap.json"],
    target: "https://bchexplorer.cash",
    secure: false,
    changeOrigin: true,
  },
];

export default PROXY_CONFIG;
