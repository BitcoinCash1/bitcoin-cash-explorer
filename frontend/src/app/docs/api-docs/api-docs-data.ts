const bitcoinNetworks = ['', 'testnet', 'testnet4', 'signet'];
const miningTimeIntervals =
  '<code>24h</code>, <code>3d</code>, <code>1w</code>, <code>1m</code>, <code>3m</code>, <code>6m</code>, <code>1y</code>, <code>2y</code>, <code>3y</code>';

const emptyCodeSample = {
  esModule: [],
  commonJS: [],
  curl: [],
  response: ``,
};

const showJsExamplesDefault = {
  '': true,
  testnet: true,
  signet: true,
};
const showJsExamplesDefaultFalse = {
  '': false,
  testnet: false,
  signet: false,
};

export const wsApiDocsData = [
  {
    type: 'category',
    category: 'general',
    fragment: 'general',
    title: 'General',
    showConditions: bitcoinNetworks,
  },
  {
    type: 'endpoint',
    category: 'general',
    fragment: 'live-data',
    title: 'Live Data',
    description: {
      default:
        'Subscribe to live data. Available: <code>blocks</code>, <code>mempool-block</code>, <code>live-2h-chart</code>, and <code>stats</code>.',
    },
    payload: '{ "action": "want", "data": ["mempool-blocks", "stats"] }',
    showConditions: bitcoinNetworks,
    showJsExamples: false,
    codeExample: {
      default: {
        codeTemplate: {},
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "mempool-blocks": [
    {
      "blockSize": 1801614,
      "nTx": 3391,
      "totalFees": 8170664,
      "medianFee": 6.011217160720601,
      "feeRange": [
        4.584615384615384,
        5,
        5.100456621004566,
        6.002319288751449,
        7.235398230088496,
        10.377668308702791,
        200
      ]
    },
    ...
    {
      "blockSize": 198543075,
      "nTx": 249402,
      "totalFees": 135312667,
      "medianFee": 1.2559438783834156,
      "feeRange": [
        1.000685629033809,
        1.0020213063577312,
        1.0019080827758888,
        1.0227913345013278,
        1.1188648002395873,
        1.2559438783834156,
        1.4077952614964329,
        1.4079805737077244,
        1.5106880342499638,
        2.003440424869914,
        2.2713888268854894
      ]
    }
  ],
  "mempoolInfo": {
    "loaded": true,
    "size": 264505,
    "bytes": 108875402,
    "usage": 649908688,
    "total_fee": 1.61036575,
    "maxmempool": 300000000,
    "mempoolminfee": 0.00001858,
    "minrelaytxfee": 0.00001,
    "incrementalrelayfee": 0.00001,
    "unbroadcastcount": 0,
  },
  "BytesPerSecond": 1651,
  "fees": {
    "fastestFee": 7,
    "halfHourFee": 6,
    "hourFee": 5,
    "economyFee": 4,
    "minimumFee": 2
  },
  "da": {
    "progressPercent": 32.49007936507937,
    "difficultyChange": 0.7843046881601534,
    "estimatedRetargetDate": 1735514828279,
    "remainingBlocks": 1361,
    "remainingTime": 811481279,
    "previousRetarget": 4.429396745461176,
    "previousTime": 1734312810,
    "nextRetargetHeight": 876960,
    "timeAvg": 596239,
    "adjustedTimeAvg": 596239,
    "timeOffset": 0,
    "expectedBlocks": 650.895
  }
}`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "mempool-blocks": [
    {
      "blockSize": 1009960,
      "nTx": 3545,
      "totalFees": 2844117938,
      "medianFee": 2524.178404298769,
      "feeRange": [
        2010.9044259140476,
        2011.0887096774193,
        2011.2914608327453,
        2441.5893066980025,
        3541.35960591133,
        3936.6254416961133,
        6031.746031746032
      ]
    },
    ...
  ],
  "mempoolInfo": {
    "loaded": true,
    "size": 517666,
    "bytes": 168219654,
    "usage": 855583264,
    "total_fee": 133.53837564,
    "maxmempool": 4096000000,
    "mempoolminfee": 0.00001,
    "minrelaytxfee": 0.00001,
    "incrementalrelayfee": 0.00001,
    "unbroadcastcount": 0,
  },
  "BytesPerSecond": 358,
  "fees": {
    "fastestFee": 2525,
    "halfHourFee": 2268,
    "hourFee": 2082,
    "economyFee": 2,
    "minimumFee": 1
  },
  "da": {
    "progressPercent": 45.882936507936506,
    "difficultyChange": -51.21445794134847,
    "estimatedRetargetDate": 1736046916382,
    "remainingBlocks": 1091,
    "remainingTime": 1343241382,
    "previousRetarget": 255.61790932023905,
    "previousTime": 1733564813,
    "nextRetargetHeight": 3538080,
    "timeAvg": 1200000,
    "adjustedTimeAvg": 1231202,
    "timeOffset": 0,
    "expectedBlocks": 1898.1033333333332
  }
}`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{"mempool-blocks": [
    {
      "blockSize": 1009960,
      "nTx": 3545,
      "totalFees": 2844117938,
      "medianFee": 2524.178404298769,
      "feeRange": [
        2010.9044259140476,
        2011.0887096774193,
        2011.2914608327453,
        2441.5893066980025,
        3541.35960591133,
        3936.6254416961133,
        6031.746031746032
      ]
    },
    ...
  ],
  "mempoolInfo": {
    "loaded": true,
    "size": 59,
    "bytes": 9834,
    "usage": 68832,
    "total_fee": 0.00013935,
    "maxmempool": 4096000000,
    "mempoolminfee": 0.00001,
    "minrelaytxfee": 0.00001,
    "incrementalrelayfee": 0.00001,
    "unbroadcastcount": 0,
  },
  "BytesPerSecond": 28,
  "da": {
    "progressPercent": 68.60119047619048,
    "difficultyChange": -2.913529439274176,
    "estimatedRetargetDate": 1735095294116,
    "remainingBlocks": 633,
    "remainingTime": 391480116,
    "previousRetarget": 2.0685719720386118,
    "previousTime": 1733848494,
    "nextRetargetHeight": 227808,
    "timeAvg": 618452,
    "adjustedTimeAvg": 618452,
    "timeOffset": 0,
    "expectedBlocks": 1425.5333333333333
  },
  "fees": {
    "fastestFee": 1,
    "halfHourFee": 1,
    "hourFee": 1,
    "economyFee": 1,
    "minimumFee": 1
  },
}`,
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "mempool-blocks": [
    {
      "blockSize": 27409,
      "nTx": 2,
      "totalFees": 769,
      "medianFee": 0,
      "feeRange": [
        0.10012450036039577,
        0.10012450036039577,
        0.10012450036039577,
        0.10012450036039577,
        0.10012450036039577,
        0.10012450036039577,
        0.10012450036039577
      ]
    }
  ],
  "mempoolInfo": {
    "loaded": true,
    "size": 2,
    "bytes": 7676,
    "usage": 3568,
    "total_fee": 0.00000769,
    "maxmempool": 300000000,
    "mempoolminfee": 0.000001,
    "minrelaytxfee": 0.000001,
    "unbroadcastcount": 0
  },
  "BytesPerSecond": 60,
  "fees": {
    "fastestFee": 0.1,
    "halfHourFee": 0.1,
    "hourFee": 0.1,
    "economyFee": 0.1,
    "minimumFee": 0.1
  },
  "da": {
    "progressPercent": 4.315476190476191,
    "difficultyChange": null,
    "estimatedRetargetDate": null,
    "remainingBlocks": 1929,
    "remainingTime": null,
    "previousRetarget": null,
    "previousTime": 1734698648,
    "nextRetargetHeight": 3173184,
    "timeAvg": 60448,
    "adjustedTimeAvg": null,
    "timeOffset": 0,
    "expectedBlocks": 8.765
  }
}`,
        },
      },
    },
  },
  {
    type: 'category',
    category: 'addresses',
    fragment: 'addresses',
    title: 'Addresses',
    showConditions: bitcoinNetworks,
  },
  {
    type: 'endpoint',
    category: 'addresses',
    fragment: 'track-address',
    title: 'Track Address',
    description: {
      default:
        'Subscribe to a single address to receive live updates on new transactions having that address in input or output. <code>address-transactions</code> field contains new mempool transactions, and <code>block-transactions</code> contains new confirmed transactions.',
    },
    payload:
      '{ "track-address": "bc1qeldw4mqns26wew8swgpkt3fs364w3ehs046w2f" }',
    showConditions: bitcoinNetworks,
    showJsExamples: false,
    codeExample: {
      default: {
        codeTemplate: {},
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "block-transactions": [
    {
      "txid": "9d3ea0d131c45450c135d549b62032019bc47a80368e14edc72caf38f5a88033",
      "version": 1,
      "locktime": 0,
      "vin": [
        {
          "txid": "69da555a9c69788a3a081958457894e56b1ee6766bc72cecf881b1b4f327f78b",
          "vout": 0,
          "prevout": {
            "scriptpubkey": "a914c9848245ae4f5d5934b5cbdfb79e04cdd337470b87",
            "scriptpubkey_asm": "OP_HASH160 OP_PUSHBYTES_20 c9848245ae4f5d5934b5cbdfb79e04cdd337470b OP_EQUAL",
            "scriptpubkey_type": "p2sh",
            "scriptpubkey_address": "3L4YUynB4X44rJBY9CmiLMN8Wjti49JCYB",
            "value": 24962957
          },
          "scriptsig": "0048304502210099219ee0cd5da341650078e3c63885b3cc2211069f2551cf436e0100f421e1760220349b4ec284255b458d6da539fa17314e8330459e0a653c254f775d4ec8f32b3f0147304402203a8353c5ee76a2e266432e5f993f882e05725297e64c0833cf44719f7dda8d3b022058a2f72e7739efd21657b4943cac60a0a3c749e712787f0e85726da4c3adcf8e014c695221027f2a0df8e86535d08ca3e766a178f90c813d2dd1d55b0166e82518efbffb18c02103556a35844b517e2fc8216701e2e0a64dbcbe62ad420ac6dd73dc79e69efeb69521031ef21bd55171032b7aec21ec82932735fb986f1d4d8611feee62ab38acf4a6bb53ae",
          "scriptsig_asm": "OP_0 OP_PUSHBYTES_72 304502210099219ee0cd5da341650078e3c63885b3cc2211069f2551cf436e0100f421e1760220349b4ec284255b458d6da539fa17314e8330459e0a653c254f775d4ec8f32b3f01 OP_PUSHBYTES_71 304402203a8353c5ee76a2e266432e5f993f882e05725297e64c0833cf44719f7dda8d3b022058a2f72e7739efd21657b4943cac60a0a3c749e712787f0e85726da4c3adcf8e01 OP_PUSHDATA1 5221027f2a0df8e86535d08ca3e766a178f90c813d2dd1d55b0166e82518efbffb18c02103556a35844b517e2fc8216701e2e0a64dbcbe62ad420ac6dd73dc79e69efeb69521031ef21bd55171032b7aec21ec82932735fb986f1d4d8611feee62ab38acf4a6bb53ae",
          "is_coinbase": false,
          "sequence": 4294967295,
          "inner_redeemscript_asm": "OP_PUSHNUM_2 OP_PUSHBYTES_33 027f2a0df8e86535d08ca3e766a178f90c813d2dd1d55b0166e82518efbffb18c0 OP_PUSHBYTES_33 03556a35844b517e2fc8216701e2e0a64dbcbe62ad420ac6dd73dc79e69efeb695 OP_PUSHBYTES_33 031ef21bd55171032b7aec21ec82932735fb986f1d4d8611feee62ab38acf4a6bb OP_PUSHNUM_3 OP_CHECKMULTISIG"
        },
        ...
        {
          "txid": "43852d32c7ae6d362d446d090daa4d389f78ec77e6693f9248cd924dc0b1ecc3",
          "vout": 1,
          "prevout": {
            "scriptpubkey": "a914a3aff5f5765f167c1582fd85517ddde83174118187",
            "scriptpubkey_asm": "OP_HASH160 OP_PUSHBYTES_20 a3aff5f5765f167c1582fd85517ddde831741181 OP_EQUAL",
            "scriptpubkey_type": "p2sh",
            "scriptpubkey_address": "3GcWrnGFoNzbn1KaiP5czS5xPELdWcgDX2",
            "value": 1719827
          },
          "scriptsig": "0047304402205f83d22a0476158aa0986682c96ce2b2dab26c814968dba62905cdfeef1b3ac7022059438a3439bb18bd49242010c8a276ea6f1810d523042e679fa6679d60e89e0201483045022100eb085df09e0fb4894090a5f39b9f2188392f7ac2847ed8255629baffc7371f170220120463b91d6c4bb8968fb3eda9012b88d13d8ca71de28e7a64b1dd88282ff144014c69522103650083cbc9cd1da1224e0780bce1ee8abd5150c5252defd0edeccd3521610b282102510ab30a6a97464ef0d61f71ec8b1d2325f12934ff15ba73579bfd0ac5f4fc1a2102985b3be77f56a9a29c5f68d3c893d6c4d76ec8c07792f0291d375c29b71ee2f853ae",
          "scriptsig_asm": "OP_0 OP_PUSHBYTES_71 304402205f83d22a0476158aa0986682c96ce2b2dab26c814968dba62905cdfeef1b3ac7022059438a3439bb18bd49242010c8a276ea6f1810d523042e679fa6679d60e89e0201 OP_PUSHBYTES_72 3045022100eb085df09e0fb4894090a5f39b9f2188392f7ac2847ed8255629baffc7371f170220120463b91d6c4bb8968fb3eda9012b88d13d8ca71de28e7a64b1dd88282ff14401 OP_PUSHDATA1 522103650083cbc9cd1da1224e0780bce1ee8abd5150c5252defd0edeccd3521610b282102510ab30a6a97464ef0d61f71ec8b1d2325f12934ff15ba73579bfd0ac5f4fc1a2102985b3be77f56a9a29c5f68d3c893d6c4d76ec8c07792f0291d375c29b71ee2f853ae",
          "is_coinbase": false,
          "sequence": 4294967295,
          "inner_redeemscript_asm": "OP_PUSHNUM_2 OP_PUSHBYTES_33 03650083cbc9cd1da1224e0780bce1ee8abd5150c5252defd0edeccd3521610b28 OP_PUSHBYTES_33 02510ab30a6a97464ef0d61f71ec8b1d2325f12934ff15ba73579bfd0ac5f4fc1a OP_PUSHBYTES_33 02985b3be77f56a9a29c5f68d3c893d6c4d76ec8c07792f0291d375c29b71ee2f8 OP_PUSHNUM_3 OP_CHECKMULTISIG"
        }
      ],
      "vout": [
        {
          "scriptpubkey": "0014292fce548b228cd3df6334dd525fac62e7eb5f7a",
          "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 292fce548b228cd3df6334dd525fac62e7eb5f7a",
          "scriptpubkey_type": "v0_p2wpkh",
          "scriptpubkey_address": "bc1q9yhuu4yty2xd8hmrxnw4yhavvtn7khm62uw38p",
          "value": 57000
        },
        ...
        {
          "scriptpubkey": "0020e5c7c00d174631d2d1e365d6347b016fb87b6a0c08902d8e443989cb771fa7ec",
          "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_32 e5c7c00d174631d2d1e365d6347b016fb87b6a0c08902d8e443989cb771fa7ec",
          "scriptpubkey_type": "v0_p2wsh",
          "scriptpubkey_address": "bc1quhruqrghgcca950rvhtrg7cpd7u8k6svpzgzmrjy8xyukacl5lkq0r8l2d",
          "value": 17343523
        }
      ],
      "size": 5514,
      "sigops": 208,
      "fee": 44000,
      "status": {
        "confirmed": true,
        "block_height": 875602,
        "block_hash": "000000000000000000016c0639b6c1a34d6659c231aa2de5849ab3377ed75020",
        "block_time": 1734704791
      },
      "order": 864069877,
      "vsize": 5514,
      "adjustedSize": 5514,
      "feePerSize": 7.979688066739209,
      "adjustedFeePerSize": 7.979688066739209,
      "effectiveFeePerSize": 7.979688066739209,
      "firstSeen": 1734704590,
      "inputs": [],
      "cpfpDirty": false,
      "ancestors": [],
      "descendants": [],
      "bestDescendant": null,
      "position": {
        "block": 0,
        "vsize": 191567
      },
      "flags": 1099511659526
    }
  ]
}`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "block-transactions": [
    {
      "txid": "9d3ea0d131c45450c135d549b62032019bc47a80368e14edc72caf38f5a88033",
      "version": 1,
      "locktime": 0,
      "vin": [
        {
          "txid": "69da555a9c69788a3a081958457894e56b1ee6766bc72cecf881b1b4f327f78b",
          "vout": 0,
          "prevout": {
            "scriptpubkey": "a914c9848245ae4f5d5934b5cbdfb79e04cdd337470b87",
            "scriptpubkey_asm": "OP_HASH160 OP_PUSHBYTES_20 c9848245ae4f5d5934b5cbdfb79e04cdd337470b OP_EQUAL",
            "scriptpubkey_type": "p2sh",
            "scriptpubkey_address": "3L4YUynB4X44rJBY9CmiLMN8Wjti49JCYB",
            "value": 24962957
          },
          "scriptsig": "0048304502210099219ee0cd5da341650078e3c63885b3cc2211069f2551cf436e0100f421e1760220349b4ec284255b458d6da539fa17314e8330459e0a653c254f775d4ec8f32b3f0147304402203a8353c5ee76a2e266432e5f993f882e05725297e64c0833cf44719f7dda8d3b022058a2f72e7739efd21657b4943cac60a0a3c749e712787f0e85726da4c3adcf8e014c695221027f2a0df8e86535d08ca3e766a178f90c813d2dd1d55b0166e82518efbffb18c02103556a35844b517e2fc8216701e2e0a64dbcbe62ad420ac6dd73dc79e69efeb69521031ef21bd55171032b7aec21ec82932735fb986f1d4d8611feee62ab38acf4a6bb53ae",
          "scriptsig_asm": "OP_0 OP_PUSHBYTES_72 304502210099219ee0cd5da341650078e3c63885b3cc2211069f2551cf436e0100f421e1760220349b4ec284255b458d6da539fa17314e8330459e0a653c254f775d4ec8f32b3f01 OP_PUSHBYTES_71 304402203a8353c5ee76a2e266432e5f993f882e05725297e64c0833cf44719f7dda8d3b022058a2f72e7739efd21657b4943cac60a0a3c749e712787f0e85726da4c3adcf8e01 OP_PUSHDATA1 5221027f2a0df8e86535d08ca3e766a178f90c813d2dd1d55b0166e82518efbffb18c02103556a35844b517e2fc8216701e2e0a64dbcbe62ad420ac6dd73dc79e69efeb69521031ef21bd55171032b7aec21ec82932735fb986f1d4d8611feee62ab38acf4a6bb53ae",
          "is_coinbase": false,
          "sequence": 4294967295,
          "inner_redeemscript_asm": "OP_PUSHNUM_2 OP_PUSHBYTES_33 027f2a0df8e86535d08ca3e766a178f90c813d2dd1d55b0166e82518efbffb18c0 OP_PUSHBYTES_33 03556a35844b517e2fc8216701e2e0a64dbcbe62ad420ac6dd73dc79e69efeb695 OP_PUSHBYTES_33 031ef21bd55171032b7aec21ec82932735fb986f1d4d8611feee62ab38acf4a6bb OP_PUSHNUM_3 OP_CHECKMULTISIG"
        },
        ...
        {
          "txid": "43852d32c7ae6d362d446d090daa4d389f78ec77e6693f9248cd924dc0b1ecc3",
          "vout": 1,
          "prevout": {
            "scriptpubkey": "a914a3aff5f5765f167c1582fd85517ddde83174118187",
            "scriptpubkey_asm": "OP_HASH160 OP_PUSHBYTES_20 a3aff5f5765f167c1582fd85517ddde831741181 OP_EQUAL",
            "scriptpubkey_type": "p2sh",
            "scriptpubkey_address": "3GcWrnGFoNzbn1KaiP5czS5xPELdWcgDX2",
            "value": 1719827
          },
          "scriptsig": "0047304402205f83d22a0476158aa0986682c96ce2b2dab26c814968dba62905cdfeef1b3ac7022059438a3439bb18bd49242010c8a276ea6f1810d523042e679fa6679d60e89e0201483045022100eb085df09e0fb4894090a5f39b9f2188392f7ac2847ed8255629baffc7371f170220120463b91d6c4bb8968fb3eda9012b88d13d8ca71de28e7a64b1dd88282ff144014c69522103650083cbc9cd1da1224e0780bce1ee8abd5150c5252defd0edeccd3521610b282102510ab30a6a97464ef0d61f71ec8b1d2325f12934ff15ba73579bfd0ac5f4fc1a2102985b3be77f56a9a29c5f68d3c893d6c4d76ec8c07792f0291d375c29b71ee2f853ae",
          "scriptsig_asm": "OP_0 OP_PUSHBYTES_71 304402205f83d22a0476158aa0986682c96ce2b2dab26c814968dba62905cdfeef1b3ac7022059438a3439bb18bd49242010c8a276ea6f1810d523042e679fa6679d60e89e0201 OP_PUSHBYTES_72 3045022100eb085df09e0fb4894090a5f39b9f2188392f7ac2847ed8255629baffc7371f170220120463b91d6c4bb8968fb3eda9012b88d13d8ca71de28e7a64b1dd88282ff14401 OP_PUSHDATA1 522103650083cbc9cd1da1224e0780bce1ee8abd5150c5252defd0edeccd3521610b282102510ab30a6a97464ef0d61f71ec8b1d2325f12934ff15ba73579bfd0ac5f4fc1a2102985b3be77f56a9a29c5f68d3c893d6c4d76ec8c07792f0291d375c29b71ee2f853ae",
          "is_coinbase": false,
          "sequence": 4294967295,
          "inner_redeemscript_asm": "OP_PUSHNUM_2 OP_PUSHBYTES_33 03650083cbc9cd1da1224e0780bce1ee8abd5150c5252defd0edeccd3521610b28 OP_PUSHBYTES_33 02510ab30a6a97464ef0d61f71ec8b1d2325f12934ff15ba73579bfd0ac5f4fc1a OP_PUSHBYTES_33 02985b3be77f56a9a29c5f68d3c893d6c4d76ec8c07792f0291d375c29b71ee2f8 OP_PUSHNUM_3 OP_CHECKMULTISIG"
        }
      ],
      "vout": [
        {
          "scriptpubkey": "0014292fce548b228cd3df6334dd525fac62e7eb5f7a",
          "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 292fce548b228cd3df6334dd525fac62e7eb5f7a",
          "scriptpubkey_type": "v0_p2wpkh",
          "scriptpubkey_address": "bc1q9yhuu4yty2xd8hmrxnw4yhavvtn7khm62uw38p",
          "value": 57000
        },
        ...
        {
          "scriptpubkey": "0020e5c7c00d174631d2d1e365d6347b016fb87b6a0c08902d8e443989cb771fa7ec",
          "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_32 e5c7c00d174631d2d1e365d6347b016fb87b6a0c08902d8e443989cb771fa7ec",
          "scriptpubkey_type": "v0_p2wsh",
          "scriptpubkey_address": "bc1quhruqrghgcca950rvhtrg7cpd7u8k6svpzgzmrjy8xyukacl5lkq0r8l2d",
          "value": 17343523
        }
      ],
      "size": 5514,
      "sigops": 208,
      "fee": 44000,
      "status": {
        "confirmed": true,
        "block_height": 875602,
        "block_hash": "000000000000000000016c0639b6c1a34d6659c231aa2de5849ab3377ed75020",
        "block_time": 1734704791
      },
      "order": 864069877,
      "vsize": 5514,
      "adjustedSize": 5514,
      "feePerSize": 7.979688066739209,
      "adjustedFeePerSize": 7.979688066739209,
      "effectiveFeePerSize": 7.979688066739209,
      "firstSeen": 1734704590,
      "inputs": [],
      "cpfpDirty": false,
      "ancestors": [],
      "descendants": [],
      "bestDescendant": null,
      "position": {
        "block": 0,
        "vsize": 191567
      },
      "flags": 1099511659526
    }
  ]
}`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "block-transactions": [
    {
      "txid": "9d3ea0d131c45450c135d549b62032019bc47a80368e14edc72caf38f5a88033",
      "version": 1,
      "locktime": 0,
      "vin": [
        {
          "txid": "69da555a9c69788a3a081958457894e56b1ee6766bc72cecf881b1b4f327f78b",
          "vout": 0,
          "prevout": {
            "scriptpubkey": "a914c9848245ae4f5d5934b5cbdfb79e04cdd337470b87",
            "scriptpubkey_asm": "OP_HASH160 OP_PUSHBYTES_20 c9848245ae4f5d5934b5cbdfb79e04cdd337470b OP_EQUAL",
            "scriptpubkey_type": "p2sh",
            "scriptpubkey_address": "3L4YUynB4X44rJBY9CmiLMN8Wjti49JCYB",
            "value": 24962957
          },
          "scriptsig": "0048304502210099219ee0cd5da341650078e3c63885b3cc2211069f2551cf436e0100f421e1760220349b4ec284255b458d6da539fa17314e8330459e0a653c254f775d4ec8f32b3f0147304402203a8353c5ee76a2e266432e5f993f882e05725297e64c0833cf44719f7dda8d3b022058a2f72e7739efd21657b4943cac60a0a3c749e712787f0e85726da4c3adcf8e014c695221027f2a0df8e86535d08ca3e766a178f90c813d2dd1d55b0166e82518efbffb18c02103556a35844b517e2fc8216701e2e0a64dbcbe62ad420ac6dd73dc79e69efeb69521031ef21bd55171032b7aec21ec82932735fb986f1d4d8611feee62ab38acf4a6bb53ae",
          "scriptsig_asm": "OP_0 OP_PUSHBYTES_72 304502210099219ee0cd5da341650078e3c63885b3cc2211069f2551cf436e0100f421e1760220349b4ec284255b458d6da539fa17314e8330459e0a653c254f775d4ec8f32b3f01 OP_PUSHBYTES_71 304402203a8353c5ee76a2e266432e5f993f882e05725297e64c0833cf44719f7dda8d3b022058a2f72e7739efd21657b4943cac60a0a3c749e712787f0e85726da4c3adcf8e01 OP_PUSHDATA1 5221027f2a0df8e86535d08ca3e766a178f90c813d2dd1d55b0166e82518efbffb18c02103556a35844b517e2fc8216701e2e0a64dbcbe62ad420ac6dd73dc79e69efeb69521031ef21bd55171032b7aec21ec82932735fb986f1d4d8611feee62ab38acf4a6bb53ae",
          "is_coinbase": false,
          "sequence": 4294967295,
          "inner_redeemscript_asm": "OP_PUSHNUM_2 OP_PUSHBYTES_33 027f2a0df8e86535d08ca3e766a178f90c813d2dd1d55b0166e82518efbffb18c0 OP_PUSHBYTES_33 03556a35844b517e2fc8216701e2e0a64dbcbe62ad420ac6dd73dc79e69efeb695 OP_PUSHBYTES_33 031ef21bd55171032b7aec21ec82932735fb986f1d4d8611feee62ab38acf4a6bb OP_PUSHNUM_3 OP_CHECKMULTISIG"
        },
        ...
        {
          "txid": "43852d32c7ae6d362d446d090daa4d389f78ec77e6693f9248cd924dc0b1ecc3",
          "vout": 1,
          "prevout": {
            "scriptpubkey": "a914a3aff5f5765f167c1582fd85517ddde83174118187",
            "scriptpubkey_asm": "OP_HASH160 OP_PUSHBYTES_20 a3aff5f5765f167c1582fd85517ddde831741181 OP_EQUAL",
            "scriptpubkey_type": "p2sh",
            "scriptpubkey_address": "3GcWrnGFoNzbn1KaiP5czS5xPELdWcgDX2",
            "value": 1719827
          },
          "scriptsig": "0047304402205f83d22a0476158aa0986682c96ce2b2dab26c814968dba62905cdfeef1b3ac7022059438a3439bb18bd49242010c8a276ea6f1810d523042e679fa6679d60e89e0201483045022100eb085df09e0fb4894090a5f39b9f2188392f7ac2847ed8255629baffc7371f170220120463b91d6c4bb8968fb3eda9012b88d13d8ca71de28e7a64b1dd88282ff144014c69522103650083cbc9cd1da1224e0780bce1ee8abd5150c5252defd0edeccd3521610b282102510ab30a6a97464ef0d61f71ec8b1d2325f12934ff15ba73579bfd0ac5f4fc1a2102985b3be77f56a9a29c5f68d3c893d6c4d76ec8c07792f0291d375c29b71ee2f853ae",
          "scriptsig_asm": "OP_0 OP_PUSHBYTES_71 304402205f83d22a0476158aa0986682c96ce2b2dab26c814968dba62905cdfeef1b3ac7022059438a3439bb18bd49242010c8a276ea6f1810d523042e679fa6679d60e89e0201 OP_PUSHBYTES_72 3045022100eb085df09e0fb4894090a5f39b9f2188392f7ac2847ed8255629baffc7371f170220120463b91d6c4bb8968fb3eda9012b88d13d8ca71de28e7a64b1dd88282ff14401 OP_PUSHDATA1 522103650083cbc9cd1da1224e0780bce1ee8abd5150c5252defd0edeccd3521610b282102510ab30a6a97464ef0d61f71ec8b1d2325f12934ff15ba73579bfd0ac5f4fc1a2102985b3be77f56a9a29c5f68d3c893d6c4d76ec8c07792f0291d375c29b71ee2f853ae",
          "is_coinbase": false,
          "sequence": 4294967295,
          "inner_redeemscript_asm": "OP_PUSHNUM_2 OP_PUSHBYTES_33 03650083cbc9cd1da1224e0780bce1ee8abd5150c5252defd0edeccd3521610b28 OP_PUSHBYTES_33 02510ab30a6a97464ef0d61f71ec8b1d2325f12934ff15ba73579bfd0ac5f4fc1a OP_PUSHBYTES_33 02985b3be77f56a9a29c5f68d3c893d6c4d76ec8c07792f0291d375c29b71ee2f8 OP_PUSHNUM_3 OP_CHECKMULTISIG"
        }
      ],
      "vout": [
        {
          "scriptpubkey": "0014292fce548b228cd3df6334dd525fac62e7eb5f7a",
          "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 292fce548b228cd3df6334dd525fac62e7eb5f7a",
          "scriptpubkey_type": "v0_p2wpkh",
          "scriptpubkey_address": "bc1q9yhuu4yty2xd8hmrxnw4yhavvtn7khm62uw38p",
          "value": 57000
        },
        ...
        {
          "scriptpubkey": "0020e5c7c00d174631d2d1e365d6347b016fb87b6a0c08902d8e443989cb771fa7ec",
          "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_32 e5c7c00d174631d2d1e365d6347b016fb87b6a0c08902d8e443989cb771fa7ec",
          "scriptpubkey_type": "v0_p2wsh",
          "scriptpubkey_address": "bc1quhruqrghgcca950rvhtrg7cpd7u8k6svpzgzmrjy8xyukacl5lkq0r8l2d",
          "value": 17343523
        }
      ],
      "size": 5514,
      "sigops": 208,
      "fee": 44000,
      "status": {
        "confirmed": true,
        "block_height": 875602,
        "block_hash": "000000000000000000016c0639b6c1a34d6659c231aa2de5849ab3377ed75020",
        "block_time": 1734704791
      },
      "order": 864069877,
      "vsize": 5514,
      "adjustedSize": 5514,
      "feePerSize": 7.979688066739209,
      "adjustedFeePerSize": 7.979688066739209,
      "effectiveFeePerSize": 7.979688066739209,
      "firstSeen": 1734704590,
      "inputs": [],
      "cpfpDirty": false,
      "ancestors": [],
      "descendants": [],
      "bestDescendant": null,
      "position": {
        "block": 0,
        "vsize": 191567
      },
      "flags": 1099511659526
    }
  ]
}`,
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "block-transactions": [
    {
      "txid": "9d3ea0d131c45450c135d549b62032019bc47a80368e14edc72caf38f5a88033",
      "version": 1,
      "locktime": 0,
      "vin": [
        {
          "txid": "69da555a9c69788a3a081958457894e56b1ee6766bc72cecf881b1b4f327f78b",
          "vout": 0,
          "prevout": {
            "scriptpubkey": "a914c9848245ae4f5d5934b5cbdfb79e04cdd337470b87",
            "scriptpubkey_asm": "OP_HASH160 OP_PUSHBYTES_20 c9848245ae4f5d5934b5cbdfb79e04cdd337470b OP_EQUAL",
            "scriptpubkey_type": "p2sh",
            "scriptpubkey_address": "3L4YUynB4X44rJBY9CmiLMN8Wjti49JCYB",
            "value": 24962957
          },
          "scriptsig": "0048304502210099219ee0cd5da341650078e3c63885b3cc2211069f2551cf436e0100f421e1760220349b4ec284255b458d6da539fa17314e8330459e0a653c254f775d4ec8f32b3f0147304402203a8353c5ee76a2e266432e5f993f882e05725297e64c0833cf44719f7dda8d3b022058a2f72e7739efd21657b4943cac60a0a3c749e712787f0e85726da4c3adcf8e014c695221027f2a0df8e86535d08ca3e766a178f90c813d2dd1d55b0166e82518efbffb18c02103556a35844b517e2fc8216701e2e0a64dbcbe62ad420ac6dd73dc79e69efeb69521031ef21bd55171032b7aec21ec82932735fb986f1d4d8611feee62ab38acf4a6bb53ae",
          "scriptsig_asm": "OP_0 OP_PUSHBYTES_72 304502210099219ee0cd5da341650078e3c63885b3cc2211069f2551cf436e0100f421e1760220349b4ec284255b458d6da539fa17314e8330459e0a653c254f775d4ec8f32b3f01 OP_PUSHBYTES_71 304402203a8353c5ee76a2e266432e5f993f882e05725297e64c0833cf44719f7dda8d3b022058a2f72e7739efd21657b4943cac60a0a3c749e712787f0e85726da4c3adcf8e01 OP_PUSHDATA1 5221027f2a0df8e86535d08ca3e766a178f90c813d2dd1d55b0166e82518efbffb18c02103556a35844b517e2fc8216701e2e0a64dbcbe62ad420ac6dd73dc79e69efeb69521031ef21bd55171032b7aec21ec82932735fb986f1d4d8611feee62ab38acf4a6bb53ae",
          "is_coinbase": false,
          "sequence": 4294967295,
          "inner_redeemscript_asm": "OP_PUSHNUM_2 OP_PUSHBYTES_33 027f2a0df8e86535d08ca3e766a178f90c813d2dd1d55b0166e82518efbffb18c0 OP_PUSHBYTES_33 03556a35844b517e2fc8216701e2e0a64dbcbe62ad420ac6dd73dc79e69efeb695 OP_PUSHBYTES_33 031ef21bd55171032b7aec21ec82932735fb986f1d4d8611feee62ab38acf4a6bb OP_PUSHNUM_3 OP_CHECKMULTISIG"
        },
        ...
        {
          "txid": "43852d32c7ae6d362d446d090daa4d389f78ec77e6693f9248cd924dc0b1ecc3",
          "vout": 1,
          "prevout": {
            "scriptpubkey": "a914a3aff5f5765f167c1582fd85517ddde83174118187",
            "scriptpubkey_asm": "OP_HASH160 OP_PUSHBYTES_20 a3aff5f5765f167c1582fd85517ddde831741181 OP_EQUAL",
            "scriptpubkey_type": "p2sh",
            "scriptpubkey_address": "3GcWrnGFoNzbn1KaiP5czS5xPELdWcgDX2",
            "value": 1719827
          },
          "scriptsig": "0047304402205f83d22a0476158aa0986682c96ce2b2dab26c814968dba62905cdfeef1b3ac7022059438a3439bb18bd49242010c8a276ea6f1810d523042e679fa6679d60e89e0201483045022100eb085df09e0fb4894090a5f39b9f2188392f7ac2847ed8255629baffc7371f170220120463b91d6c4bb8968fb3eda9012b88d13d8ca71de28e7a64b1dd88282ff144014c69522103650083cbc9cd1da1224e0780bce1ee8abd5150c5252defd0edeccd3521610b282102510ab30a6a97464ef0d61f71ec8b1d2325f12934ff15ba73579bfd0ac5f4fc1a2102985b3be77f56a9a29c5f68d3c893d6c4d76ec8c07792f0291d375c29b71ee2f853ae",
          "scriptsig_asm": "OP_0 OP_PUSHBYTES_71 304402205f83d22a0476158aa0986682c96ce2b2dab26c814968dba62905cdfeef1b3ac7022059438a3439bb18bd49242010c8a276ea6f1810d523042e679fa6679d60e89e0201 OP_PUSHBYTES_72 3045022100eb085df09e0fb4894090a5f39b9f2188392f7ac2847ed8255629baffc7371f170220120463b91d6c4bb8968fb3eda9012b88d13d8ca71de28e7a64b1dd88282ff14401 OP_PUSHDATA1 522103650083cbc9cd1da1224e0780bce1ee8abd5150c5252defd0edeccd3521610b282102510ab30a6a97464ef0d61f71ec8b1d2325f12934ff15ba73579bfd0ac5f4fc1a2102985b3be77f56a9a29c5f68d3c893d6c4d76ec8c07792f0291d375c29b71ee2f853ae",
          "is_coinbase": false,
          "sequence": 4294967295,
          "inner_redeemscript_asm": "OP_PUSHNUM_2 OP_PUSHBYTES_33 03650083cbc9cd1da1224e0780bce1ee8abd5150c5252defd0edeccd3521610b28 OP_PUSHBYTES_33 02510ab30a6a97464ef0d61f71ec8b1d2325f12934ff15ba73579bfd0ac5f4fc1a OP_PUSHBYTES_33 02985b3be77f56a9a29c5f68d3c893d6c4d76ec8c07792f0291d375c29b71ee2f8 OP_PUSHNUM_3 OP_CHECKMULTISIG"
        }
      ],
      "vout": [
        {
          "scriptpubkey": "0014292fce548b228cd3df6334dd525fac62e7eb5f7a",
          "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 292fce548b228cd3df6334dd525fac62e7eb5f7a",
          "scriptpubkey_type": "v0_p2wpkh",
          "scriptpubkey_address": "bc1q9yhuu4yty2xd8hmrxnw4yhavvtn7khm62uw38p",
          "value": 57000
        },
        ...
        {
          "scriptpubkey": "0020e5c7c00d174631d2d1e365d6347b016fb87b6a0c08902d8e443989cb771fa7ec",
          "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_32 e5c7c00d174631d2d1e365d6347b016fb87b6a0c08902d8e443989cb771fa7ec",
          "scriptpubkey_type": "v0_p2wsh",
          "scriptpubkey_address": "bc1quhruqrghgcca950rvhtrg7cpd7u8k6svpzgzmrjy8xyukacl5lkq0r8l2d",
          "value": 17343523
        }
      ],
      "size": 5514,
      "sigops": 208,
      "fee": 44000,
      "status": {
        "confirmed": true,
        "block_height": 875602,
        "block_hash": "000000000000000000016c0639b6c1a34d6659c231aa2de5849ab3377ed75020",
        "block_time": 1734704791
      },
      "order": 864069877,
      "vsize": 5514,
      "adjustedSize": 5514,
      "feePerSize": 7.979688066739209,
      "adjustedFeePerSize": 7.979688066739209,
      "effectiveFeePerSize": 7.979688066739209,
      "firstSeen": 1734704590,
      "inputs": [],
      "cpfpDirty": false,
      "ancestors": [],
      "descendants": [],
      "bestDescendant": null,
      "position": {
        "block": 0,
        "vsize": 191567
      },
      "flags": 1099511659526
    }
  ]
}`,
        },
      },
    },
  },
  {
    type: 'endpoint',
    category: 'addresses',
    fragment: 'track-addresses',
    title: 'Track Addresses',
    description: {
      default:
        "Subscribe to multiple addresses to receive live updates on new transactions having these addresses in input or output. Limits on the maximum number of tracked addresses apply. For higher tracking limits, consider upgrading to an <a href='https://explorer.melroy.org/enterprise'>enterprise sponsorship</a>.",
    },
    payload: `{
  "track-addresses": [
    "bc1qeldw4mqns26wew8swgpkt3fs364w3ehs046w2f",
    "bc1qjj09853tfpztjgrk4jeyzj4ml59fv9cmslv3c4gxxf57u0k3kxmqllx29y"
  ]
}`,
    showConditions: bitcoinNetworks,
    showJsExamples: false,
    codeExample: {
      default: {
        codeTemplate: {},
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "multi-address-transactions": {
    "bc1qjj09853tfpztjgrk4jeyzj4ml59fv9cmslv3c4gxxf57u0k3kxmqllx29y": {
      "mempool": [],
      "confirmed": [
        {
          "txid": "1e4764f908f19b74284a889478b95d013c1bd36dc832dcb7eb36fe1801fed404",
          "version": 2,
          "locktime": 875625,
          "vin": [
            {
              "txid": "ce361fed5996aec6d440556383164e9e4e5b8be8c2a213c4b36ae711efda3b3f",
              "vout": 1,
              "prevout": {
                "scriptpubkey": "0014257ba1ebc987831dbe8ee560419282483bf68588",
                "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 257ba1ebc987831dbe8ee560419282483bf68588",
                "scriptpubkey_type": "v0_p2wpkh",
                "scriptpubkey_address": "bc1qy4a6r67fs7p3m05wu4syry5zfqaldpvg8vsqzz",
                "value": 1831200
              },
              "scriptsig": "",
              "scriptsig_asm": "",
              "is_coinbase": false,
              "sequence": 4294967294
            },
            ...
          ],
          "vout": [
            {
              "scriptpubkey": "0020949e53d22b4844b92076acb2414abbfd0a96171b87d91c55063269ee3ed1b1b6",
              "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_32 949e53d22b4844b92076acb2414abbfd0a96171b87d91c55063269ee3ed1b1b6",
              "scriptpubkey_type": "v0_p2wsh",
              "scriptpubkey_address": "bc1qjj09853tfpztjgrk4jeyzj4ml59fv9cmslv3c4gxxf57u0k3kxmqllx29y",
              "value": 2546637
            }
          ],
          "size": 351,
          "sigops": 2,
          "fee": 4206,
          "status": {
            "confirmed": true,
            "block_height": 875626,
            "block_hash": "0000000000000000000086de1f4815ff0f7f0411d846301c5efa1e437130dc22",
            "block_time": 1734720142
          },
          "order": 81067521,
          "vsize": 189,
          "adjustedSize": 189,
          "feePerSize": 22.253968253968253,
          "adjustedFeePerSize": 22.253968253968253,
          "effectiveFeePerSize": 22.253968253968253,
          "firstSeen": 1734719830,
          "inputs": [],
          "cpfpDirty": false,
          "ancestors": [],
          "descendants": [],
          "bestDescendant": null,
          "position": {
            "block": 0,
            "vsize": 134866.5
          },
          "flags": 1099511640074
        }
      ],
      "removed": []
    }
  }
}`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "multi-address-transactions": {
    "bc1qjj09853tfpztjgrk4jeyzj4ml59fv9cmslv3c4gxxf57u0k3kxmqllx29y": {
      "mempool": [],
      "confirmed": [
        {
          "txid": "1e4764f908f19b74284a889478b95d013c1bd36dc832dcb7eb36fe1801fed404",
          "version": 2,
          "locktime": 875625,
          "vin": [
            {
              "txid": "ce361fed5996aec6d440556383164e9e4e5b8be8c2a213c4b36ae711efda3b3f",
              "vout": 1,
              "prevout": {
                "scriptpubkey": "0014257ba1ebc987831dbe8ee560419282483bf68588",
                "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 257ba1ebc987831dbe8ee560419282483bf68588",
                "scriptpubkey_type": "v0_p2wpkh",
                "scriptpubkey_address": "bc1qy4a6r67fs7p3m05wu4syry5zfqaldpvg8vsqzz",
                "value": 1831200
              },
              "scriptsig": "",
              "scriptsig_asm": "",
              "is_coinbase": false,
              "sequence": 4294967294
            },
            ...
          ],
          "vout": [
            {
              "scriptpubkey": "0020949e53d22b4844b92076acb2414abbfd0a96171b87d91c55063269ee3ed1b1b6",
              "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_32 949e53d22b4844b92076acb2414abbfd0a96171b87d91c55063269ee3ed1b1b6",
              "scriptpubkey_type": "v0_p2wsh",
              "scriptpubkey_address": "bc1qjj09853tfpztjgrk4jeyzj4ml59fv9cmslv3c4gxxf57u0k3kxmqllx29y",
              "value": 2546637
            }
          ],
          "size": 351,
          "sigops": 2,
          "fee": 4206,
          "status": {
            "confirmed": true,
            "block_height": 875626,
            "block_hash": "0000000000000000000086de1f4815ff0f7f0411d846301c5efa1e437130dc22",
            "block_time": 1734720142
          },
          "order": 81067521,
          "vsize": 189,
          "adjustedSize": 189,
          "feePerSize": 22.253968253968253,
          "adjustedFeePerSize": 22.253968253968253,
          "effectiveFeePerSize": 22.253968253968253,
          "firstSeen": 1734719830,
          "inputs": [],
          "cpfpDirty": false,
          "ancestors": [],
          "descendants": [],
          "bestDescendant": null,
          "position": {
            "block": 0,
            "vsize": 134866.5
          },
          "flags": 1099511640074
        }
      ],
      "removed": []
    }
  }
}`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "multi-address-transactions": {
    "bc1qjj09853tfpztjgrk4jeyzj4ml59fv9cmslv3c4gxxf57u0k3kxmqllx29y": {
      "mempool": [],
      "confirmed": [
        {
          "txid": "1e4764f908f19b74284a889478b95d013c1bd36dc832dcb7eb36fe1801fed404",
          "version": 2,
          "locktime": 875625,
          "vin": [
            {
              "txid": "ce361fed5996aec6d440556383164e9e4e5b8be8c2a213c4b36ae711efda3b3f",
              "vout": 1,
              "prevout": {
                "scriptpubkey": "0014257ba1ebc987831dbe8ee560419282483bf68588",
                "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 257ba1ebc987831dbe8ee560419282483bf68588",
                "scriptpubkey_type": "v0_p2wpkh",
                "scriptpubkey_address": "bc1qy4a6r67fs7p3m05wu4syry5zfqaldpvg8vsqzz",
                "value": 1831200
              },
              "scriptsig": "",
              "scriptsig_asm": "",
              "is_coinbase": false,
              "sequence": 4294967294
            },
            ...
          ],
          "vout": [
            {
              "scriptpubkey": "0020949e53d22b4844b92076acb2414abbfd0a96171b87d91c55063269ee3ed1b1b6",
              "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_32 949e53d22b4844b92076acb2414abbfd0a96171b87d91c55063269ee3ed1b1b6",
              "scriptpubkey_type": "v0_p2wsh",
              "scriptpubkey_address": "bc1qjj09853tfpztjgrk4jeyzj4ml59fv9cmslv3c4gxxf57u0k3kxmqllx29y",
              "value": 2546637
            }
          ],
          "size": 351,
          "sigops": 2,
          "fee": 4206,
          "status": {
            "confirmed": true,
            "block_height": 875626,
            "block_hash": "0000000000000000000086de1f4815ff0f7f0411d846301c5efa1e437130dc22",
            "block_time": 1734720142
          },
          "order": 81067521,
          "vsize": 189,
          "adjustedSize": 189,
          "feePerSize": 22.253968253968253,
          "adjustedFeePerSize": 22.253968253968253,
          "effectiveFeePerSize": 22.253968253968253,
          "firstSeen": 1734719830,
          "inputs": [],
          "ancestors": [],
          "descendants": [],
          "bestDescendant": null,
          "position": {
            "block": 0,
            "size": 134866.5
          },
          "flags": 1099511640074
        }
      ],
      "removed": []
    }
  }
}`,
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "multi-address-transactions": {
    "ex1qzq0h0wvnnh9xpd508fzxaft0nu9wjmdvzalu6f": {
      "mempool": [],
      "confirmed": [
        {
          "txid": "d61ad73b64895ccabd32816643554c676891bdb52da0fba2b37079e04c4c4b2c",
          "version": 2,
          "locktime": 3171528,
          "vin": [
            {
              "txid": "4847a0627952a0bcad6c8947d46a0e5b13eefbcfbf76246ea16a1a7c82bcc49b",
              "vout": 2,
              "prevout": {
                "scriptpubkey": "00144d72c2967e1a581c0e71e82d65e99523a9149d02",
                "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 4d72c2967e1a581c0e71e82d65e99523a9149d02",
                "scriptpubkey_type": "v0_p2wpkh",
                "scriptpubkey_address": "ex1qf4ev99n7rfvpcrn3aqkkt6v4yw53f8gznv9paa",
                "valuecommitment": "09af208bbc0b9809aff4368dee81f74f178f77f844e7dfc5d70615bc757fa8b2f9",
                "assetcommitment": "0a2ca17c42fadd887373c371e44cf49c6cd64c3081e23eef3275bdace0b8c674b5"
              },
              "scriptsig": "",
              "scriptsig_asm": "",
              "is_coinbase": false,
              "sequence": 4294967294
            },
            {
              "txid": "ea5f690853ece5549807862a153357092c4f7dbe10886b86b84f87a3201dd8dc",
              "vout": 0,
              "prevout": {
                "scriptpubkey": "0014a5996021b4001325b1aa85c3bf400516855a6e05",
                "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 a5996021b4001325b1aa85c3bf400516855a6e05",
                "scriptpubkey_type": "v0_p2wpkh",
                "scriptpubkey_address": "ex1q5kvkqgd5qqfjtvd2shpm7sq9z6z45ms9ma7ywz",
                "valuecommitment": "09f36fde0f51390cdf2ee6830b3c696569c3f9c5855ce26bd4f6d0280a83b86ecf",
                "assetcommitment": "0bfcd8fcfaebfa41b596a89aa55fbf2eaa8c383ec71e8d9d0d461ea645d8d1bc45"
              },
              "scriptsig": "",
              "scriptsig_asm": "",
              "is_coinbase": false,
              "sequence": 4294967294
            },
            {
              "txid": "23e63b888d5da3ce1193bb4a74a0762d78904cfa7a6307ff47e91054d961208b",
              "vout": 2,
              "prevout": {
                "scriptpubkey": "00144990783e871e57fa2499f00c5f6f4ddc2602e7c8",
                "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 4990783e871e57fa2499f00c5f6f4ddc2602e7c8",
                "scriptpubkey_type": "v0_p2wpkh",
                "scriptpubkey_address": "ex1qfxg8s058retl5fye7qx97m6dmsnq9e7gq0dcee",
                "valuecommitment": "0816440695f0c47ce471c7e10a93d36aee4554b46ed269bfa8390dd9db69409537",
                "assetcommitment": "0a5a0eb7cab779cb6ce5d6517c73e244075eea15fbd54a7beb34710862aef58359"
              },
              "scriptsig": "",
              "scriptsig_asm": "",
              "is_coinbase": false,
              "sequence": 4294967294
            },
            {
              "txid": "2bbeb9440d3c08a1d3cd9acf5959ee740a6a64ffcaa4aa2b43e30026a2a40334",
              "vout": 2,
              "prevout": {
                "scriptpubkey": "00144d72c2967e1a581c0e71e82d65e99523a9149d02",
                "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 4d72c2967e1a581c0e71e82d65e99523a9149d02",
                "scriptpubkey_type": "v0_p2wpkh",
                "scriptpubkey_address": "ex1qf4ev99n7rfvpcrn3aqkkt6v4yw53f8gznv9paa",
                "valuecommitment": "09d0c574d61d50065a2e398fb7252315b65176bf97de1d180d337f3aadfaa0e53e",
                "assetcommitment": "0b82ede6b9a6cb9505a7f6bcc76f72caa3228de193debf4e586d60baebeaef0ab5"
              },
              "scriptsig": "",
              "scriptsig_asm": "",
              "is_coinbase": false,
              "sequence": 4294967294
            }
          ],
          "vout": [
            {
              "scriptpubkey": "a914e185d1192f34d55ba3fbd15408168f339683d80287",
              "scriptpubkey_asm": "OP_HASH160 OP_PUSHBYTES_20 e185d1192f34d55ba3fbd15408168f339683d802 OP_EQUAL",
              "scriptpubkey_type": "p2sh",
              "scriptpubkey_address": "H3jyk9ipDU5efhHW9n52xCY78HNFAQTy78",
              "valuecommitment": "08f676101a27d784f1f89765ff33ad5a1e95ab2081da76b29ef97bdfaf309e1318",
              "assetcommitment": "0a115106f540daae5a0a7cf66dcf07a69dc2faffb917e82f340bcdfc7da143228b"
            },
            {
              "scriptpubkey": "0014101f77b9939dca60b68f3a446ea56f9f0ae96dac",
              "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 101f77b9939dca60b68f3a446ea56f9f0ae96dac",
              "scriptpubkey_type": "v0_p2wpkh",
              "scriptpubkey_address": "ex1qzq0h0wvnnh9xpd508fzxaft0nu9wjmdvzalu6f",
              "valuecommitment": "09bec5886710680e125b52ac99f6aee452984847cddc57abaa96eb8cc360f80104",
              "assetcommitment": "0adfd85f43988146c1878e98bc5e6206f368280cb03760c37e86ec0bd39005d0cd"
            },
            {
              "scriptpubkey": "00140fe27684e78285d508073f2b8a3a6c884515d1a9",
              "scriptpubkey_asm": "OP_0 OP_PUSHBYTES_20 0fe27684e78285d508073f2b8a3a6c884515d1a9",
              "scriptpubkey_type": "v0_p2wpkh",
              "scriptpubkey_address": "ex1qpl38dp88s2za2zq88u4c5wnv3pz3t5dfha22k9",
              "valuecommitment": "08bef8c28296cf050802c943d46aa539d2f5280e9b9471db928746480815cf5457",
              "assetcommitment": "0a5a032f72df6fba7f1acd7230f44cdf41ce27926e48e262ffdfea18efd19e0439"
            },
            {
              "scriptpubkey": "",
              "scriptpubkey_asm": "",
              "scriptpubkey_type": "fee",
              "value": 394,
              "asset": "6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d"
            }
          ],
          "size": 13955,
          "sigops": 0,
          "fee": 394,
          "status": {
            "confirmed": true,
            "block_height": 3171530,
            "block_hash": "400270631b0f66d70cd6a045f36bb3f37c9076688fd496669d5da2a7245392d9",
            "block_time": 1734720368
          },
          "order": 743132236,
          "adjustedSize": 3928.25,
          "feePerSize": 0.10029911538216763,
          "adjustedFeePerSize": 0.10029911538216763,
          "effectiveFeePerSize": 0.10027996945787732,
          "firstSeen": 1734720314,
          "inputs": [],
          "ancestors": [],
          "descendants": [],
          "bestDescendant": null,
          "position": {
            "block": 0,
            "vsize": 6972.5
          },
          "flags": 1099511633962
        }
      ],
      "removed": []
    }
  }
}`,
        },
      },
    },
  },
  {
    type: 'category',
    category: 'transactions',
    fragment: 'transactions',
    title: 'Transactions',
    showConditions: bitcoinNetworks,
  },
  {
    type: 'endpoint',
    category: 'transactions',
    fragment: 'track-tx',
    title: 'Track Transaction',
    description: {
      default:
        'Subscribe to a transaction to receive live updates on its confirmation status and position in the mempool.',
    },
    payload:
      '{ "track-tx": "8a4666c6d22ce74fa47e1c4fdb09af556a234cc6a606539a75caf66ba44a2d07" }',
    showConditions: bitcoinNetworks,
    showJsExamples: false,
    codeExample: {
      default: {
        codeTemplate: {},
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "txPosition": {
    "txid": [
      "8a4666c6d22ce74fa47e1c4fdb09af556a234cc6a606539a75caf66ba44a2d07"
    ],
    "position": {
      "block": 0,
      "size": 726868
    }
  }
}`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "txPosition": {
    "txid": [
      "8a4666c6d22ce74fa47e1c4fdb09af556a234cc6a606539a75caf66ba44a2d07"
    ],
    "position": {
      "block": 0,
      "size": 726868
    }
  }
}`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "txPosition": {
    "txid": [
      "8a4666c6d22ce74fa47e1c4fdb09af556a234cc6a606539a75caf66ba44a2d07"
    ],
    "position": {
      "block": 0,
      "vsize": 726868
    }
  }
}`,
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "txPosition": {
    "txid": [
      "8a4666c6d22ce74fa47e1c4fdb09af556a234cc6a606539a75caf66ba44a2d07"
    ],
    "position": {
      "block": 0,
      "vsize": 726868
    }
  }
}`,
        },
      },
    },
  },
  {
    type: 'endpoint',
    category: 'transactions',
    fragment: 'track-txs',
    title: 'Track Transactions',
    description: {
      default:
        "Subscribe to multiple transactions to receive live updates on their status and position in the mempool. Limits on the maximum number of tracked addresses apply. For higher tracking limits, consider upgrading to an <a href='https://explorer.melroy.org/enterprise'>enterprise sponsorship</a>.",
    },
    payload: `{
      "track-txs": [
        "8a4666c6d22ce74fa47e1c4fdb09af556a234cc6a606539a75caf66ba44a2d07",
        "941df06064c290b4627e92bdbf3bff7c0e97aab33e273c2a20404f9cfd21b607"
      ]
    }`,
    showConditions: bitcoinNetworks,
    showJsExamples: false,
    codeExample: {
      default: {
        codeTemplate: {},
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "tracked-txs": {
    "8a4666c6d22ce74fa47e1c4fdb09af556a234cc6a606539a75caf66ba44a2d07": {
      "position": {
        "block": 0,
        "vsize": 434494
      }
    },
    "941df06064c290b4627e92bdbf3bff7c0e97aab33e273c2a20404f9cfd21b607": {
      "position": {
        "block": 2,
        "vsize": 932479.5
      }
    }
  }
}`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "tracked-txs": {
    "8a4666c6d22ce74fa47e1c4fdb09af556a234cc6a606539a75caf66ba44a2d07": {
      "position": {
        "block": 0,
        "vsize": 434494
      }
    },
    "941df06064c290b4627e92bdbf3bff7c0e97aab33e273c2a20404f9cfd21b607": {
      "position": {
        "block": 2,
        "vsize": 932479.5
      }
    }
  }
}`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "tracked-txs": {
    "8a4666c6d22ce74fa47e1c4fdb09af556a234cc6a606539a75caf66ba44a2d07": {
      "position": {
        "block": 0,
        "vsize": 434494
      }
    },
    "941df06064c290b4627e92bdbf3bff7c0e97aab33e273c2a20404f9cfd21b607": {
      "position": {
        "block": 2,
        "vsize": 932479.5
      }
    }
  }
}`,
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "tracked-txs": {
    "8a4666c6d22ce74fa47e1c4fdb09af556a234cc6a606539a75caf66ba44a2d07": {
      "position": {
        "block": 0,
        "vsize": 434494
      }
    },
    "941df06064c290b4627e92bdbf3bff7c0e97aab33e273c2a20404f9cfd21b607": {
      "position": {
        "block": 2,
        "size": 932479.5
      }
    }
  }
}`,
        },
      },
    },
  },
  {
    type: 'category',
    category: 'mempool',
    fragment: 'mempool',
    title: 'Mempool',
    showConditions: bitcoinNetworks,
  },
  {
    type: 'endpoint',
    category: 'mempool',
    fragment: 'track-mempool',
    title: 'Track Mempool',
    description: {
      default:
        'Subscribe to new mempool events, such as new transactions entering the mempool. Available fields: <code>added</code>, <code>removed</code>, <code>mined</code>. <br> Because this is potentially a lot of data, consider using the <code>track-mempool-txids</code> endpoint described below instead.',
    },
    payload: '{ "track-mempool": true }',
    showConditions: bitcoinNetworks,
    showJsExamples: false,
    codeExample: {
      default: {
        codeTemplate: {},
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "mempool-transactions": {
    "sequence": 81419,
    "added": [
      {
        "txid": "6229c0784bc776be22a5ee84e0e3d9b8f9e17843f079a8444b03bdc98b77d229",
        "version": 2,
        "locktime": 0,
        "vin": [
          {
            "txid": "b4b324e3bff7ee0a7e664e8c03df1fe3a0bd53e5685ea6b10abb5f89ba1b2ead",
            "vout": 5,
            "prevout": {
              "scriptpubkey": "76a914b54afb58f0faa9d1bde2ed755bc56ef1e4a4e24188ac",
              "scriptpubkey_asm": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 b54afb58f0faa9d1bde2ed755bc56ef1e4a4e241 OP_EQUALVERIFY OP_CHECKSIG",
              "scriptpubkey_type": "p2pkh",
              "scriptpubkey_address": "1HXb8YtsgBhFWdYezjd6bt7Dw4UGKyZo54",
              "value": 17000
            },
            "scriptsig": "4830450221008e9b91aae7b4705841c97dc99d6ab233f10ff9b97d7c139be08634d2f0f5f66f02205d67eae8c830ed0979e169403d13c0f43efd78edbb9a344390245f5a83649404012103cf9fad8b202384de9ef010129a62b8249920a6205fe53cc0efbea9eb0db595e7",
            "scriptsig_asm": "OP_PUSHBYTES_72 30450221008e9b91aae7b4705841c97dc99d6ab233f10ff9b97d7c139be08634d2f0f5f66f02205d67eae8c830ed0979e169403d13c0f43efd78edbb9a344390245f5a8364940401 OP_PUSHBYTES_33 03cf9fad8b202384de9ef010129a62b8249920a6205fe53cc0efbea9eb0db595e7",
            "is_coinbase": false,
            "sequence": 4294967293
          }
        ],
        "vout": [
          {
            "scriptpubkey": "76a91401603bd82a5d5a6e8c6df5d9ae662b9fc5db60f288ac",
            "scriptpubkey_asm": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 01603bd82a5d5a6e8c6df5d9ae662b9fc5db60f2 OP_EQUALVERIFY OP_CHECKSIG",
            "scriptpubkey_type": "p2pkh",
            "scriptpubkey_address": "18GxdcLgNtRUc8v5TNJtPnvoi8jMVWxvb",
            "value": 10419
          },
          {
            "scriptpubkey": "76a914338ad842d236486627834bf9f5e182c7a8aa937188ac",
            "scriptpubkey_asm": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 338ad842d236486627834bf9f5e182c7a8aa9371 OP_EQUALVERIFY OP_CHECKSIG",
            "scriptpubkey_type": "p2pkh",
            "scriptpubkey_address": "15hXntT6oUKNhtk4FWvuGPQJDX47wpbAaa",
            "value": 5396
          }
        ],
        "size": 226,
        "sigops": 8,
        "fee": 1185,
        "status": {
          "confirmed": false
        },
        "order": 701659019,
        "adjustedSize": 226,
        "feePerSize": 5.243362831858407,
        "adjustedFeePerSize": 5.243362831858407,
        "effectiveFeePerSize": 5.243362831858407,
        "firstSeen": 1734893382,
        "uid": 429139,
        "inputs": [],
        "ancestors": [],
        "descendants": [],
        "bestDescendant": null,
        "position": {
          "block": 0,
          "size": 125270
        },
        "flags": 1099511628809
      },
      ...
    ],
    "removed": [],
    "mined": []
  }
}`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "mempool-transactions": {
    "sequence": 81419,
    "added": [
      {
        "txid": "6229c0784bc776be22a5ee84e0e3d9b8f9e17843f079a8444b03bdc98b77d229",
        "version": 2,
        "locktime": 0,
        "vin": [
          {
            "txid": "b4b324e3bff7ee0a7e664e8c03df1fe3a0bd53e5685ea6b10abb5f89ba1b2ead",
            "vout": 5,
            "prevout": {
              "scriptpubkey": "76a914b54afb58f0faa9d1bde2ed755bc56ef1e4a4e24188ac",
              "scriptpubkey_asm": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 b54afb58f0faa9d1bde2ed755bc56ef1e4a4e241 OP_EQUALVERIFY OP_CHECKSIG",
              "scriptpubkey_type": "p2pkh",
              "scriptpubkey_address": "1HXb8YtsgBhFWdYezjd6bt7Dw4UGKyZo54",
              "value": 17000
            },
            "scriptsig": "4830450221008e9b91aae7b4705841c97dc99d6ab233f10ff9b97d7c139be08634d2f0f5f66f02205d67eae8c830ed0979e169403d13c0f43efd78edbb9a344390245f5a83649404012103cf9fad8b202384de9ef010129a62b8249920a6205fe53cc0efbea9eb0db595e7",
            "scriptsig_asm": "OP_PUSHBYTES_72 30450221008e9b91aae7b4705841c97dc99d6ab233f10ff9b97d7c139be08634d2f0f5f66f02205d67eae8c830ed0979e169403d13c0f43efd78edbb9a344390245f5a8364940401 OP_PUSHBYTES_33 03cf9fad8b202384de9ef010129a62b8249920a6205fe53cc0efbea9eb0db595e7",
            "is_coinbase": false,
            "sequence": 4294967293
          }
        ],
        "vout": [
          {
            "scriptpubkey": "76a91401603bd82a5d5a6e8c6df5d9ae662b9fc5db60f288ac",
            "scriptpubkey_asm": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 01603bd82a5d5a6e8c6df5d9ae662b9fc5db60f2 OP_EQUALVERIFY OP_CHECKSIG",
            "scriptpubkey_type": "p2pkh",
            "scriptpubkey_address": "18GxdcLgNtRUc8v5TNJtPnvoi8jMVWxvb",
            "value": 10419
          },
          {
            "scriptpubkey": "76a914338ad842d236486627834bf9f5e182c7a8aa937188ac",
            "scriptpubkey_asm": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 338ad842d236486627834bf9f5e182c7a8aa9371 OP_EQUALVERIFY OP_CHECKSIG",
            "scriptpubkey_type": "p2pkh",
            "scriptpubkey_address": "15hXntT6oUKNhtk4FWvuGPQJDX47wpbAaa",
            "value": 5396
          }
        ],
        "size": 226,
        "sigops": 8,
        "fee": 1185,
        "status": {
          "confirmed": false
        },
        "order": 701659019,
        "adjustedSize": 226,
        "feePerSize": 5.243362831858407,
        "adjustedFeePerSize": 5.243362831858407,
        "effectiveFeePerSize": 5.243362831858407,
        "firstSeen": 1734893382,
        "uid": 429139,
        "inputs": [],
        "cpfpDirty": false,
        "ancestors": [],
        "descendants": [],
        "bestDescendant": null,
        "position": {
          "block": 0,
          "size": 125270
        },
        "flags": 1099511628809
      },
      ...
    ],
    "removed": [],
    "mined": []
  }
}`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "mempool-transactions": {
    "sequence": 81419,
    "added": [
      {
        "txid": "6229c0784bc776be22a5ee84e0e3d9b8f9e17843f079a8444b03bdc98b77d229",
        "version": 2,
        "locktime": 0,
        "vin": [
          {
            "txid": "b4b324e3bff7ee0a7e664e8c03df1fe3a0bd53e5685ea6b10abb5f89ba1b2ead",
            "vout": 5,
            "prevout": {
              "scriptpubkey": "76a914b54afb58f0faa9d1bde2ed755bc56ef1e4a4e24188ac",
              "scriptpubkey_asm": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 b54afb58f0faa9d1bde2ed755bc56ef1e4a4e241 OP_EQUALVERIFY OP_CHECKSIG",
              "scriptpubkey_type": "p2pkh",
              "scriptpubkey_address": "1HXb8YtsgBhFWdYezjd6bt7Dw4UGKyZo54",
              "value": 17000
            },
            "scriptsig": "4830450221008e9b91aae7b4705841c97dc99d6ab233f10ff9b97d7c139be08634d2f0f5f66f02205d67eae8c830ed0979e169403d13c0f43efd78edbb9a344390245f5a83649404012103cf9fad8b202384de9ef010129a62b8249920a6205fe53cc0efbea9eb0db595e7",
            "scriptsig_asm": "OP_PUSHBYTES_72 30450221008e9b91aae7b4705841c97dc99d6ab233f10ff9b97d7c139be08634d2f0f5f66f02205d67eae8c830ed0979e169403d13c0f43efd78edbb9a344390245f5a8364940401 OP_PUSHBYTES_33 03cf9fad8b202384de9ef010129a62b8249920a6205fe53cc0efbea9eb0db595e7",
            "is_coinbase": false,
            "sequence": 4294967293
          }
        ],
        "vout": [
          {
            "scriptpubkey": "76a91401603bd82a5d5a6e8c6df5d9ae662b9fc5db60f288ac",
            "scriptpubkey_asm": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 01603bd82a5d5a6e8c6df5d9ae662b9fc5db60f2 OP_EQUALVERIFY OP_CHECKSIG",
            "scriptpubkey_type": "p2pkh",
            "scriptpubkey_address": "18GxdcLgNtRUc8v5TNJtPnvoi8jMVWxvb",
            "value": 10419
          },
          {
            "scriptpubkey": "76a914338ad842d236486627834bf9f5e182c7a8aa937188ac",
            "scriptpubkey_asm": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 338ad842d236486627834bf9f5e182c7a8aa9371 OP_EQUALVERIFY OP_CHECKSIG",
            "scriptpubkey_type": "p2pkh",
            "scriptpubkey_address": "15hXntT6oUKNhtk4FWvuGPQJDX47wpbAaa",
            "value": 5396
          }
        ],
        "size": 226,
        "sigops": 8,
        "fee": 1185,
        "status": {
          "confirmed": false
        },
        "order": 701659019,
        "adjustedSize": 226,
        "feePerSize": 5.243362831858407,
        "adjustedFeePerSize": 5.243362831858407,
        "effectiveFeePerSize": 5.243362831858407,
        "firstSeen": 1734893382,
        "uid": 429139,
        "inputs": [],
        "cpfpDirty": false,
        "ancestors": [],
        "descendants": [],
        "bestDescendant": null,
        "position": {
          "block": 0,
          "size": 125270
        },
        "flags": 1099511628809
      },
      ...
    ],
    "removed": [],
    "mined": []
  }
}`,
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "mempool-transactions": {
    "sequence": 81419,
    "added": [
      {
        "txid": "6229c0784bc776be22a5ee84e0e3d9b8f9e17843f079a8444b03bdc98b77d229",
        "version": 2,
        "locktime": 0,
        "vin": [
          {
            "txid": "b4b324e3bff7ee0a7e664e8c03df1fe3a0bd53e5685ea6b10abb5f89ba1b2ead",
            "vout": 5,
            "prevout": {
              "scriptpubkey": "76a914b54afb58f0faa9d1bde2ed755bc56ef1e4a4e24188ac",
              "scriptpubkey_asm": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 b54afb58f0faa9d1bde2ed755bc56ef1e4a4e241 OP_EQUALVERIFY OP_CHECKSIG",
              "scriptpubkey_type": "p2pkh",
              "scriptpubkey_address": "1HXb8YtsgBhFWdYezjd6bt7Dw4UGKyZo54",
              "value": 17000
            },
            "scriptsig": "4830450221008e9b91aae7b4705841c97dc99d6ab233f10ff9b97d7c139be08634d2f0f5f66f02205d67eae8c830ed0979e169403d13c0f43efd78edbb9a344390245f5a83649404012103cf9fad8b202384de9ef010129a62b8249920a6205fe53cc0efbea9eb0db595e7",
            "scriptsig_asm": "OP_PUSHBYTES_72 30450221008e9b91aae7b4705841c97dc99d6ab233f10ff9b97d7c139be08634d2f0f5f66f02205d67eae8c830ed0979e169403d13c0f43efd78edbb9a344390245f5a8364940401 OP_PUSHBYTES_33 03cf9fad8b202384de9ef010129a62b8249920a6205fe53cc0efbea9eb0db595e7",
            "is_coinbase": false,
            "sequence": 4294967293
          }
        ],
        "vout": [
          {
            "scriptpubkey": "76a91401603bd82a5d5a6e8c6df5d9ae662b9fc5db60f288ac",
            "scriptpubkey_asm": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 01603bd82a5d5a6e8c6df5d9ae662b9fc5db60f2 OP_EQUALVERIFY OP_CHECKSIG",
            "scriptpubkey_type": "p2pkh",
            "scriptpubkey_address": "18GxdcLgNtRUc8v5TNJtPnvoi8jMVWxvb",
            "value": 10419
          },
          {
            "scriptpubkey": "76a914338ad842d236486627834bf9f5e182c7a8aa937188ac",
            "scriptpubkey_asm": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 338ad842d236486627834bf9f5e182c7a8aa9371 OP_EQUALVERIFY OP_CHECKSIG",
            "scriptpubkey_type": "p2pkh",
            "scriptpubkey_address": "15hXntT6oUKNhtk4FWvuGPQJDX47wpbAaa",
            "value": 5396
          }
        ],
        "size": 226,
        "sigops": 8,
        "fee": 1185,
        "status": {
          "confirmed": false
        },
        "order": 701659019,
        "adjustedSize": 226,
        "feePerSize": 5.243362831858407,
        "adjustedFeePerSize": 5.243362831858407,
        "effectiveFeePerSize": 5.243362831858407,
        "firstSeen": 1734893382,
        "uid": 429139,
        "inputs": [],
        "cpfpDirty": false,
        "ancestors": [],
        "descendants": [],
        "bestDescendant": null,
        "position": {
          "block": 0,
          "size": 125270
        },
        "flags": 1099511628809
      },
      ...
    ],
    "removed": [],
    "mined": []
  }
}`,
        },
      },
    },
  },
  {
    type: 'endpoint',
    category: 'mempool',
    fragment: 'track-mempool-txids',
    title: 'Track Mempool Txids',
    description: {
      default:
        'Low-bandwith substitute to the above command <code>track-mempool</code>: subscribe to new mempool events, such as new transactions entering the mempool, but only transaction IDs are returned to save bandwith. Available fields: <code>added</code>, <code>removed</code>, <code>mined</code>, <code>replaced</code>.',
    },
    payload: '{ "track-mempool-txids": true }',
    showConditions: bitcoinNetworks,
    showJsExamples: false,
    codeExample: {
      default: {
        codeTemplate: {},
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "mempool-txids": {
    "sequence": 79919,
    "added": [
      "4bbb648ab194aaaf9188bccc6efcdcbb59c8485115a7384972c8287782206a0f",
      "f7883f3784829d1e741e696bdceec488eeb53fe0b69b0eca574ac9f2e7e8e117",
      "784e8e3b182c29798660bf42befb5c6479148c7d90c0d6eea032b89418e7cc3b",
      "d3920a7be05269d859bd89b08a6546dc6d6dd523dbc5f7b62b9c0c5eedc43292",
      "de6078d584cb5f4a27c3f0bb3d8bbb16b3d5f8303237391f390d0ee9e84d0099",
      "39fcbd6e0ec0ad49405f19c72bb033f578147181b77dbe47044f80b0b7604ab5",
      "47ed060004fab3fb5fa4885008aa2cadbe3335655f1303231abfe89b4b0c9bd9"
    ],
    "removed": [],
    "mined": []
  }
}`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "mempool-txids": {
    "sequence": 79919,
    "added": [
      "4bbb648ab194aaaf9188bccc6efcdcbb59c8485115a7384972c8287782206a0f",
      "f7883f3784829d1e741e696bdceec488eeb53fe0b69b0eca574ac9f2e7e8e117",
      "784e8e3b182c29798660bf42befb5c6479148c7d90c0d6eea032b89418e7cc3b",
      "d3920a7be05269d859bd89b08a6546dc6d6dd523dbc5f7b62b9c0c5eedc43292",
      "de6078d584cb5f4a27c3f0bb3d8bbb16b3d5f8303237391f390d0ee9e84d0099",
      "39fcbd6e0ec0ad49405f19c72bb033f578147181b77dbe47044f80b0b7604ab5",
      "47ed060004fab3fb5fa4885008aa2cadbe3335655f1303231abfe89b4b0c9bd9"
    ],
    "removed": [],
    "mined": []
  }
}`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "mempool-txids": {
    "sequence": 79919,
    "added": [
      "4bbb648ab194aaaf9188bccc6efcdcbb59c8485115a7384972c8287782206a0f",
      "f7883f3784829d1e741e696bdceec488eeb53fe0b69b0eca574ac9f2e7e8e117",
      "784e8e3b182c29798660bf42befb5c6479148c7d90c0d6eea032b89418e7cc3b",
      "d3920a7be05269d859bd89b08a6546dc6d6dd523dbc5f7b62b9c0c5eedc43292",
      "de6078d584cb5f4a27c3f0bb3d8bbb16b3d5f8303237391f390d0ee9e84d0099",
      "39fcbd6e0ec0ad49405f19c72bb033f578147181b77dbe47044f80b0b7604ab5",
      "47ed060004fab3fb5fa4885008aa2cadbe3335655f1303231abfe89b4b0c9bd9"
    ],
    "removed": [],
    "mined": []
  }
}`,
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "mempool-txids": {
    "sequence": 79919,
    "added": [
      "4bbb648ab194aaaf9188bccc6efcdcbb59c8485115a7384972c8287782206a0f",
      "f7883f3784829d1e741e696bdceec488eeb53fe0b69b0eca574ac9f2e7e8e117",
      "784e8e3b182c29798660bf42befb5c6479148c7d90c0d6eea032b89418e7cc3b",
      "d3920a7be05269d859bd89b08a6546dc6d6dd523dbc5f7b62b9c0c5eedc43292",
      "de6078d584cb5f4a27c3f0bb3d8bbb16b3d5f8303237391f390d0ee9e84d0099",
      "39fcbd6e0ec0ad49405f19c72bb033f578147181b77dbe47044f80b0b7604ab5",
      "47ed060004fab3fb5fa4885008aa2cadbe3335655f1303231abfe89b4b0c9bd9"
    ],
    "removed": [],
    "mined": []
  }
}`,
        },
      },
    },
  },
  {
    type: 'endpoint',
    category: 'mempool',
    fragment: 'track-mempool-block',
    title: 'Track Mempool Block',
    description: {
      default:
        'Subscribe to live mempool projected block template, index 0 being the first mempool block. <br> A full set of stripped transactions in that block is returned when the subscription starts, and deltas (removed and added transactions) are then sent every time the mempool changes.',
    },
    payload: '{ "track-mempool-block": 0 }',
    showConditions: bitcoinNetworks,
    showJsExamples: false,
    codeExample: {
      default: {
        codeTemplate: {},
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "projected-block-transactions": {
    "index": 0,
    "sequence": 80270,
    "delta": {
      "added": [
        [
          "172b34fb099d80f61b65d1c107c4f25665c8f50e30c1371b2e6fbced62991d58",
          2000,
          171.25,
          5942725,
          11.68,
          1099511631877,
          1734881537
        ],
        ...
      ],
      "removed": [
        "956a6eee382214631c3299e0410565e05fbd6328c89fa746efab6371705aca2a",
        ...
        ],
      "changed": []
    }
  }
}`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "projected-block-transactions": {
    "index": 0,
    "sequence": 80270,
    "delta": {
      "added": [
        [
          "172b34fb099d80f61b65d1c107c4f25665c8f50e30c1371b2e6fbced62991d58",
          2000,
          171.25,
          5942725,
          11.68,
          1099511631877,
          1734881537
        ],
        ...
      ],
      "removed": [
        "956a6eee382214631c3299e0410565e05fbd6328c89fa746efab6371705aca2a",
        ...
        ],
      "changed": []
    }
  }
}`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "projected-block-transactions": {
    "index": 0,
    "sequence": 80270,
    "delta": {
      "added": [
        [
          "172b34fb099d80f61b65d1c107c4f25665c8f50e30c1371b2e6fbced62991d58",
          2000,
          171.25,
          5942725,
          11.68,
          1099511631877,
          1734881537
        ],
        ...
      ],
      "removed": [
        "956a6eee382214631c3299e0410565e05fbd6328c89fa746efab6371705aca2a",
        ...
        ],
      "changed": []
    }
  }
}`,
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "projected-block-transactions": {
    "index": 0,
    "sequence": 80270,
    "delta": {
      "added": [
        [
          "172b34fb099d80f61b65d1c107c4f25665c8f50e30c1371b2e6fbced62991d58",
          2000,
          171.25,
          5942725,
          11.68,
          1099511631877,
          1734881537
        ],
        ...
      ],
      "removed": [
        "956a6eee382214631c3299e0410565e05fbd6328c89fa746efab6371705aca2a",
        ...
        ],
      "changed": []
    }
  }
}`,
        },
      },
    },
  },
];

export const restApiDocsData = [
  {
    type: 'category',
    category: 'general',
    fragment: 'general',
    title: 'General',
    showConditions: bitcoinNetworks,
  },
  {
    type: 'endpoint',
    category: 'general',
    httpRequestMethod: 'GET',
    fragment: 'get-difficulty-adjustment',
    title: 'GET Difficulty Adjustment',
    description: {
      default: 'Returns details about difficulty adjustment.',
    },
    urlString: '/v1/difficulty-adjustment',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          commonJS: `
        const { %{0}: { difficulty } } = mempoolJS();

        const difficultyAdjustment = await difficulty.getDifficultyAdjustment();

        document.getElementById("result").textContent = JSON.stringify(difficultyAdjustment, undefined, 2);
          `,
          esModule: `
  const { %{0}: { difficulty } } = mempoolJS();

  const difficultyAdjustment = await difficulty.getDifficultyAdjustment();
  console.log(difficultyAdjustment);
          `,
          curl: `/api/v1/difficulty-adjustment`,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  progressPercent: 44.397234501112074,
  difficultyChange: 98.45932018381687,
  estimatedRetargetDate: 1627762478,
  remainingBlocks: 1121,
  remainingTime: 665977,
  previousRetarget: -4.807005268478962,
  nextRetargetHeight: 741888,
  timeAvg: 302328,
  adjustedTimeAvg: 302328,
  timeOffset: 0
}`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  progressPercent: 44.397234501112074,
  difficultyChange: 98.45932018381687,
  estimatedRetargetDate: 1627762478,
  remainingBlocks: 1121,
  remainingTime: 665977,
  previousRetarget: -4.807005268478962,
  nextRetargetHeight: 741888,
  timeAvg: 302328,
  adjustedTimeAvg: 302328,
  timeOffset: 0
}`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  progressPercent: 44.397234501112074,
  difficultyChange: 98.45932018381687,
  estimatedRetargetDate: 1627762478,
  remainingBlocks: 1121,
  remainingTime: 665977,
  previousRetarget: -4.807005268478962,
  nextRetargetHeight: 741888,
  timeAvg: 302328,
  adjustedTimeAvg: 302328,
  timeOffset: 0
}`,
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  progressPercent: 44.397234501112074,
  difficultyChange: 98.45932018381687,
  estimatedRetargetDate: 1627762478,
  remainingBlocks: 1121,
  remainingTime: 665977,
  previousRetarget: -4.807005268478962,
  nextRetargetHeight: 741888,
  timeAvg: 302328,
  adjustedTimeAvg: 302328,
  timeOffset: 0
}`,
        },
      },
    },
  },
  {
    type: 'endpoint',
    category: 'general',
    httpRequestMethod: 'GET',
    fragment: 'get-price',
    title: 'GET Price',
    description: {
      default: 'Returns bitcoin latest price denominated in main currencies.',
    },
    urlString: '/v1/prices',
    showConditions: [''],
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          commonJS: ``,
          esModule: ``,
          curl: `/api/v1/prices`,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  time: 1703252411,
  USD: 43753,
  EUR: 40545,
  GBP: 37528,
  CAD: 58123,
  CHF: 37438,
  AUD: 64499,
  JPY: 6218915
}`,
        },
        codeSampleTestnet: emptyCodeSample,
        codeSampleSignet: emptyCodeSample,
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      },
    },
  },
  {
    type: 'endpoint',
    category: 'general',
    httpRequestMethod: 'GET',
    fragment: 'get-historical-price',
    title: 'GET Historical Price',
    description: {
      default:
        'Returns bitcoin historical price denominated in main currencies. Available query parameters: <code>currency</code>, <code>timestamp</code>. If no parameter is provided, the full price history for all currencies is returned.',
    },
    urlString: '/v1/historical-price?currency=EUR&timestamp=1500000000',
    showConditions: [''],
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          commonJS: ``,
          esModule: ``,
          curl: `/api/v1/historical-price?currency=EUR&timestamp=1500000000`,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  prices: [
    {
      "time": 1499904000,
      "EUR": 1964,
      "USD": 2254.9
    }
  ],
  exchangeRates: {
    "USDEUR": 0.92,
    "USDGBP": 0.78,
    "USDCAD": 1.36,
    "USDCHF": 0.89,
    "USDAUD": 1.53,
    "USDJPY": 149.48
  }
}
`,
        },
        codeSampleTestnet: emptyCodeSample,
        codeSampleSignet: emptyCodeSample,
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      },
    },
  },
  {
    type: 'category',
    category: 'addresses',
    fragment: 'addresses',
    title: 'Addresses',
    showConditions: bitcoinNetworks,
  },
  {
    type: 'endpoint',
    category: 'addresses',
    httpRequestMethod: 'GET',
    fragment: 'get-address',
    title: 'GET Address',
    description: {
      default:
        'Returns details about an address. Available fields: <code>address</code>, <code>chain_stats</code>, and <code>mempool_stats</code>. <code>chain_stats</code> and <code>mempool_stats</code> each contain an object with <code>tx_count</code>, <code>funded_txo_count</code>, <code>funded_txo_sum</code>, <code>spent_txo_count</code>, and <code>spent_txo_sum</code>.',
    },
    urlString: '/address/:address',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/address/%{1}`,
          commonJS: `
        const { %{0}: { addresses } } = mempoolJS();

        const address = '%{1}';
        const myAddress = await addresses.getAddress({ address });

        document.getElementById("result").textContent = JSON.stringify(myAddress, undefined, 2);
        `,
          esModule: `
  const { %{0}: { addresses } } = mempoolJS();

  const address = '%{1}';
  const myAddress = await addresses.getAddress({ address });
  console.log(myAddress);
          `,
        },
        codeSampleMainnet: {
          esModule: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          commonJS: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          curl: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          response: `{
  address: "1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv",
  chain_stats: {
    funded_txo_count: 5,
    funded_txo_sum: 15007599040,
    spent_txo_count: 5,
    spent_txo_sum: 15007599040,
    tx_count: 7
  },
  mempool_stats: {
    funded_txo_count: 0,
    funded_txo_sum: 0,
    spent_txo_count: 0,
    spent_txo_sum: 0,
    tx_count: 0
  }
}`,
        },
        codeSampleTestnet: {
          esModule: [`tb1qp0we5epypgj4acd2c4au58045ruud2pd6heuee`],
          commonJS: [`tb1qp0we5epypgj4acd2c4au58045ruud2pd6heuee`],
          curl: [`tb1qp0we5epypgj4acd2c4au58045ruud2pd6heuee`],
          response: `{
  address: "tb1qp0we5epypgj4acd2c4au58045ruud2pd6heuee",
  chain_stats: {
    funded_txo_count: 6747,
    funded_txo_sum: 84313783821,
    spent_txo_count: 0,
    spent_txo_sum: 0,
    tx_count: 6747
  },
  mempool_stats: {
    funded_txo_count: 0,
    funded_txo_sum: 0,
    spent_txo_count: 0,
    spent_txo_sum: 0,
    tx_count: 0
  }
}`,
        },
        codeSampleSignet: {
          esModule: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          commonJS: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          curl: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          response: `{
  address: "1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv",
  chain_stats: {
    funded_txo_count: 5,
    funded_txo_sum: 15007599040,
    spent_txo_count: 5,
    spent_txo_sum: 15007599040,
    tx_count: 7
  },
  mempool_stats: {
    funded_txo_count: 0,
    funded_txo_sum: 0,
    spent_txo_count: 0,
    spent_txo_sum: 0,
    tx_count: 0
  }
}`,
        },
        codeSampleLiquid: {
          esModule: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          commonJS: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          curl: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          response: `{
  address: "Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48",
  chain_stats: {
    funded_txo_count: 1,
    spent_txo_count: 1,
    tx_count: 2
  },
  mempool_stats: {
    funded_txo_count: 0,
    spent_txo_count: 0,
    tx_count: 0
  }
}`,
        },
        codeSampleLiquidTestnet: {
          esModule: [
            `vjTwFjtVE7Fy9gjwQSxas9FkrqcnK1SeobPkdD9tghdNmCvxoXhSeCjpgD3ponKJukkD2BNPX25dZL48`,
          ],
          commonJS: [
            `vjTwFjtVE7Fy9gjwQSxas9FkrqcnK1SeobPkdD9tghdNmCvxoXhSeCjpgD3ponKJukkD2BNPX25dZL48`,
          ],
          curl: [
            `vjTwFjtVE7Fy9gjwQSxas9FkrqcnK1SeobPkdD9tghdNmCvxoXhSeCjpgD3ponKJukkD2BNPX25dZL48`,
          ],
          response: `{
  address: "vjTwFjtVE7Fy9gjwQSxas9FkrqcnK1SeobPkdD9tghdNmCvxoXhSeCjpgD3ponKJukkD2BNPX25dZL48",
  chain_stats: {
    funded_txo_count: 1,
    spent_txo_count: 0,
    tx_count: 1
  },
  mempool_stats: {
    funded_txo_count: 0,
    spent_txo_count: 0,
    tx_count: 0
  }
}`,
        },
      },
    },
  },
  {
    type: 'endpoint',
    category: 'addresses',
    httpRequestMethod: 'GET',
    fragment: 'get-address-transactions',
    title: 'GET Address Transactions',
    description: {
      default:
        'Get transaction history for the specified address/scripthash, sorted with newest first. Returns up to 50 mempool transactions plus the first 25 confirmed transactions. You can request more confirmed transactions using an <code>after_txid</code> query parameter.',
    },
    urlString: '/address/:address/txs',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/address/%{1}/txs`,
          commonJS: `
        const { %{0}: { addresses } } = mempoolJS();

        const address = '%{1}';
        const addressTxs = await addresses.getAddressTxs({ address });

        document.getElementById("result").textContent = JSON.stringify(addressTxs, undefined, 2);
        `,
          esModule: `
  const { %{0}: { addresses } } = mempoolJS();

  const address = '%{1}';
  const addressTxs = await addresses.getAddressTxs({ address });
  console.log(addressTxs);
          `,
        },
        codeSampleMainnet: {
          esModule: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          commonJS: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          curl: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          response: `[
  {
    txid: "dba43fd04b7ae3df8e5b596f2e7fab247c58629d622e3a5213f03a5a09684430",
    version: 1,
    locktime: 0,
    vin: [ [Object] ],
    vout: [ [Object], [Object] ],
    size: 255,
    weight: 1020,
    fee: 10000,
    status: {
      confirmed: true,
      block_height: 326148,
      block_hash: "00000000000000001e4118adcfbb02364bc13c41c210d8811e4f39aeb3687e36",
      block_time: 1413798020
    }
  },
  ...
]`,
        },
        codeSampleTestnet: {
          esModule: [`tb1qp0we5epypgj4acd2c4au58045ruud2pd6heuee`],
          commonJS: [`tb1qp0we5epypgj4acd2c4au58045ruud2pd6heuee`],
          curl: [`tb1qp0we5epypgj4acd2c4au58045ruud2pd6heuee`],
          response: `[
    {
      txid: "3e6afd67862ce9fe3eb55268a3107f495415ff1b5d1933c928507e9bdf7a21e6",
      version: 2,
      locktime: 0,
      vin: [],
      vout: [],
      size: 211,
      weight: 736,
      fee: 0,
      status: {
        confirmed: true,
        block_height: 2091086,
        block_hash: "00000000340f3667cce7032d084973ca29bdd0d858ec363ed894ad4c8ed09ebc",
        block_time: 1630607773
    }
  },
  ...
]`,
        },
        codeSampleSignet: {
          esModule: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          commonJS: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          curl: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          response: `{
  address: "1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv",
  chain_stats: {
    funded_txo_count: 5,
    funded_txo_sum: 15007599040,
    spent_txo_count: 5,
    spent_txo_sum: 15007599040,
    tx_count: 7
  },
  mempool_stats: {
    funded_txo_count: 0,
    funded_txo_sum: 0,
    spent_txo_count: 0,
    spent_txo_sum: 0,
    tx_count: 0
  }
}`,
        },
        codeSampleLiquid: {
          esModule: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          commonJS: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          curl: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          response: `[
  {
    txid: "e792f305016fdce71ba4a9c3057279df2b67a7a3e6147b173847a8253ad531ed",
    version: 2,
    locktime: 1438076,
    vin: [Object],
    vout: [Object],
    size: 9205,
    weight: 10492,
    fee: 262,
    status: {
      confirmed: true,
      block_height: 1438078,
      block_hash: "1625ce898d2058f4e609af2e81908ce52eba77dde099667bea68360b5679d5df",
      block_time: 1628564158
    }
  },
  ...
]`,
        },
        codeSampleLiquidTestnet: {
          esModule: [
            `vjTwFjtVE7Fy9gjwQSxas9FkrqcnK1SeobPkdD9tghdNmCvxoXhSeCjpgD3ponKJukkD2BNPX25dZL48`,
          ],
          commonJS: [
            `vjTwFjtVE7Fy9gjwQSxas9FkrqcnK1SeobPkdD9tghdNmCvxoXhSeCjpgD3ponKJukkD2BNPX25dZL48`,
          ],
          curl: [
            `vjTwFjtVE7Fy9gjwQSxas9FkrqcnK1SeobPkdD9tghdNmCvxoXhSeCjpgD3ponKJukkD2BNPX25dZL48`,
          ],
          response: `[
  {
    txid: "67108f445ae3a363452cf7f382f1b71e06126ab958673debbeaad6dab4831434",
    version: 2,
    locktime: 0,
    vin: [Object],
    vout: [Object],
    size: 8968,
    weight: 10063,
    fee: 260,
    status: {
      confirmed: true,
      block_height: 165253,
      block_hash: "c8b6233c3bc53b76cf3a629328c3e7826a749171a8b39b482daf73e0be266e09",
      block_time: 1641788900
    }
  },
  ...
]`,
        },
      },
    },
  },
  {
    type: 'endpoint',
    category: 'addresses',
    httpRequestMethod: 'GET',
    fragment: 'get-address-transactions-chain',
    title: 'GET Address Transactions Chain',
    description: {
      default:
        'Get confirmed transaction history for the specified address/scripthash, sorted with newest first. Returns 25 transactions per page. More can be requested by specifying the last txid seen by the previous query.',
    },
    urlString: '/address/:address/txs/chain',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/address/%{1}/txs/chain`,
          commonJS: `
        const { %{0}: { addresses } } = mempoolJS();

        const address = '%{1}';
        const addressTxsChain = await addresses.getAddressTxsChain({ address });

        document.getElementById("result").textContent = JSON.stringify(addressTxsChain, undefined, 2);
        `,
          esModule: `
  const { %{0}: { addresses } } = mempoolJS();

  const address = '%{1}';
  const addressTxsChain = await addresses.getAddressTxsChain({ address });
  console.log(addressTxsChain);
          `,
        },
        codeSampleMainnet: {
          esModule: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          commonJS: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          curl: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          response: `[
  {
    txid: "c4e53c2e37f4fac759fdb0d8380e4d49e6c7211233ae276a44ce7074a1d6d168",
    version: 2,
    locktime: 697761,
    vin: [],
    vout: [],
    size: 221,
    weight: 884,
    fee: 331,
    status: {
      confirmed: true,
      block_height: 697782,
      block_hash: "000000000000000000011397e53a5b1442b3dbc5df046c959c11dfe0275a4579",
      block_time: 1630040570
    }
  },
  ...
],`,
        },
        codeSampleTestnet: {
          esModule: [`tb1qp0we5epypgj4acd2c4au58045ruud2pd6heuee`],
          commonJS: [`tb1qp0we5epypgj4acd2c4au58045ruud2pd6heuee`],
          curl: [`tb1qp0we5epypgj4acd2c4au58045ruud2pd6heuee`],
          response: `[
  {
    txid: "3e6afd67862ce9fe3eb55268a3107f495415ff1b5d1933c928507e9bdf7a21e6",
    version: 2,
    locktime: 0,
    vin: [],
    vout: [],
    size: 211,
    weight: 736,
    fee: 0,
    status: {
    confirmed: true,
      block_height: 2091086,
      block_hash: "00000000340f3667cce7032d084973ca29bdd0d858ec363ed894ad4c8ed09ebc",
      block_time: 1630607773
    }
  },
  ...
],`,
        },
        codeSampleSignet: {
          esModule: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          commonJS: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          curl: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          response: `{
  address: "1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv",
  chain_stats: {
    funded_txo_count: 765,
    funded_txo_sum: 87749875807,
    spent_txo_count: 765,
    spent_txo_sum: 87749875807,
    tx_count: 875
  },
  mempool_stats: {
    funded_txo_count: 0,
    funded_txo_sum: 0,
    spent_txo_count: 0,
    spent_txo_sum: 0,
    tx_count: 0
  }
}`,
        },
        codeSampleLiquid: {
          esModule: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          commonJS: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          curl: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          response: `[
  {
    txid: "e792f305016fdce71ba4a9c3057279df2b67a7a3e6147b173847a8253ad531ed",
    version: 2,
    locktime: 1438076,
    vin: [],
    vout: [],
    size: 9205,
    weight: 10492,
    fee: 262,
    status: {
      confirmed: true,
      block_height: 1438078,
      block_hash: "1625ce898d2058f4e609af2e81908ce52eba77dde099667bea68360b5679d5df",
      block_time: 1628564158
    }
  },
  ...
]`,
        },
        codeSampleLiquidTestnet: {
          esModule: [
            `vjTwFjtVE7Fy9gjwQSxas9FkrqcnK1SeobPkdD9tghdNmCvxoXhSeCjpgD3ponKJukkD2BNPX25dZL48`,
          ],
          commonJS: [
            `vjTwFjtVE7Fy9gjwQSxas9FkrqcnK1SeobPkdD9tghdNmCvxoXhSeCjpgD3ponKJukkD2BNPX25dZL48`,
          ],
          curl: [
            `vjTwFjtVE7Fy9gjwQSxas9FkrqcnK1SeobPkdD9tghdNmCvxoXhSeCjpgD3ponKJukkD2BNPX25dZL48`,
          ],
          response: `[
  {
    txid: "67108f445ae3a363452cf7f382f1b71e06126ab958673debbeaad6dab4831434",
    version: 2,
    locktime: 0,
    vin: [],
    vout: [],
    size: 8968,
    weight: 10063,
    fee: 260,
    status: {
      confirmed: true,
      block_height: 165253,
      block_hash: "c8b6233c3bc53b76cf3a629328c3e7826a749171a8b39b482daf73e0be266e09",
      block_time: 1641788900
    }
  },
  ...
]`,
        },
      },
    },
  },
  {
    type: 'endpoint',
    category: 'addresses',
    httpRequestMethod: 'GET',
    fragment: 'get-address-transactions-mempool',
    title: 'GET Address Transactions Mempool',
    description: {
      default:
        'Get unconfirmed transaction history for the specified address/scripthash. Returns up to 50 transactions (no paging).',
    },
    urlString: '/address/:address/txs/mempool',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/address/%{1}/txs/mempool`,
          commonJS: `
        const { %{0}: { addresses } } = mempoolJS();

        const address = '%{1}';
        const addressTxsMempool = await addresses.getAddressTxsMempool({ address });

        document.getElementById("result").textContent = JSON.stringify(addressTxsMempool, undefined, 2);
        `,
          esModule: `
  const { %{0}: { addresses } } = mempoolJS();

  const address = '%{1}';
  const addressTxsMempool = await addresses.getAddressTxsMempool({ address });
  console.log(addressTxsMempool);
          `,
        },
        codeSampleMainnet: {
          esModule: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          commonJS: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          curl: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          response: `[
  {
    txid: "16cd9bbc6b62313a22d16671fa559aec6bf581df8b5853d37775c84b0fddfa90",
    version: 2,
    locktime: 0,
    vin: [ [Object] ],
    vout: [ [Object], [Object] ],
    size: 226,
    weight: 904,
    fee: 6720,
    status: { confirmed: false }
  }
]`,
        },
        codeSampleTestnet: {
          esModule: [`tb1qp0we5epypgj4acd2c4au58045ruud2pd6heuee`],
          commonJS: [`tb1qp0we5epypgj4acd2c4au58045ruud2pd6heuee`],
          curl: [`tb1qp0we5epypgj4acd2c4au58045ruud2pd6heuee`],
          response: `[
  {
    txid: "16cd9bbc6b62313a22d16671fa559aec6bf581df8b5853d37775c84b0fddfa90",
    version: 2,
    locktime: 0,
    vin: [ [Object] ],
    vout: [ [Object], [Object] ],
    size: 226,
    weight: 904,
    fee: 6720,
    status: { confirmed: false }
  }
]`,
        },
        codeSampleSignet: {
          esModule: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          commonJS: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          curl: [`1wiz18xYmhRX6xStj2b9t1rwWX4GKUgpv`],
          response: `[
  {
    txid: "16cd9bbc6b62313a22d16671fa559aec6bf581df8b5853d37775c84b0fddfa90",
    version: 2,
    locktime: 0,
    vin: [ [Object] ],
    vout: [ [Object], [Object] ],
    size: 226,
    weight: 904,
    fee: 6720,
    status: { confirmed: false }
  }
]`,
        },
        codeSampleLiquid: {
          esModule: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          commonJS: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          curl: [`Go65t19hP2FuhBMYtgbdMDgdmEzNwh1i48`],
          response: `[
  {
    txid: "16cd9bbc6b62313a22d16671fa559aec6bf581df8b5853d37775c84b0fddfa90",
    version: 2,
    locktime: 0,
    vin: [ [Object] ],
    vout: [ [Object], [Object] ],
    size: 226,
    weight: 904,
    fee: 6720,
    status: { confirmed: false }
  }
]`,
        },
        codeSampleLiquidTestnet: {
          esModule: [`928jXZPDqQAt5vzGvBXKWMKCS9vfCa9Rfu`],
          commonJS: [`928jXZPDqQAt5vzGvBXKWMKCS9vfCa9Rfu`],
          curl: [`928jXZPDqQAt5vzGvBXKWMKCS9vfCa9Rfu`],
          response: `[
  {
    txid: "3ab8bc068ee05c1114647dc5196b3b954b00e5af3b03d470d1ef8a8953737357",
    version: 2,
    locktime: 0,
    vin: [ [Object] ],
    vout: [ [Object], [Object] ],
    size: 14720,
    weight: 58880,
    fee: 1496,
    status: { confirmed: false }
  }
]`,
        },
      },
    },
  },
  {
    type: 'endpoint',
    category: 'addresses',
    httpRequestMethod: 'GET',
    fragment: 'get-address-utxo',
    title: 'GET Address UTXO',
    description: {
      default:
        'Get the list of unspent transaction outputs associated with the address/scripthash. Available fields: <code>txid</code>, <code>vout</code>, <code>value</code>, and <code>status</code> (with the status of the funding tx).',
      liquid:
        'Get the list of unspent transaction outputs associated with the address/scripthash. Available fields: <code>txid</code>, <code>vout</code>, <code>value</code>, and <code>status</code> (with the status of the funding tx). There is also a <code>valuecommitment</code> field that may appear in place of <code>value</code>, plus the following additional fields: <code>asset</code>/<code>assetcommitment</code>, <code>nonce</code>/<code>noncecommitment</code>, <code>surjection_proof</code>, and <code>range_proof</code>.',
    },
    urlString: '/address/:address/utxo',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/address/%{1}/utxo`,
          commonJS: `
        const { %{0}: { addresses } } = mempoolJS();

        const address = '%{1}';
        const addressTxsUtxo = await addresses.getAddressTxsUtxo({ address });

        document.getElementById("result").textContent = JSON.stringify(addressTxsUtxo, undefined, 2);
        `,
          esModule: `
  const { %{0}: { addresses } } = mempoolJS();

  const address = '%{1}';
  const addressTxsUtxo = await addresses.getAddressTxsUtxo({ address });
  console.log(addressTxsUtxo);
          `,
        },
        codeSampleMainnet: {
          esModule: [`1KFHE7w8BhaENAswwryaoccDb6qcT6DbYY`],
          commonJS: [`1KFHE7w8BhaENAswwryaoccDb6qcT6DbYY`],
          curl: [`1KFHE7w8BhaENAswwryaoccDb6qcT6DbYY`],
          response: `[
  {
    txid: "12f96289f8f9cd51ccfe390879a46d7eeb0435d9e0af9297776e6bdf249414ff",
    vout: 0,
    status: {
      confirmed: true,
      block_height: 698642,
      block_hash: "00000000000000000007839f42e0e86fd53c797b64b7135fcad385158c9cafb8",
      block_time: 1630561459
    },
    value: 644951084
  },
  ...
]`,
        },
        codeSampleTestnet: {
          esModule: [`tb1q4kgratttzjvkxfmgd95z54qcq7y6hekdm3w56u`],
          commonJS: [`tb1q4kgratttzjvkxfmgd95z54qcq7y6hekdm3w56u`],
          curl: [`tb1q4kgratttzjvkxfmgd95z54qcq7y6hekdm3w56u`],
          response: `[
  {
    txid: "c404bc4ba89e9423ff772cb45268ba6fba8b713f809484c1216f1a657aafa088",
    vout: 1,
    status: {
      confirmed: true,
      block_height: 2086944,
      block_hash: "000000000000039a27007892b0f3ac646afa4eb3ef3d4a4e75e8bdf636b4d006",
      block_time: 1630159123
    },
    value: 1973787
  },
  ...
]`,
        },
        codeSampleSignet: {
          esModule: [
            `tb1pu8ysre22dcl6qy5m5w7mjwutw73w4u24slcdh4myq06uhr6q29dqwc3ckt`,
          ],
          commonJS: [
            `tb1pu8ysre22dcl6qy5m5w7mjwutw73w4u24slcdh4myq06uhr6q29dqwc3ckt`,
          ],
          curl: [
            `tb1pu8ysre22dcl6qy5m5w7mjwutw73w4u24slcdh4myq06uhr6q29dqwc3ckt`,
          ],
          response: `[
  {
    txid: "c56a054302df8f8f80c5ac6b86b24ed52bf41d64de640659837c56bc33d10c9e",
    vout: 0,
    status: {
      confirmed: true,
      block_height: 174923,
      block_hash: "000000750e335ff355be2e3754fdada30d107d7d916aef07e2f5d014bec845e5",
      block_time: 1703321003
    },
    value: 546
  },
  ...
]`,
        },
        codeSampleLiquid: {
          esModule: [`GhkYnB1g6oNSqALtcHgpirYM65EuLZdaNg`],
          commonJS: [`GhkYnB1g6oNSqALtcHgpirYM65EuLZdaNg`],
          curl: [`GhkYnB1g6oNSqALtcHgpirYM65EuLZdaNg`],
          response: `[
  {
    txid: "067bac619cc67de7654bb3ee01ebcadf1e582980b3873478bac7d3931f06045f",
    vout: 1,
    status: {
      confirmed: true,
      block_height: 1471900,
      block_hash: "9408b32d41225cea32bace82aac1789a218e6592ab24de5793ca2138b876f536",
      block_time: 1630621258
    },
    valuecommitment: "0805015e56cbbf6cc494cb200615b7f8b781f0d640e4c96b4abdad356068f6346f",
    assetcommitment: "0a6bb828996381a61cb9f24610bea8a0c35efe388d39a993d369e08a6fc358e7dc",
    noncecommitment: "0282f3f01f06e43fb88bcd28e7e83c9c0d9cefc92c104a6e814810c100ec66b33d"
  }
]`,
        },
        codeSampleLiquidTestnet: {
          esModule: [`tex1q9f8nat57n93e8q0p6vddw9phew6u348uff8hqz`],
          commonJS: [`tex1q9f8nat57n93e8q0p6vddw9phew6u348uff8hqz`],
          curl: [`tex1q9f8nat57n93e8q0p6vddw9phew6u348uff8hqz`],
          response: `[
  {
    "txid": "b010ce1accf781234e9736243a33c5367ce76e3a12609cf70a80ad15679c57dd",
    "vout": 0,
    "status": {
      "confirmed": false
    },
    "valuecommitment": "087851b6faa9b97d3c87dba24d69456b4084c36529ca0bda8aebea3fca787ec298",
    "assetcommitment": "0b16b09f9987d7f7aaa8b6bd61f00e50b448ecb8b4ecf3623338b80e2533637848",
    "noncecommitment": "03ba8cf651bd77791ea6a208a9f7ab8482b1ea207e4e4b2e6e964ebd163f81afb7",
    "surjection_proof": "010001398a7d5ac645e45b27898ee4548b111c64cdf1850cf283dbdea89c3163d168d8...",
    "range_proof": "6033000000000000000116898801858209e1386655e803472959b95e706d47fca2bfad..."
  }
]`,
        },
      },
    },
  },
  {
    type: 'endpoint',
    category: 'addresses',
    httpRequestMethod: 'GET',
    fragment: 'get-address-validate',
    title: 'GET Address Validation',
    description: {
      default:
        'Returns whether an address is valid or not. Available fields: <code>isvalid</code> (boolean), <code>address</code> (string), <code>scriptPubKey</code> (string) and <code>isscript</code> (boolean).',
    },
    urlString: '/v1/validate-address/:address',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/validate-address/%{1}`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          curl: [`1KFHE7w8BhaENAswwryaoccDb6qcT6DbYY`],
          response: `{
  isvalid: true,
  address: "1KFHE7w8BhaENAswwryaoccDb6qcT6DbYY",
  scriptPubKey: "76a914c825a1ecf2a6830c4401620c3a16f1995057c2ab88ac",
  isscript: false
}`,
        },
        codeSampleTestnet: {
          curl: [`tb1q4kgratttzjvkxfmgd95z54qcq7y6hekdm3w56u`],
          response: `{
  isvalid: true,
  address: "tb1q4kgratttzjvkxfmgd95z54qcq7y6hekdm3w56u",
  scriptPubKey: "0014ad903ead6b149963276869682a54180789abe6cd",
  isscript: false
}`,
        },
        codeSampleSignet: {
          curl: [
            `tb1pu8ysre22dcl6qy5m5w7mjwutw73w4u24slcdh4myq06uhr6q29dqwc3ckt`,
          ],
          response: `{
  isvalid: true,
  address: "tb1pu8ysre22dcl6qy5m5w7mjwutw73w4u24slcdh4myq06uhr6q29dqwc3ckt",
  scriptPubKey: "5120e1c901e54a6e3fa0129ba3bdb93b8b77a2eaf15587f0dbd76403f5cb8f40515a",
  isscript: true
}`,
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      },
    },
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block-timestamp',
    title: 'GET Block Timestamp',
    description: {
      default:
        'Returns the height and the hash of the block closest to the given <code>:timestamp</code>.',
    },
    urlString: '/v1/mining/blocks/timestamp/:timestamp',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/blocks/timestamp/%{1}`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: ['1672531200'],
          response: `{
  height: 769786,
  hash: "000000000000000000017f6405c2382de84944eb21be9cec0379a735813f137b",
  timestamp: "2022-12-31T23:30:31.000Z"
}`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: ['1672531200'],
          response: `{
  height: 2413838,
  hash: "00000000000000082888e2353ea4baaea04d2e0e88f2ee054ad2bbcc1d6a5469",
  timestamp: "2022-12-31T23:57:26.000Z"
}`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: ['1672531200'],
          response: `{
  height: 123713,
  hash: "0000010c6df8ffe1684ab9d7cfac69836a4538c057fab4571b809120fe486c96",
  timestamp: "2022-12-31T23:55:56.000Z"
}`,
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      },
    },
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block-raw',
    title: 'GET Block Raw',
    description: {
      default: 'Returns the raw block representation in binary.',
    },
    urlString: '/block/:hash/raw',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/block/%{1}/raw`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const hash = '%{1}';
        const blockRaw = await blocks.getBlockRaw({ hash });

        document.getElementById("result").textContent = JSON.stringify(blockRaw, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const hash = '%{1}';
  const blockRaw = await blocks.getBlockRaw({ hash });
  console.log(blockRaw);
          `,
        },
        codeSampleMainnet: {
          esModule: [
            '0000000000000000000065bda8f8a88f2e1e00d9a6887a43d640e52a4c7660f2',
          ],
          commonJS: [
            '0000000000000000000065bda8f8a88f2e1e00d9a6887a43d640e52a4c7660f2',
          ],
          curl: [
            '0000000000000000000065bda8f8a88f2e1e00d9a6887a43d640e52a4c7660f2',
          ],
          response: '',
        },
        codeSampleTestnet: {
          esModule: [
            '000000000000009c08dc77c3f224d9f5bbe335a78b996ec1e0701e065537ca81',
          ],
          commonJS: [
            '000000000000009c08dc77c3f224d9f5bbe335a78b996ec1e0701e065537ca81',
          ],
          curl: [
            '000000000000009c08dc77c3f224d9f5bbe335a78b996ec1e0701e065537ca81',
          ],
          response: '',
        },
        codeSampleSignet: {
          esModule: [
            '000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152',
          ],
          commonJS: [
            '000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152',
          ],
          curl: [
            '000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152',
          ],
          response: '',
        },
        codeSampleLiquid: {
          esModule: [
            `86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`,
          ],
          commonJS: [
            `86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`,
          ],
          curl: [
            `86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`,
          ],
          response: '',
        },
        codeSampleLiquidTestnet: {
          esModule: [
            `67d5eb1aee63c6c2058a088985503ff0626fd3f7f8022bdc74fab36a359164db`,
          ],
          commonJS: [
            `67d5eb1aee63c6c2058a088985503ff0626fd3f7f8022bdc74fab36a359164db`,
          ],
          curl: [
            `67d5eb1aee63c6c2058a088985503ff0626fd3f7f8022bdc74fab36a359164db`,
          ],
          response: '',
        },
      },
    },
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block-status',
    title: 'GET Block Status',
    description: {
      default:
        'Returns the confirmation status of a block. Available fields: <code>in_best_chain</code> (boolean, false for orphaned blocks), <code>next_best</code> (the hash of the next block, only available for blocks in the best chain).',
    },
    urlString: '/block/:hash/status',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/block/%{1}/status`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const hash = '%{1}';
        const blockStatus = await blocks.getBlockStatus({ hash });

        document.getElementById("result").textContent = JSON.stringify(blockStatus, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const hash = '%{1}';
  const blockStatus = await blocks.getBlockStatus({ hash });
  console.log(blockStatus);
          `,
        },
        codeSampleMainnet: {
          esModule: [
            '0000000000000000000065bda8f8a88f2e1e00d9a6887a43d640e52a4c7660f2',
          ],
          commonJS: [
            '0000000000000000000065bda8f8a88f2e1e00d9a6887a43d640e52a4c7660f2',
          ],
          curl: [
            '0000000000000000000065bda8f8a88f2e1e00d9a6887a43d640e52a4c7660f2',
          ],
          response: `{
  in_best_chain: true,
  height: 690557,
  next_best: "00000000000000000003a59a34c93e39e636c8cd23ead726fdc467fbed0b7c5a"
}`,
        },
        codeSampleTestnet: {
          esModule: [
            '000000000000009c08dc77c3f224d9f5bbe335a78b996ec1e0701e065537ca81',
          ],
          commonJS: [
            '000000000000009c08dc77c3f224d9f5bbe335a78b996ec1e0701e065537ca81',
          ],
          curl: [
            '000000000000009c08dc77c3f224d9f5bbe335a78b996ec1e0701e065537ca81',
          ],
          response: `{
  in_best_chain: true,
  height: 2091140,
  next_best: "0000000000000064152f2dc1e13bd70811fbcfa9c1660557233668b98b7b1c2b"
}`,
        },
        codeSampleSignet: {
          esModule: [
            '000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152',
          ],
          commonJS: [
            '000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152',
          ],
          curl: [
            '000000ca66fab8083d4f0370d499c3d602e78af5fa69b2427cda15a3f0d96152',
          ],
          response: `{
  in_best_chain: true,
  height: 53745,
  next_best: "000000e9c2a969f6a3425ab70851328e878ebdeb90b73f9cfb16241b97c44640"
}`,
        },
        codeSampleLiquid: {
          esModule: [
            `86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`,
          ],
          commonJS: [
            `86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`,
          ],
          curl: [
            `86aefdd3cf7be8e5781f783fe5d80513e8b3f52f2f1ef61e8e056b7faffc4b78`,
          ],
          response: `{
  in_best_chain: true,
  height: 1471971,
  next_best: "1ce5b14c5fbc05be73d8833839e049fd34212da902a78118cd8502a95bf9c134"
}`,
        },
        codeSampleLiquidTestnet: {
          esModule: [
            `67d5eb1aee63c6c2058a088985503ff0626fd3f7f8022bdc74fab36a359164db`,
          ],
          commonJS: [
            `67d5eb1aee63c6c2058a088985503ff0626fd3f7f8022bdc74fab36a359164db`,
          ],
          curl: [
            `67d5eb1aee63c6c2058a088985503ff0626fd3f7f8022bdc74fab36a359164db`,
          ],
          response: `{
  in_best_chain: true,
  height: 150000,
  next_best: "2f24f3d94c006971b86fe2c9cdc92a7ed0aa7ec3b0643a836b8d8b5a54103bab"
}`,
        },
      },
    },
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block-tip-height',
    title: 'GET Block Tip Height',
    description: {
      default: 'Returns the height of the last block.',
    },
    urlString: '/blocks/tip/height',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/blocks/tip/height`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const blocksTipHeight = await blocks.getBlocksTipHeight();

        document.getElementById("result").textContent = JSON.stringify(blocksTipHeight, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const blocksTipHeight = await blocks.getBlocksTipHeight();
  console.log(blocksTipHeight);
          `,
        },
        codeSampleMainnet: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `698767`,
        },
        codeSampleTestnet: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `2091168`,
        },
        codeSampleSignet: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `53763`,
        },
        codeSampleLiquid: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `1472119`,
        },
        codeSampleLiquidTestnet: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `162495`,
        },
      },
    },
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block-tip-hash',
    title: 'GET Block Tip Hash',
    description: {
      default: 'Returns the hash of the last block.',
    },
    urlString: '/blocks/tip/hash',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/blocks/tip/hash`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const blocksTipHash = await blocks.getBlocksTipHash();

        document.getElementById("result").textContent = JSON.stringify(blocksTipHash, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const blocksTipHash = await blocks.getBlocksTipHash();
  console.log(blocksTipHash);
          `,
        },
        codeSampleMainnet: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `0000000000000000000624d76f52661d0f35a0da8b93a87cb93cf08fd9140209`,
        },
        codeSampleTestnet: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `00000000000000a7a5227bb493ffb90d1e63e1c7e8cab2c9a2b98e9f2599a9a9`,
        },
        codeSampleSignet: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `000000c09517efadf7425f7c19543b69768aaa9871a817d192d2c33cebebf3f9`,
        },
        codeSampleLiquid: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `ec8fed6f33cba86f99b39ae65af948bfc2fdb95cceaa7331bbfd88f5daa823a2`,
        },
        codeSampleLiquidTestnet: {
          esModule: [''],
          commonJS: [''],
          curl: [''],
          response: `ff643a1e102b555103d8feb20b296ee5cf3b4a202fa284e5d6ce82945b738ae7`,
        },
      },
    },
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block-transaction-id',
    title: 'GET Block Transaction ID',
    description: {
      default:
        'Returns the transaction at index <code>:index</code> within the specified block.',
    },
    urlString: '/block/:hash/txid/:index',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/block/%{1}/txid/%{2}`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const hash = '%{1}';
        const blockTxid = await blocks.getBlockTxid({ hash, index: %{2} });

        document.getElementById("result").textContent = JSON.stringify(blockTxid, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const hash = '%{1}';
  const blockTxid = await blocks.getBlockTxid({ hash, index: %{2} });
  console.log(blockTxid);
          `,
        },
        codeSampleMainnet: {
          esModule: [
            '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce',
            '218',
          ],
          commonJS: [
            '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce',
            '218',
          ],
          curl: [
            '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce',
            '218',
          ],
          response: `0fa6da60e484941f255cbb025c3d6440e5a7e970119e899b4065c7999360e406`,
        },
        codeSampleTestnet: {
          esModule: [
            '000000000000004a3ff1faff12c446f711c650454ff8af7f41d1e8b2564dd74b',
            '1',
          ],
          commonJS: [
            '000000000000004a3ff1faff12c446f711c650454ff8af7f41d1e8b2564dd74b',
            '1',
          ],
          curl: [
            '000000000000004a3ff1faff12c446f711c650454ff8af7f41d1e8b2564dd74b',
            '1',
          ],
          response: `7aede67cd9f48c2f77ca9112c27da2583ea41fbb391652777c44ef21d5b1656e`,
        },
        codeSampleSignet: {
          esModule: [
            '0000014b62b53d2550c310208af9d792ab7a9a2487a67d82c06b17b201ee602f',
            '1',
          ],
          commonJS: [
            '0000014b62b53d2550c310208af9d792ab7a9a2487a67d82c06b17b201ee602f',
            '1',
          ],
          curl: [
            '0000014b62b53d2550c310208af9d792ab7a9a2487a67d82c06b17b201ee602f',
            '1',
          ],
          response: `b72a9a7cfbb0685e393f86fa1fa1c43c2888b9ad01c9ac48a28b98e2c8721a89`,
        },
        codeSampleLiquid: {
          esModule: [
            'dbbf73007879859f2c55b8605751498ad0d2848db0fdedeadcbdc0cf4f02ee13',
            '1',
          ],
          commonJS: [
            'dbbf73007879859f2c55b8605751498ad0d2848db0fdedeadcbdc0cf4f02ee13',
            '1',
          ],
          curl: [
            'dbbf73007879859f2c55b8605751498ad0d2848db0fdedeadcbdc0cf4f02ee13',
            '1',
          ],
          response: `36e47770c306ae5d4ddcc2ce50f6ce6e23d6bdc692b9a9a347fb68d19255f598`,
        },
        codeSampleLiquidTestnet: {
          esModule: [
            'b6b4aeefa220c6a17da116bda666e869b3146967d2479656448a8bce1e799b8f',
            '1',
          ],
          commonJS: [
            'b6b4aeefa220c6a17da116bda666e869b3146967d2479656448a8bce1e799b8f',
            '1',
          ],
          curl: [
            'b6b4aeefa220c6a17da116bda666e869b3146967d2479656448a8bce1e799b8f',
            '1',
          ],
          response: `41493aa0eec8b6d359c2defc90e2fafb42fb5b8633456648553467a4d3a16c4a`,
        },
      },
    },
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block-transaction-ids',
    title: 'GET Block Transaction IDs',
    description: {
      default: 'Returns a list of all txids in the block.',
    },
    urlString: '/block/:hash/txids',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/block/%{1}/txids`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const hash = '%{1}';
        const blockTxids = await blocks.getBlockTxids({ hash });

        document.getElementById("result").textContent = JSON.stringify(blockTxids, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const hash = '%{1}';
  const blockTxids = await blocks.getBlockTxids({ hash });
  console.log(blockTxids);
          `,
        },
        codeSampleMainnet: {
          esModule: [
            '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce',
            '218',
          ],
          commonJS: [
            '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce',
            '218',
          ],
          curl: [
            '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce',
            '218',
          ],
          response: `[
  "cfe624ccdd8010cf78dbedd1b25e1ff601b470c4d7d90fa9fc8c1bcc5cdc6e0e",
  "a5ef89881bd5103f223a0fa285dfc75f4718974cb792cf85e623a7de05801bc9",
  ...,
]`,
        },
        codeSampleTestnet: {
          esModule: [
            '000000000000004a3ff1faff12c446f711c650454ff8af7f41d1e8b2564dd74b',
            '1',
          ],
          commonJS: [
            '000000000000004a3ff1faff12c446f711c650454ff8af7f41d1e8b2564dd74b',
            '1',
          ],
          curl: [
            '000000000000004a3ff1faff12c446f711c650454ff8af7f41d1e8b2564dd74b',
            '1',
          ],
          response: `[
  "b5d033f57045b76f2f29df0c2469be0153ecf2514717bccd8d52250b3e7ba781",
  "7aede67cd9f48c2f77ca9112c27da2583ea41fbb391652777c44ef21d5b1656e",
  "20827f9a8fb5ec5fa55ce5389b1d7520d7961272492dc3424874887daeea21dc"
]`,
        },
        codeSampleSignet: {
          esModule: [
            '0000014b62b53d2550c310208af9d792ab7a9a2487a67d82c06b17b201ee602f',
            '1',
          ],
          commonJS: [
            '0000014b62b53d2550c310208af9d792ab7a9a2487a67d82c06b17b201ee602f',
            '1',
          ],
          curl: [
            '0000014b62b53d2550c310208af9d792ab7a9a2487a67d82c06b17b201ee602f',
            '1',
          ],
          response: `[
  "4220d4fe0ec4beb9313e15fa225fb0bbdf2c17d74b56615e07263aed32d4fdb2",
  "b72a9a7cfbb0685e393f86fa1fa1c43c2888b9ad01c9ac48a28b98e2c8721a89",
  "0597e9355e868f98560b0e30d0c6b9f5e7c0f004c376ef26850f61096fabb692",
  "857ff0a341b14aae2e45122d458f13d0d744cc1081ef0ae2aaec32c01587d1c0",
  "6062ac26ef4b0c9b5343bdf46c1677297f85705f523472a96383af276a20b0da",
  "a469bed29a54ef3ed5d00c472f10603ed3ee7c4972fc3cb623e738d628064d19",
  "ca1a3d14d88dc72a5cb6da198c7151f1f71718ee4b4ba70d6bc597a260b0ab20",
  "7516b5aaeaab70a735f47b4e100421363cef535378d522a3244ac8741b9d6740",
  "ee428b6be6df6655ddcbfd64bb3a8fa8de513c4f50d94c1ef91df1254cf45172",
  "7cf09ecd458613cd3817754286d356fd91efa8456cc9fdc744b65dd6e01ca6ab",
  "43082dda77028f2ccab3639c919aea6049fd3917a5f3f413f0ee12ca4daf4ad6",
  "13e4c56fdc40928e8639d19aefff23270ea5555c6e8887fd95b609c50297cbe0",
  "99bcab11aab1ccb4b2881e5fb0e9b788b8ee0064caa0915e3de62ff8ea65adf5"
]`,
        },
        codeSampleLiquid: {
          esModule: [
            'dbbf73007879859f2c55b8605751498ad0d2848db0fdedeadcbdc0cf4f02ee13',
            '1',
          ],
          commonJS: [
            'dbbf73007879859f2c55b8605751498ad0d2848db0fdedeadcbdc0cf4f02ee13',
            '1',
          ],
          curl: [
            'dbbf73007879859f2c55b8605751498ad0d2848db0fdedeadcbdc0cf4f02ee13',
            '1',
          ],
          response: `[
  "45abcc4572f519155cd65686c3be9cc744d79d6f36c928b0aa3c989f8ee094be",
  "36e47770c306ae5d4ddcc2ce50f6ce6e23d6bdc692b9a9a347fb68d19255f598"
]`,
        },
        codeSampleLiquidTestnet: {
          esModule: [
            'b6b4aeefa220c6a17da116bda666e869b3146967d2479656448a8bce1e799b8f',
            '1',
          ],
          commonJS: [
            'b6b4aeefa220c6a17da116bda666e869b3146967d2479656448a8bce1e799b8f',
            '1',
          ],
          curl: [
            'b6b4aeefa220c6a17da116bda666e869b3146967d2479656448a8bce1e799b8f',
            '1',
          ],
          response: `[
  "95422f140e3d88e6ddaf0625ee523dbf9d38934d67ce32baf6c162d83a08f89f",
  "41493aa0eec8b6d359c2defc90e2fafb42fb5b8633456648553467a4d3a16c4a",
  "fa6b8dda9037f8284a659627005ad32dbb81e22b102c1d3d8a9bab0893ce2ab7"
]`,
        },
      },
    },
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-block-transactions',
    title: 'GET Block Transactions',
    description: {
      default:
        'Returns a list of transactions in the block (up to 25 transactions beginning at <code>start_index</code>). Transactions returned here do not have the <code>status</code> field, since all the transactions share the same block and confirmation status.',
    },
    urlString: '/block/:hash/txs[/:start_index]',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/block/%{1}/txs`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const hash = '%{1}';
        const blockTxs = await blocks.getBlockTxs({ hash });

        document.getElementById("result").textContent = JSON.stringify(blockTxs, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const hash = '%{1}';
  const blockTxs = await blocks.getBlockTxs({ hash });
  console.log(blockTxs);
          `,
        },
        codeSampleMainnet: {
          esModule: [
            '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce',
          ],
          commonJS: [
            '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce',
          ],
          curl: [
            '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce',
          ],
          response: `[
  {
    txid: "cfe624ccdd8010cf78dbedd1b25e1ff601b470c4d7d90fa9fc8c1bcc5cdc6e0e",
    version: 1,
    locktime: 0,
    vin: [],
    vout: [],
    size: 102,
    weight: 408,
    fee: 0,
    status: {
      confirmed: true,
      block_height: 363366,
      block_hash: "000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce",
      block_time: 1435766771
    }
  },
  ...
]`,
        },
        codeSampleTestnet: {
          esModule: [
            '000000000000004a3ff1faff12c446f711c650454ff8af7f41d1e8b2564dd74b',
          ],
          commonJS: [
            '000000000000004a3ff1faff12c446f711c650454ff8af7f41d1e8b2564dd74b',
          ],
          curl: [
            '000000000000004a3ff1faff12c446f711c650454ff8af7f41d1e8b2564dd74b',
          ],
          response: `[
  {
    txid: "b5d033f57045b76f2f29df0c2469be0153ecf2514717bccd8d52250b3e7ba781",
    version: 2,
    locktime: 0,
    vin: [],
    vout: [],
    size: 238,
    weight: 844,
    fee: 0,
    status: {
      confirmed: true,
      block_height: 2091173,
      block_hash: "000000000000004a3ff1faff12c446f711c650454ff8af7f41d1e8b2564dd74b",
      block_time: 1630635771
    }
  },
  ...
],`,
        },
        codeSampleSignet: {
          esModule: [
            '0000014b62b53d2550c310208af9d792ab7a9a2487a67d82c06b17b201ee602f',
          ],
          commonJS: [
            '0000004b62b53d2550c300208af9d792ab7a9a2487a67d82c06b17b201ee602f',
          ],
          curl: [
            '0000014b60b53d2550c310200af9d792ab7a9a2487a67d82c06b17b201ee602f',
          ],
          response: `[
  {
    txid: "4220d4fe0ec4beb9313e15fa225fb0bbdf2c17d74b56615e07263aed32d4fdb2",
    version: 1,
    locktime: 0,
    vin: [],
    vout: [],
    size: 250,
    weight: 892,
    fee: 0,
    status: {
      confirmed: true,
      block_height: 53770,
      block_hash: "0000014b62b53d2550c310208af9d792ab7a9a2487a67d82c06b17b201ee602f",
      block_time: 1630635847
    }
  },
  ...
]`,
        },
        codeSampleLiquid: {
          esModule: [
            'dbbf73007879859f2c55b8605751498ad0d2848db0fdedeadcbdc0cf4f02ee13',
            '1',
          ],
          commonJS: [
            'dbbf73007879859f2c55b8605751498ad0d2848db0fdedeadcbdc0cf4f02ee13',
            '1',
          ],
          curl: [
            'dbbf73007879859f2c55b8605751498ad0d2848db0fdedeadcbdc0cf4f02ee13',
            '1',
          ],
          response: `[
  {
    txid: "45abcc4572f519155cd65686c3be9cc744d79d6f36c928b0aa3c989f8ee094be",
    version: 2,
    locktime: 0,
    vin: [],
    vout: [],
    size: 250,
    weight: 877,
    fee: 0,
    status: {
      confirmed: true,
      block_height: 1472142,
      block_hash: "dbbf73007879859f2c55b8605751498ad0d2848db0fdedeadcbdc0cf4f02ee13",
      block_time: 1630635778
    }
  },
  ...
]`,
        },
        codeSampleLiquidTestnet: {
          esModule: [
            'b6b4aeefa220c6a17da116bda666e869b3146967d2479656448a8bce1e799b8f',
            '1',
          ],
          commonJS: [
            'b6b4aeefa220c6a17da116bda666e869b3146967d2479656448a8bce1e799b8f',
            '1',
          ],
          curl: [
            'b6b4aeefa220c6a17da116bda666e869b3146967d2479656448a8bce1e799b8f',
            '1',
          ],
          response: `[
  {
    txid: "95422f140e3d88e6ddaf0625ee523dbf9d38934d67ce32baf6c162d83a08f89f",
    version: 2,
    locktime: 0,
    vin: [],
    vout: [],
    size: 226,
    weight: 781,
    fee: 0,
    status: {
      confirmed: true,
      block_height: 142834,
      block_hash: "b6b4aeefa220c6a17da116bda666e869b3146967d2479656448a8bce1e799b8f",
      block_time: 1640441533
    }
  },
  ...
]`,
        },
      },
    },
  },
  {
    options: { electrsOnly: true },
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-blocks',
    title: 'GET Blocks',
    description: {
      default:
        'Returns details on the past 10 blocks. If <code>:startHeight</code> is specified, the 10 blocks before (and including) <code>:startHeight</code> are returned.',
    },
    urlString: '/blocks[/:startHeight]',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/blocks/%{1}`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const getBlocks = await blocks.getBlocks({ startHeight: %{1} });

        document.getElementById("result").textContent = JSON.stringify(getBlocks, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const getBlocks = await blocks.getBlocks({ startHeight: %{1} });
  console.log(getBlocks);
          `,
        },
        codeSampleMainnet: {
          esModule: ['730000'],
          commonJS: ['730000'],
          curl: ['730000'],
          response: `[
  {
    "id": "0000000000000000000384f28cb3b9cf4377a39cfd6c29ae9466951de38c0529",
    "height": 730000,
    "version": 536870912,
    "timestamp": 1648829449,
    "tx_count": 1627,
    "size": 1210916,
    "merkle_root": "efa344bcd6c0607f93b709515dd6dc5496178112d680338ebea459e3de7b4fbc",
    "previousblockhash": "00000000000000000008b6f6fb83f8d74512ef1e0af29e642dd20daddd7d318f",
    "mediantime": 1648827418,
    "nonce": 3580664066,
    "bits": 386521239,
    "difficulty": 28587155782195.1
  },
  {
    "id": "00000000000000000008b6f6fb83f8d74512ef1e0af29e642dd20daddd7d318f",
    "height": 729999,
    "version": 793796608,
    "timestamp": 1648828946,
    "tx_count": 2574,
    "size": 1481957,
    "merkle_root": "d84f9cc1823bd069c505061b1f6faabd809d67ab5354e9f6234312dc4bdb1ecf",
    "previousblockhash": "000000000000000000071e6c86c2175aa86817cae2a77acd95372b55c1103d89",
    "mediantime": 1648827210,
    "nonce": 3477019455,
    "bits": 386521239,
    "difficulty": 28587155782195.1
  },
  ...
]`,
        },
        codeSampleTestnet: {
          esModule: ['2091187'],
          commonJS: ['2091187'],
          curl: ['2091187'],
          response: `[
  {
    "id": "00000000000000533f63df886281a9fd74da163e84a21445153ff480e5f57970",
    "height": 2091187,
    "version": 545259520,
    "timestamp": 1630641890,
    "tx_count": 26,
    "size": 8390,
    "merkle_root": "4d6df12a4af11bb928c7b2930e0a4d2c3e268c6dc6a07462943ad1c4b6b96468",
    "previousblockhash": "0000000000000079103da7d296e1480295df795b7379e7dffd27743e214b0b32",
    "mediantime": 1630639627,
    "nonce": 309403673,
    "bits": 436273151,
    "difficulty": 16777216
  },
  {
    "id": "0000000000000079103da7d296e1480295df795b7379e7dffd27743e214b0b32",
    "height": 2091186,
    "version": 541065216,
    "timestamp": 1630641655,
    "tx_count": 43,
    "size": 11427,
    "merkle_root": "c70fa944f2863dc0828ee93ec0407bb8473e3b9bb94854ffd3fa1ccb9855d76a",
    "previousblockhash": "00000000000000f015cb6ce3c007b56a053c4b3c3c86a36130e63310da787a30",
    "mediantime": 1630639598,
    "nonce": 2671302918,
    "bits": 436273151,
    "difficulty": 16777216
  },
  ...
]`,
        },
        codeSampleSignet: {
          esModule: ['53783'],
          commonJS: ['53783'],
          curl: ['53783'],
          response: `[
  {
    "id": "0000010eeacb878340bae34af4e13551413d76a172ec302f7e50b62cb45374f2",
    "height": 53783,
    "version": 536870912,
    "timestamp": 1630641504,
    "tx_count": 1,
    "size": 343,
    "merkle_root": "3063ff3802c920eea68bdc9303957f3e7bfd0a03c93547fd7dad14b77a07d4e8",
    "previousblockhash": "00000109a7ea774fcc2d173f9a1da9595a47ff401dac67ca9edea149954210fa",
    "mediantime": 1630638966,
    "nonce": 11753379,
    "bits": 503404179,
    "difficulty": 0.00291903093250778
  },
  {
    "id": "00000109a7ea774fcc2d173f9a1da9595a47ff401dac67ca9edea149954210fa",
    "height": 53782,
    "version": 536870912,
    "timestamp": 1630640959,
    "tx_count": 10,
    "size": 1837,
    "merkle_root": "888cf13ad83ba4c9d44dee7984a1dafee6c78d329178c51bf0ffe61d98df40f3",
    "previousblockhash": "000001508377eba43e83abb169ee1454daed14697267b9baf970b3fd556191e3",
    "mediantime": 1630638721,
    "nonce": 1074604,
    "bits": 503404179,
    "difficulty": 0.00291903093250778
  },
  ...
]`,
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      },
    },
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-blocks-v1',
    title: 'GET Blocks (v1)',
    description: {
      default:
        "Returns details on the past 15 blocks from Mempool's Node.js backend. Includes fee and mining details in an <code>extras</code> field. If <code>:startHeight</code> is specified, the past 15 blocks before (and including) <code>:startHeight</code> are returned.",
    },
    urlString: '/v1/blocks[/:startHeight]',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/blocks/%{1}`,
          commonJS: `
        const { %{0}: { blocks } } = mempoolJS();

        const getBlocks = await blocks.getBlocks({ startHeight: %{1} });

        document.getElementById("result").textContent = JSON.stringify(getBlocks, undefined, 2);
        `,
          esModule: `
  const { %{0}: { blocks } } = mempoolJS();

  const getBlocks = await blocks.getBlocks({ startHeight: %{1} });
  console.log(getBlocks);
          `,
        },
        codeSampleMainnet: {
          esModule: ['730000'],
          commonJS: ['730000'],
          curl: ['730000'],
          response: `[
  {
    "id": "0000000000000000000384f28cb3b9cf4377a39cfd6c29ae9466951de38c0529",
    "height": 730000,
    "version": 536870912,
    "timestamp": 1648829449,
    "bits": 386521239,
    "nonce": 3580664066,
    "difficulty": 28587155782195.1,
    "merkle_root": "efa344bcd6c0607f93b709515dd6dc5496178112d680338ebea459e3de7b4fbc",
    "tx_count": 1627,
    "size": 1210916,
    "previousblockhash": "00000000000000000008b6f6fb83f8d74512ef1e0af29e642dd20daddd7d318f",
    "mediantime": 1648827418,
    "extras": {
      "totalFees": 16321983,
      "medianFee": 11,
      "feeRange": [1, 11, 11, 11, 18, 21, 660],
      "reward": 641321983,
      "pool": {
        "id": 105,
        "name": "Binance Pool",
        "slug": "binancepool",
        "minerNames": null
      },
      "avgFee": 10038,
      "avgFeeRate": 16,
      "coinbaseRaw": "0390230b1362696e616e63652f383038e0006f02cd583765fabe6d6d686355577affaad03015e732428a927a5d2d842471b350394139616bcb4401d804000000000000001a750000c9ad0000",
      "coinbaseAddress": "1JvXhnHCi6XqcanvrZJ5s2Qiv4tsmm2UMy",
      "coinbaseAddresses": [
        "1JvXhnHCi6XqcanvrZJ5s2Qiv4tsmm2UMy"
      ],
      "coinbaseSignature": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 c499d0604392cc2051d7476056647d1c1bfc3f38 OP_EQUALVERIFY OP_CHECKSIG",
      "coinbaseSignatureAscii": "...",
      "avgTxSize": 744,
      "totalInputs": 6249,
      "totalOutputs": 6768,
      "totalOutputAmt": 1314305994870,
      "medianFeeAmt": 3182,
      "feePercentiles": [313, 2086, 2538, 3182, 5625, 14136, 990660],
      "segwitTotalTxs": 1314,
      "segwitTotalSize": 1031785,
      "segwitTotalWeight": 3277099,
      "header": "000000208f317dddad0dd22d649ef20a1eef1245d7f883fbf6b608000000000000000000bc4f7bdee359a4be8e3380d61281179654dcd65d5109b7937f60c0d6bc44a3ef0924476297d8091702996cd5",
      "utxoSetChange": 519,
      "utxoSetSize": 80390138,
      "totalInputAmt": 1314322316853,
      "virtualSize": 998378.75,
      "firstSeen": null,
      "orphans": [],
      "matchRate": null,
      "expectedFees": null,
      "expectedWeight": null
    }
  },
  ...
]`,
        },
        codeSampleTestnet: {
          esModule: ['2091187'],
          commonJS: ['2091187'],
          curl: ['2091187'],
          response: `[
  {
    "id": "00000000000000533f63df886281a9fd74da163e84a21445153ff480e5f57970",
    "height": 2091187,
    "version": 545259520,
    "timestamp": 1630641890,
    "bits": 436273151,
    "nonce": 309403673,
    "difficulty": 16777216,
    "merkle_root": "4d6df12a4af11bb928c7b2930e0a4d2c3e268c6dc6a07462943ad1c4b6b96468",
    "tx_count": 26,
    "size": 8390,
    "previousblockhash": "0000000000000079103da7d296e1480295df795b7379e7dffd27743e214b0b32",
    "mediantime": 1630639627,
    "extras": {
      "totalFees": 781942,
      "medianFee": 1,
      "feeRange": [1, 1, 1, 1, 5, 56, 5053],
      "reward": 10547567,
      "pool": {
        "id": 0,
        "name": "Unknown",
        "slug": "unknown",
        "minerNames": null
      },
      "avgFee": 31277,
      "avgFeeRate": 143,
      "coinbaseRaw": "03b3e81f3a205468697320626c6f636b20776173206d696e65642077697468206120636172626f6e206e6567617469766520706f77657220736f75726365201209687a2009092009020de601d7986a040000",
      "coinbaseAddress": "2MtzNEqm2D9jcbPJ5mW7Z3AUNwqt3afZH66",
      "coinbaseAddresses": [
        "2MtzNEqm2D9jcbPJ5mW7Z3AUNwqt3afZH66"
      ],
      "coinbaseSignature": "OP_HASH160 OP_PUSHBYTES_20 1320e6542e2146ea486700f4091aa793e7360788 OP_EQUAL",
      "coinbaseSignatureAscii": "...",
      "avgTxSize": 310.04,
      "totalInputs": 33,
      "totalOutputs": 64,
      "totalOutputAmt": 30223143847,
      "medianFeeAmt": null,
      "feePercentiles": null,
      "segwitTotalTxs": 24,
      "segwitTotalSize": 7709,
      "segwitTotalWeight": 20369,
      "header": "00008020320b4b213e7427fddfe779735b79df950248e196d2a73d1079000000000000006864b9b6c4d13a946274a0c66d8c263e2c4d0a0e93b2c728b91bf14a2af16d4de29e3161ffff001a19207112",
      "utxoSetChange": 31,
      "utxoSetSize": 26145554,
      "totalInputAmt": 30223925789,
      "virtualSize": 5746.25,
      "firstSeen": null,
      "orphans": [],
      "matchRate": null,
      "expectedFees": null,
      "expectedWeight": null
    }
  },
  ...
]`,
        },
        codeSampleSignet: {
          esModule: ['53783'],
          commonJS: ['53783'],
          curl: ['53783'],
          response: `[
  {
    "id": "0000010eeacb878340bae34af4e13551413d76a172ec302f7e50b62cb45374f2",
    "height": 53783,
    "version": 536870912,
    "timestamp": 1630641504,
    "bits": 503404179,
    "nonce": 11753379,
    "difficulty": 0.00291903093250778,
    "merkle_root": "3063ff3802c920eea68bdc9303957f3e7bfd0a03c93547fd7dad14b77a07d4e8",
    "tx_count": 1,
    "size": 343,
    "previousblockhash": "00000109a7ea774fcc2d173f9a1da9595a47ff401dac67ca9edea149954210fa",
    "mediantime": 1630638966,
    "extras": {
      "totalFees": 0,
      "medianFee": 0,
      "feeRange": [0, 0, 0, 0, 0, 0, 0],
      "reward": 5000000000,
      "pool": {
        "id": 0,
        "name": "Unknown",
        "slug": "unknown",
        "minerNames": null
      },
      "avgFee": 0,
      "avgFeeRate": 0,
      "coinbaseRaw": "0317d200",
      "coinbaseAddress": "tb1p95clr67qe8s3l27nd2cry22fdhmque3fgze08urhc099pml0rwmqddz08l",
      "coinbaseAddresses": [
        "tb1p95clr67qe8s3l27nd2cry22fdhmque3fgze08urhc099pml0rwmqddz08l"
      ],
      "coinbaseSignature": "OP_PUSHNUM_1 OP_PUSHBYTES_32 2d31f1ebc0c9e11fabd36ab03229496df60e662940b2f3f077c3ca50efef1bb6",
      "coinbaseSignatureAscii": "...",
      "avgTxSize": 0,
      "totalInputs": 0,
      "totalOutputs": 2,
      "totalOutputAmt": 0,
      "medianFeeAmt": null,
      "feePercentiles": null,
      "segwitTotalTxs": 0,
      "segwitTotalSize": 0,
      "segwitTotalWeight": 0,
      "header": "00000020fa10429549a1de9eca67ac1d40ff475a59a91d9a3f172dcc4f77eaa709010000e8d4077ab714ad7dfd4735c9030afd7b3e7f950393dc8ba6ee20c90238ff6330609d31619356011ea357b300",
      "utxoSetChange": 2,
      "utxoSetSize": 303088,
      "totalInputAmt": 0,
      "virtualSize": 316,
      "firstSeen": null,
      "orphans": [],
      "matchRate": null,
      "expectedFees": null,
      "expectedWeight": null
    }
  },
  ...
]`,
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      },
    },
  },
  {
    type: 'endpoint',
    category: 'blocks',
    httpRequestMethod: 'GET',
    fragment: 'get-blocks-bulk',
    title: 'GET Blocks (Bulk)',
    description: {
      default:
        "<p>Returns details on the range of blocks between <code>:minHeight</code> and <code>:maxHeight</code>, inclusive, up to 10 blocks. If <code>:maxHeight</code> is not specified, it defaults to the current tip.</p><p>To return data for more than 10 blocks, consider becoming an <a href='https://explorer.melroy.org/enterprise'>enterprise sponsor</a>.</p>",
    },
    urlString: '/v1/blocks-bulk/:minHeight[/:maxHeight]',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/blocks-bulk/%{1}/%{2}`,
          commonJS: ``,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [100000, 100000],
          response: `[
  {
    "height": 100000,
    "hash": "000000000003ba27aa200b1cecaad478d2b00432346c3f1f3986da1afd33e506",
    "timestamp": 1293623863,
    "median_timestamp": 1293622620,
    "previous_block_hash": "000000000002d01c1fccc21636b607dfd930d31d01c3a62104612a1719011250",
    "difficulty": 14484.1623612254,
    "header": "0100000050120119172a610421a6c3011dd330d9df07b63616c2cc1f1cd00200000000006657a9252aacd5c0b2940996ecff952228c3067cc38d4885efb5a4ac4247e9f337221b4d4c86041b0f2b5710",
    "version": 1,
    "bits": 453281356,
    "nonce": 274148111,
    "size": 957,
    "tx_count": 4,
    "merkle_root": "f3e94742aca4b5ef85488dc37c06c3282295ffec960994b2c0d5ac2a25a95766",
    "reward": 5000000000,
    "total_fee_amt": 0,
    "avg_fee_amt": 0,
    "median_fee_amt": 0,
    "fee_amt_percentiles": {
      "min": 0,
      "perc_10": 0,
      "perc_25": 0,
      "perc_50": 0,
      "perc_75": 0,
      "perc_90": 0,
      "max": 0
    },
    "avg_fee_rate": 0,
    "median_fee_rate": 0,
    "fee_rate_percentiles": {
      "min": 0,
      "perc_10": 0,
      "perc_25": 0,
      "perc_50": 0,
      "perc_75": 0,
      "perc_90": 0,
      "max": 0
    },
    "total_inputs": 3,
    "total_input_amt": 5301000000,
    "total_outputs": 6,
    "total_output_amt": 5301000000,
    "segwit_total_txs": 0,
    "segwit_total_size": 0,
    "segwit_total_weight": 0,
    "avg_tx_size": 185.25,
    "utxoset_change": 3,
    "utxoset_size": 71888,
    "coinbase_raw": "044c86041b020602",
    "coinbase_address": null,
    "coinbase_signature": "OP_PUSHBYTES_65 041b0e8c2567c12536aa13357b79a073dc4444acb83c4ec7a0e2f99dd7457516c5817242da796924ca4e99947d087fedf9ce467cb9f7c6287078f801df276fdf84 OP_CHECKSIG",
    "coinbase_signature_ascii": "\u0004L�\u0004\u001b\u0002\u0006\u0002",
    "pool_slug": "unknown",
    "orphans": []
  }
]`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [100000, 100000],
          response: `[
  {
    "height": 100000,
    "hash": "00000000009e2958c15ff9290d571bf9459e93b19765c6801ddeccadbb160a1e",
    "timestamp": 1376123972,
    "median_timestamp": 1677396660,
    "previous_block_hash": "000000004956cc2edd1a8caa05eacfa3c69f4c490bfc9ace820257834115ab35",
    "difficulty": 271.7576739288896,
    "header": "0200000035ab154183570282ce9afc0b494c9fc6a3cfea05aa8c1add2ecc56490000000038ba3d78e4500a5a7570dbe61960398add4410d278b21cd9708e6d9743f374d544fc055227f1001c29c1ea3b",
    "version": 2,
    "bits": 469823783,
    "nonce": 1005240617,
    "size": 221,
    "tx_count": 1,
    "merkle_root": "d574f343976d8e70d91cb278d21044dd8a396019e6db70755a0a50e4783dba38",
    "reward": 5000000000,
    "total_fee_amt": 0,
    "avg_fee_amt": 0,
    "median_fee_amt": 0,
    "fee_amt_percentiles": {
      "min": 0,
      "perc_10": 0,
      "perc_25": 0,
      "perc_50": 0,
      "perc_75": 0,
      "perc_90": 0,
      "max": 0
    },
    "avg_fee_rate": 0,
    "median_fee_rate": 0,
    "fee_rate_percentiles": {
      "min": 0,
      "perc_10": 0,
      "perc_25": 0,
      "perc_50": 0,
      "perc_75": 0,
      "perc_90": 0,
      "max": 0
    },
    "total_inputs": 0,
    "total_input_amt": null,
    "total_outputs": 1,
    "total_output_amt": 0,
    "segwit_total_txs": 0,
    "segwit_total_size": 0,
    "segwit_total_weight": 0,
    "avg_tx_size": 0,
    "utxoset_change": 1,
    "utxoset_size": null,
    "coinbase_raw": "03a08601000427f1001c046a510100522cfabe6d6d0000000000000000000068692066726f6d20706f6f6c7365727665726aac1eeeed88",
    "coinbase_address": "mtkbaiLiUH3fvGJeSzuN3kUgmJzqinLejJ",
    "coinbase_signature": "OP_DUP OP_HASH160 OP_PUSHBYTES_20 912e2b234f941f30b18afbb4fa46171214bf66c8 OP_EQUALVERIFY OP_CHECKSIG",
    "coinbase_signature_ascii": "\u0003 �\u0001\u0000\u0004'ñ\u0000\u001c\u0004jQ\u0001\u0000R,ú¾mm\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000hi from poolserverj¬\u001eîí�",
    "pool_slug": "unknown",
    "orphans": []
  }
]`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [100000, 100000],
          response: `[
  {
    "height": 100000,
    "hash": "0000008753108390007b3f5c26e5d924191567e147876b84489b0c0cf133a0bf",
    "timestamp": 1658421183,
    "median_timestamp": 1658418056,
    "previous_block_hash": "000000b962a13c3dd3f81917bc8646a0c98224adcd5124026d4fdfcb76a76d30",
    "difficulty": 0.002781447610743506,
    "header": "00000020306da776cbdf4f6d022451cdad2482c9a04686bc1719f8d33d3ca162b90000001367fb15320ebb1932fd589f8f38866b692ca8a4ad6100a4bc732d212916d0efbf7fd9628567011e47662d00",
    "version": 536870912,
    "bits": 503408517,
    "nonce": 2975303,
    "size": 343,
    "tx_count": 1,
    "merkle_root": "efd01629212d73bca40061ada4a82c696b86388f9f58fd3219bb0e3215fb6713",
    "reward": 5000000000,
    "total_fee_amt": 0,
    "avg_fee_amt": 0,
    "median_fee_amt": 0,
    "fee_amt_percentiles": {
      "min": 0,
      "perc_10": 0,
      "perc_25": 0,
      "perc_50": 0,
      "perc_75": 0,
      "perc_90": 0,
      "max": 0
    },
    "avg_fee_rate": 0,
    "median_fee_rate": 0,
    "fee_rate_percentiles": {
      "min": 0,
      "perc_10": 0,
      "perc_25": 0,
      "perc_50": 0,
      "perc_75": 0,
      "perc_90": 0,
      "max": 0
    },
    "total_inputs": 0,
    "total_input_amt": null,
    "total_outputs": 2,
    "total_output_amt": 0,
    "segwit_total_txs": 0,
    "segwit_total_size": 0,
    "segwit_total_weight": 0,
    "avg_tx_size": 0,
    "utxoset_change": 2,
    "utxoset_size": null,
    "coinbase_raw": "03a08601",
    "coinbase_address": "tb1psfjl80vk0yp3agcq6ylueas29rau00mfq90mhejerpgccg33xhasd9gjyd",
    "coinbase_signature": "OP_PUSHNUM_1 OP_PUSHBYTES_32 8265f3bd9679031ea300d13fccf60a28fbc7bf69015fbbe65918518c223135fb",
    "coinbase_signature_ascii": "\u0003 �\u0001",
    "pool_slug": "unknown",
    "orphans": []
  }
]`,
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      },
    },
  },
  {
    type: 'category',
    category: 'mining',
    fragment: 'mining',
    title: 'Mining',
    showConditions: bitcoinNetworks,
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-mining-pools',
    title: 'GET Mining Pools',
    description: {
      default:
        'Returns a list of all known mining pools ordered by blocks found over the specified trailing <code>:timePeriod</code>.</p><p>Leave <code>:timePeriod</code> unspecified to get all available data, or specify one of the following values: ' +
        miningTimeIntervals +
        '.',
    },
    urlString: '/v1/mining/pools[/:timePeriod]',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/pools/%{1}`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`1w`],
          response: `{
  "pools": [
  {
    "poolId": 111,
    "name": "Foundry USA",
    "link": "https://foundrydigital.com/",
    "blockCount": 194,
    "rank": 1,
    "emptyBlocks": 0,
    "slug": "foundryusa"
  },
  {
    "poolId": 36,
    "name": "F2Pool",
    "link": "https://www.f2pool.com/",
    "blockCount": 154,
    "rank": 2,
    "emptyBlocks": 0,
    "slug": "f2pool"
  },
  {
    "poolId": 44,
    "name": "AntPool",
    "link": "https://www.antpool.com/",
    "blockCount": 138,
    "rank": 3,
    "emptyBlocks": 0,
    "slug": "antpool"
  },
  ...
  "blockCount": 1005,
  "lastEstimatedHashrate": 230086716765559200000
}`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`3y`],
          response: `{
  "pools": [
    {
      "poolId": 112,
      "name": "SBI Crypto",
      "link": "https://sbicrypto.com",
      "blockCount": 26243,
      "rank": 2,
      "emptyBlocks": 11272,
      "slug": "sbicrypto"
    },
    {
      "poolId": 8,
      "name": "Huobi.pool",
      "link": "https://www.hpt.com/",
      "blockCount": 12134,
      "rank": 3,
      "emptyBlocks": 6096,
      "slug": "huobipool"
    },
    ...
  ],
  "blockCount": 2226180,
  "lastEstimatedHashrate": 602244182177430.8
}`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`3y`],
          response: `{}`,
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      },
    },
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-mining-pool',
    title: 'GET Mining Pool',
    description: {
      default:
        '<p>Returns details about the mining pool specified by <code>:slug</code>.</p>',
    },
    urlString: '/v1/mining/pool/:slug',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/pool/%{1}`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`slushpool`],
          response: `{
  "pool": {
    "id": 43,
    "name": "SlushPool",
    "link": "https://slushpool.com/",
    "addresses": [
      "1CK6KHY6MHgYvmRQ4PAafKYDrg1ejbH1cE",
      "1AqTMY7kmHZxBuLUR5wJjPFUvqGs23sesr"
    ],
    "regexes": [
      "/slush/"
    ],
    "slug": "slushpool"
  },
  "blockCount": {
    "all": 679,
    "24h": 8,
    "1w": 56
  },
  "blockShare": {
    "all": 0.06015770355275981,
    "24h": 0.05333333333333334,
    "1w": 0.055666003976143144
  },
  "estimatedHashrate": 12448077385930390000,
  "reportedHashrate": null
}`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`binancepool`],
          response: `{
  "pool": {
    "id": 105,
    "name": "Binance Pool",
    "link": "https://pool.binance.com/",
    "addresses": [],
    "regexes": [
      "/Binance/",
      "binance"
    ],
    "slug": "binancepool"
  },
  "blockCount": {
    "all": 2,
    "24h": 1,
    "1w": 1
  },
  "blockShare": {
    "all": 8.984160924290476e-7,
    "24h": 0.004524886877828055,
    "1w": 0.0005089058524173028
  },
  "estimatedHashrate": 2617854550633.5283,
  "reportedHashrate": null
}`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`unknown`],
          response: `{}`,
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      },
    },
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-mining-pool-hashrates',
    title: 'GET Mining Pool Hashrates',
    description: {
      default:
        '<p>Returns average hashrates (and share of total hashrate) of mining pools active in the specified trailing <code>:timePeriod</code>, in descending order of hashrate.</p><p>Leave <code>:timePeriod</code> unspecified to get all available data, or specify any of the following time periods: ' +
        miningTimeIntervals.substr(52) +
        '.</p>',
    },
    urlString: '/v1/mining/hashrate/pools/[:timePeriod]',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/hashrate/pools/%{1}`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`1m`],
          response: `[
  {
    "timestamp": 1650240000,
    "avgHashrate": 38258816322322470000,
    "share": 0.185366,
    "poolName": "Foundry USA"
  },
  {
    "timestamp": 1650240000,
    "avgHashrate": 28996155528497033000,
    "share": 0.140488,
    "poolName": "F2Pool"
  },
  {
    "timestamp": 1650240000,
    "avgHashrate": 29801604293177496000,
    "share": 0.14439,
    "poolName": "AntPool"
  },
  {
    "timestamp": 1650240000,
    "avgHashrate": 21747116646372770000,
    "share": 0.105366,
    "poolName": "Poolin"
  },
  {
    "timestamp": 1650240000,
    "avgHashrate": 26579809234455600000,
    "share": 0.12878,
    "poolName": "Binance Pool"
  },
  {
    "timestamp": 1650240000,
    "avgHashrate": 19934856925841707000,
    "share": 0.0965854,
    "poolName": "ViaBTC"
  },
  {
    "timestamp": 1650240000,
    "avgHashrate": 11679007087866855000,
    "share": 0.0565854,
    "poolName": "SlushPool"
  },
  ...
]`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`1y`],
          response: `[
  {
    "timestamp": 1621814400,
    "avgHashrate": 395655036336662.7,
    "share": 1,
    "poolName": "Unknown"
  },
  {
    "timestamp": 1621814400,
    "avgHashrate": 0,
    "share": 0,
    "poolName": "Binance Pool"
  }
]`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`1w`],
          response: `[
  {
    "timestamp": 1600041600,
    "avgHashrate": 21621.70283633912,
    "share": 1,
    "poolName": "Unknown"
  }
]`,
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      },
    },
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-mining-pool-hashrate',
    title: 'GET Mining Pool Hashrate',
    description: {
      default:
        'Returns all known hashrate data for the mining pool specified by <code>:slug</code>. Hashrate values are weekly averages.',
    },
    urlString: '/v1/mining/pool/:slug/hashrate',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/pool/%{1}/hashrate`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`foundryusa`],
          response: `[
  {
    "timestamp": 1647216000,
    "avgHashrate": 39126788325841880000,
    "share": 0.195312,
    "poolName": "Foundry USA"
  },
  {
    "timestamp": 1647302400,
    "avgHashrate": 42038778612166990000,
    "share": 0.208941,
    "poolName": "Foundry USA"
  },
  {
    "timestamp": 1647820800,
    "avgHashrate": 40677922193000910000,
    "share": 0.196597,
    "poolName": "Foundry USA"
  },
  {
    "timestamp": 1647907200,
    "avgHashrate": 40210989932016525000,
    "share": 0.194707,
    "poolName": "Foundry USA"
  },
  {
    "timestamp": 1648425600,
    "avgHashrate": 39336856807414260000,
    "share": 0.194605,
    "poolName": "Foundry USA"
  },
  {
    "timestamp": 1648512000,
    "avgHashrate": 39391244745360090000,
    "share": 0.193487,
    "poolName": "Foundry USA"
  },
  ...
]`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`kncminer`],
          response: `[
  {
    "timestamp": 1400457600,
    "avgHashrate": 23504290056.20675,
    "share": 0.21875,
    "poolName": "KnCMiner"
  },
  {
    "timestamp": 1401062400,
    "avgHashrate": 22880315827.385838,
    "share": 0.301661,
    "poolName": "KnCMiner"
  },
  {
    "timestamp": 1401667200,
    "avgHashrate": 65314000516.18979,
    "share": 0.774853,
    "poolName": "KnCMiner"
  },
  ...
]`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`unknown`],
          response: `[
  {
    "timestamp": 1600041600,
    "avgHashrate": 21621.70283633912,
    "share": 1,
    "poolName": "Unknown"
  },
  {
    "timestamp": 1600646400,
    "avgHashrate": 23490.65374463165,
    "share": 1,
    "poolName": "Unknown"
  },
  {
    "timestamp": 1601251200,
    "avgHashrate": 22660.62333333333,
    "share": 1,
    "poolName": "Unknown"
  },
  ...
]`,
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      },
    },
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-mining-pool-blocks',
    title: 'GET Mining Pool Blocks',
    description: {
      default:
        "Returns past 10 blocks mined by the specified mining pool (<code>:slug</code>) before the specified <code>:blockHeight</code>. If no <code>:blockHeight</code> is specified, the mining pool's 10 most recent blocks are returned.",
    },
    urlString: '/v1/mining/pool/:slug/blocks/[:blockHeight]',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/pool/%{1}/blocks/%{2}`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`luxor`, `730000`],
          response: `[
  {
    "id": "0000000000000000000572c6eb693c51b728593139079c613c8ea0bc6384e362",
    "timestamp": 1648778242,
    "height": 729910,
    "version": 536895488,
    "bits": 386521239,
    "nonce": 1708647181,
    "difficulty": 28587155782195.14,
    "merkle_root": "729be37fb4b1bff0ca2e4b572e5dc3fb57e5aa57a8a400f8c89d4993d05c204f",
    "tx_count": 1808,
    "size": 1595444,
    "previousblockhash": "00000000000000000000034e117bb9922da36adc6393fabfe9ed97c7bb38998c",
    "extras": {
      "coinbaseRaw": "0336230b315c20506f7765726564206279204c75786f722054656368205c000000002103a960b06341e200000e744596150000000000",
      "medianFee": 1,
      "reward": 628988802,
      "totalFees": 3988802,
      "pool": {
        "id": 4
      }
    }
  },
  {
    "id": "00000000000000000009b6d122d9e2299d2f9cda13274a9f024bebe52ef96a59",
    "timestamp": 1648717740,
    "height": 729820,
    "version": 536870912,
    "bits": 386521239,
    "nonce": 1608169168,
    "difficulty": 28587155782195.14,
    "merkle_root": "4f67e65e8e5e554cd4a8d0f91aa63b5e8686817984eb8188af5fb39958263f5d",
    "tx_count": 1425,
    "size": 729585,
    "previousblockhash": "000000000000000000006441657fa1eea37d68784ebd86dc1cd7f89251130f56",
    "extras": {
      "coinbaseRaw": "03dc220b315c20506f7765726564206279204c75786f722054656368205c00000000e5ae4908ac1f20df00000410c830000000000000",
      "medianFee": 8,
      "reward": 630138805,
      "totalFees": 5138805,
      "pool": {
        "id": 4
      }
    }
  },
  {
    "id": "0000000000000000000796834c03bd3be474bfa895146a58015f5ff325ef50c0",
    "timestamp": 1648653948,
    "height": 729714,
    "version": 549453824,
    "bits": 386547904,
    "nonce": 883606929,
    "difficulty": 27452707696466.39,
    "merkle_root": "45593907e5fa0dee743d2f9194b0923a800cb6313e66221a86bf51df388e012c",
    "tx_count": 1709,
    "size": 1434271,
    "previousblockhash": "000000000000000000000fbfac1a91cdeaf64d689f7673d02613da9d10bfb284",
    "extras": {
      "coinbaseRaw": "0372220b315c20506f7765726564206279204c75786f722054656368205c0000000063349a9b3d185fed000007e7092a000000000000",
      "medianFee": 3,
      "reward": 632350743,
      "totalFees": 7350743,
      "pool": {
        "id": 4
      }
    }
  },
  ...
]`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`bitcoincom`, `2226000`],
          response: `[
  {
    "id": "00000000000000ed428cdb70dfdeb0f3927912131cb96e7b1fe274b1bb1181b2",
    "timestamp": 1582018014,
    "height": 1666150,
    "version": 541065216,
    "bits": 436312585,
    "nonce": 21973352,
    "difficulty": 10474471.99230249,
    "merkle_root": "541456efe41e5730a563475e0c5e2007ee660f1d86d9778bfc164d73c59fd605",
    "tx_count": 382,
    "size": 126201,
    "previousblockhash": "00000000005a0843cc88b09cf6def15e4dc8fe38ab5cf3ad890f34a2df497004",
    "extras": {
      "coinbaseRaw": "03666c19706f6f6c2e626974636f696e2e636f6d010000022583010000000000",
      "medianFee": 1,
      "reward": 39726335,
      "totalFees": 663835,
      "pool": {
        "id": 12
      }
    }
  },
  {
    "id": "00000000000000af90f51e48cb29fdecc62e9961c5e27aca1a4ae8213aae1954",
    "timestamp": 1579793108,
    "height": 1663620,
    "version": 541065216,
    "bits": 436295134,
    "nonce": 1762790676,
    "difficulty": 12563071.03178775,
    "merkle_root": "02d02afea666f08bab5851de541d0570c71a6cd8be358c28952c52d57b7afad4",
    "tx_count": 24,
    "size": 9562,
    "previousblockhash": "000000000000013bbdbc0fef53a5b4b2af02880a6f56f7945de071b71d51123a",
    "extras": {
      "coinbaseRaw": "03846219706f6f6c2e626974636f696e2e636f6d01000065f224020000000000",
      "medianFee": 1,
      "reward": 39547121,
      "totalFees": 484621,
      "pool": {
        "id": 12
      }
    }
  },
  ...
]`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`unknown`, `45000`],
          response: `[
  {
    "id": "00000002440c34e403b2b4e10f390ab105c825dd6285cd6f4050db23cf7e3e46",
    "timestamp": 1625317548,
    "height": 44999,
    "version": 536870912,
    "bits": 503405326,
    "nonce": 14354169,
    "difficulty": 0.002881346304279315,
    "merkle_root": "3324dc134dec1b57cfea574ce2db6e40e51469417b6381a1389e7969386ab42e",
    "tx_count": 14,
    "size": 2971,
    "previousblockhash": "000000d7998f5cf0fb144a400566221574f5f35ebd5d7d9fa803460b6942e237",
    "extras": {
      "coinbaseRaw": "03c7af00",
      "medianFee": 1,
      "reward": 5000002252,
      "totalFees": 2252,
      "pool": {
        "id": 137
      }
    }
  },
  {
    "id": "000000d7998f5cf0fb144a400566221574f5f35ebd5d7d9fa803460b6942e237",
    "timestamp": 1625317223,
    "height": 44998,
    "version": 536870912,
    "bits": 503405326,
    "nonce": 4729165,
    "difficulty": 0.002881346304279315,
    "merkle_root": "55869f5a52d7709fb2c6df91d64841f4551d659948b7537b6cd8f19c68d27115",
    "tx_count": 32,
    "size": 6967,
    "previousblockhash": "000000d6de5b925642a7afed41994947db8612955fbdfd9d1b48f99fc0187385",
    "extras": {
      "coinbaseRaw": "03c6af00",
      "medianFee": 1,
      "reward": 5000005528,
      "totalFees": 5528,
      "pool": {
        "id": 137
      }
    }
  },
  ...
]`,
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      },
    },
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-hashrate',
    title: 'GET Hashrate',
    description: {
      default:
        '<p>Returns network-wide hashrate and difficulty figures over the specified trailing <code>:timePeriod</code>:</p><ul><li>Current (real-time) hashrate</li><li>Current (real-time) difficulty</li><li>Historical daily average hashrates</li><li>Historical difficulty</li></ul><p>Valid values for <code>:timePeriod</code> are ' +
        miningTimeIntervals.substr(52) +
        '. If no time interval is specified, all available data is returned.</p><p>Be sure that <code>INDEXING_BLOCKS_AMOUNT</code> is set properly in your backend config so that enough blocks are indexed to properly serve your request.</p>',
    },
    urlString: '/v1/mining/hashrate/[:timePeriod]',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/hashrate/3d`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "hashrates": [
    {
      "timestamp": 1652486400,
      "avgHashrate": 236499762108771800000
    },
    {
      "timestamp": 1652572800,
      "avgHashrate": 217473276787331300000
    },
    {
      "timestamp": 1652659200,
      "avgHashrate": 189877203506913000000
    }
  ],
  "difficulty": [
    {
      "timestamp": 1652468330,
      "difficulty": 31251101365711.12,
      "height": 736249
    }
  ],
  "currentHashrate": 252033247355212300000,
  "currentDifficulty": 31251101365711.12
}`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`3d`],
          response: `{
  "hashrates": [
    {
      "timestamp": 1652745600,
      "avgHashrate": 385829751259101.6
    },
    {
      "timestamp": 1652832000,
      "avgHashrate": 657984995406460.8
    },
    {
      "timestamp": 1652918400,
      "avgHashrate": 510731129917436.6
    }
  ],
  "difficulty": [
    {
      "timestamp": 1652691434,
      "difficulty": 26119369.29706616,
      "height": 2225402
    }
  ],
  "currentHashrate": 781149965464814.4,
  "currentDifficulty": 55580658.55098472
}`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`3d`],
          response: `{
  "hashrates": [
    {
      "timestamp": 1652745600,
      "avgHashrate": 21304.18163251096
    },
    {
      "timestamp": 1652832000,
      "avgHashrate": 22034.51091213679
    },
    {
      "timestamp": 1652918400,
      "avgHashrate": 20312.75493978447
    }
  ],
  "difficulty": [
    {
      "timestamp": 1652692199,
      "difficulty": 0.002868721424409158,
      "height": 90533
    },
    {
      "timestamp": 1652796655,
      "difficulty": 0.00286032350920122,
      "height": 90720
    }
  ],
  "currentHashrate": 23490.95654668005,
  "currentDifficulty": 0.00286032350920122
}`,
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      },
    },
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-difficulty-adjustments',
    title: 'GET Difficulty Adjustments',
    description: {
      default:
        '<p>Returns the record of difficulty adjustments over the specified trailing <code>:interval</code>:</p><ul><li>Block timestamp</li><li>Block height</li><li>Difficulty</li><li>Difficulty change</li></ul><p>If no time interval is specified, all available data is returned.',
    },
    urlString: '/v1/mining/difficulty-adjustments/[:interval]',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/difficulty-adjustments/1m`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  [
    1703311464,
    822528,
    72006146478567.1,
    1.06983
  ],
  [
    1702180644,
    820512,
    67305906902031.39,
    0.990408
  ],
  [
    1700957763,
    818496,
    67957790298897.88,
    1.0507
  ]
]`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  [
    1703429523,
    2544008,
    105074715.9955905,
    105075000
  ],
  [
    1703426009,
    2544005,
    1,
    0
  ],
  [
    1703422944,
    2544000,
    105074715.9955905,
    105075000
  ],
  ...
]`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  [
    1702402252,
    173376,
    0.002967416960321784,
    1.01893
  ],
  [
    1701214807,
    171360,
    0.002912289751655253,
    0.9652
  ]
]`,
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      },
    },
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-reward-stats',
    title: 'GET Reward Stats',
    description: {
      default:
        'Returns block reward and total transactions confirmed for the past <code>:blockCount</code> blocks.',
    },
    urlString: '/v1/mining/reward-stats/:blockCount',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/reward-stats/%{1}`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`100`],
          response: `{
  "startBlock": 736556,
  "endBlock": 736655,
  "totalReward": "63811748254",
  "totalFee": "1311748254",
  "totalTx": "164216"
}`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`100`],
          response: `{
  "startBlock": 2226086,
  "endBlock": 2226185,
  "totalReward": "513462793",
  "totalFee": "25181593",
  "totalTx": "2366"
}`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`100`],
          response: `{
  "startBlock": 90899,
  "endBlock": 90998,
  "totalReward": "500001245259",
  "totalFee": "1245259",
  "totalTx": "1112"
}`,
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      },
    },
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-block-fees',
    title: 'GET Block Fees',
    description: {
      default:
        '<p>Returns average total fees for blocks in the specified <code>:timePeriod</code>, ordered oldest to newest. <code>:timePeriod</code> can be any of the following: ' +
        miningTimeIntervals +
        '.</p><p>For <code>24h</code> and <code>3d</code> time periods, every block is included and fee amounts are exact (not averages). For the <code>1w</code> time period, fees may be averages depending on how fast blocks were found around a particular timestamp. For other time periods, fees are averages.</p>',
    },
    urlString: '/v1/mining/blocks/fees/:timePeriod',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/blocks/fees/%{1}`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`1w`],
          response: `[
  {
    "avgHeight": 735644,
    "timestamp": 1652119111,
    "avgFees": 24212890
  },
  {
    "avgHeight": 735646,
    "timestamp": 1652120252,
    "avgFees": 21655996
  },
  {
    "avgHeight": 735648,
    "timestamp": 1652121214,
    "avgFees": 20678859
  },
  {
    "avgHeight": 735649,
    "timestamp": 1652121757,
    "avgFees": 21020140
  },
  {
    "avgHeight": 735650,
    "timestamp": 1652122367,
    "avgFees": 23064200
  },
  {
    "avgHeight": 735652,
    "timestamp": 1652122893,
    "avgFees": 17620723
  },
  ...
]`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`1w`],
          response: `[
  {
    "avgHeight": 2224253,
    "timestamp": 1652346420,
    "avgFees": 211686
  },
  {
    "avgHeight": 2224254,
    "timestamp": 1652346850,
    "avgFees": 2565952
  },
  ...
]`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`1w`],
          response: `[
  {
    "avgHeight": 89978,
    "timestamp": 1652346573,
    "avgFees": 1071
  },
  {
    "avgHeight": 89979,
    "timestamp": 1652346970,
    "avgFees": 1224
  },
  ...
]`,
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      },
    },
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-block-rewards',
    title: 'GET Block Rewards',
    description: {
      default:
        '<p>Returns average block rewards for blocks in the specified <code>:timePeriod</code>, ordered oldest to newest. <code>:timePeriod</code> can be any of the following: ' +
        miningTimeIntervals +
        '.</p><p>For <code>24h</code> and <code>3d</code> time periods, every block is included and block rewards are exact (not averages). For the <code>1w</code> time period, block rewards may be averages depending on how fast blocks were found around a particular timestamp. For other time periods, block rewards are averages.</p>',
    },
    urlString: '/v1/mining/blocks/rewards/:timePeriod',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/blocks/rewards/%{1}`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`1d`],
          response: `[
  {
    "avgHeight": 599992,
    "timestamp": 1571438412,
    "avgRewards": 1260530933
  },
  {
    "avgHeight": 600000,
    "timestamp": 1571443398,
    "avgRewards": 1264314538
  },
  {
    "avgHeight": 725441,
    "timestamp": 1646139035,
    "avgRewards": 637067563
  },
  {
    "avgHeight": 725585,
    "timestamp": 1646222444,
    "avgRewards": 646519104
  },
  {
    "avgHeight": 725727,
    "timestamp": 1646308374,
    "avgRewards": 638709605
  },
  ...
]`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`1d`],
          response: `[
  {
    "avgHeight": 12,
    "timestamp": 1296689648,
    "avgRewards": 5000000000
  },
  {
    "avgHeight": 269,
    "timestamp": 1296717674,
    "avgRewards": 5000091820
  },
  ...
]`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`1d`],
          response: `[
  {
    "avgHeight": 183,
    "timestamp": 1598962247,
    "avgRewards": 5000000000
  },
  {
    "avgHeight": 576,
    "timestamp": 1599047892,
    "avgRewards": 5000000000
  },
  ...
]`,
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      },
    },
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-block-feerates',
    title: 'GET Block Feerates',
    description: {
      default:
        'Returns average feerate percentiles for blocks in the specified <code>:timePeriod</code>, ordered oldest to newest. <code>:timePeriod</code> can be any of the following: ' +
        miningTimeIntervals +
        '.</p><p>For <code>24h</code> and <code>3d</code> time periods, every block is included and percentiles are exact (not averages). For the <code>1w</code> time period, percentiles may be averages depending on how fast blocks were found around a particular timestamp. For other time periods, percentiles are averages.',
    },
    urlString: '/v1/mining/blocks/fee-rates/:timePeriod',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/blocks/fee-rates/%{1}`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`1m`],
          response: `[
  {
    "avgHeight": 732152,
    "timestamp": 1650132959,
    "avgFee_0": 1,
    "avgFee_10": 2,
    "avgFee_25": 2,
    "avgFee_50": 3,
    "avgFee_75": 4,
    "avgFee_90": 8,
    "avgFee_100": 393
  },
  {
    "avgHeight": 732158,
    "timestamp": 1650134432,
    "avgFee_0": 1,
    "avgFee_10": 1,
    "avgFee_25": 2,
    "avgFee_50": 4,
    "avgFee_75": 6,
    "avgFee_90": 10,
    "avgFee_100": 240
  },
  {
    "avgHeight": 732161,
    "timestamp": 1650135818,
    "avgFee_0": 1,
    "avgFee_10": 1,
    "avgFee_25": 1,
    "avgFee_50": 2,
    "avgFee_75": 5,
    "avgFee_90": 8,
    "avgFee_100": 251
  },
  ...
]`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`1m`],
          response: `[
  {
    "avgHeight": 2196306,
    "timestamp": 1650360168,
    "avgFee_0": 1,
    "avgFee_10": 1,
    "avgFee_25": 1,
    "avgFee_50": 1,
    "avgFee_75": 2,
    "avgFee_90": 28,
    "avgFee_100": 2644
  },
  {
    "avgHeight": 2196308,
    "timestamp": 1650361209,
    "avgFee_0": 1,
    "avgFee_10": 1,
    "avgFee_25": 1,
    "avgFee_50": 4,
    "avgFee_75": 12,
    "avgFee_90": 65,
    "avgFee_100": 102
  },
  ...
]`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`1m`],
          response: `{
"blockFeeRates": [
  {
    "avgHeight": 86620,
    "timestamp": 1650360010,
    "avgFee_0": 1,
    "avgFee_10": 1,
    "avgFee_25": 1,
    "avgFee_50": 1,
    "avgFee_75": 1,
    "avgFee_90": 1,
    "avgFee_100": 1
  },
  {
    "avgHeight": 86623,
    "timestamp": 1650361330,
    "avgFee_0": 1,
    "avgFee_10": 1,
    "avgFee_25": 1,
    "avgFee_50": 1,
    "avgFee_75": 1,
    "avgFee_90": 1,
    "avgFee_100": 1
  },
  ...
]`,
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      },
    },
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-sizes',
    title: 'GET Block Sizes',
    description: {
      default:
        '<p>Returns average size (bytes) for blocks in the specified <code>:timePeriod</code>, ordered oldest to newest. <code>:timePeriod</code> can be any of the following: ' +
        miningTimeIntervals +
        '.</p><p>For <code>24h</code> and <code>3d</code> time periods, every block is included and figures are exact (not averages). For the <code>1w</code> time period, figures may be averages depending on how fast blocks were found around a particular timestamp. For other time periods, figures are averages.</p>',
    },
    urlString: '/v1/mining/blocks/sizes/:timePeriod',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/blocks/sizes/%{1}`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`3y`],
          response: `{
  "sizes": [
    {
      "avgHeight": 576650,
      "timestamp": 1558212081,
      "avgSize": 1271404
    },
    {
      "avgHeight": 576715,
      "timestamp": 1558246272,
      "avgSize": 1105893
    },
    {
      "avgHeight": 576797,
      "timestamp": 1558289379,
      "avgSize": 1141071
    },
    {
      "avgHeight": 576885,
      "timestamp": 1558330184,
      "avgSize": 1108166
    },
    ...
  ]
}`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`3y`],
          response: `{
  "sizes": [
    {
      "avgHeight": 1517188,
      "timestamp": 1558262730,
      "avgSize": 25089
    },
    {
      "avgHeight": 1517275,
      "timestamp": 1558290933,
      "avgSize": 21679
    },
    ...
  ]
}`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`3y`],
          response: `{
  "sizes": [
    {
      "avgHeight": 83,
      "timestamp": 1598937527,
      "avgSize": 329
    },
    {
      "avgHeight": 266,
      "timestamp": 1598982991,
      "avgSize": 330
    },
    ...
  ]
}`,
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      },
    },
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-block-predictions',
    title: 'GET Block Predictions',
    description: {
      default:
        '<p>Returns average block health in the specified <code>:timePeriod</code>, ordered oldest to newest. <code>:timePeriod</code> can be any of the following: ' +
        miningTimeIntervals +
        '.</p><p>For <code>24h</code> and <code>3d</code> time periods, every block is included and figures are exact (not averages). For the <code>1w</code> time period, figures may be averages depending on how fast blocks were found around a particular timestamp. For other time periods, figures are averages.</p>',
    },
    urlString: ['/v1/mining/blocks/predictions/:timePeriod'],
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/blocks/predictions/%{1}`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`3y`],
          response: `[
  [
    1687247274,
    777625,
    100
  ],
  [
    1687066238,
    788621,
    99.85
  ],
  [
    1687263518,
    795182,
    99.46
  ],
  [
    1687312271,
    795260,
    100
  ],
  ...
]`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`3y`],
          response: `[
  [
    1687246773,
    2429248,
    100
  ],
  [
    1687285500,
    2438380,
    100
  ],
  [
    1687342820,
    2438467,
    100
  ],
  [
    1687372143,
    2438522,
    100
  ],
  ...
]`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`3y`],
          response: `[
  [
    1687246696,
    129639,
    0
  ],
  [
    1687303289,
    148191,
    0
  ],
  [
    1687315093,
    148218,
    0
  ],
  [
    1687368211,
    148312,
    0
  ],
  ...
]`,
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      },
    },
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-block-audit-score',
    title: 'GET Block Audit Score',
    description: {
      default:
        'Returns the block audit score for the specified <code>:blockHash</code>. Available fields: <code>hash</code>, <code>matchRate</code>, <code>expectedFees</code>, and <code>expectedWeight</code>.',
    },
    urlString: ['/v1/mining/blocks/audit/score/:blockHash'],
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/blocks/audit/score/%{1}`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [
            `000000000000000000032535698c5b0c48283b792cf86c1c6e36ff84464de785`,
          ],
          response: `{
  hash: "000000000000000000032535698c5b0c48283b792cf86c1c6e36ff84464de785",
  matchRate: 99.66,
  expectedFees: 12090955,
  expectedWeight: 3991988
}`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [
            `000000000000025a66f30a181e438b9f65ef33cec3014b7a4ff4c7578289cd6e`,
          ],
          response: `{
  hash: "000000000000025a66f30a181e438b9f65ef33cec3014b7a4ff4c7578289cd6e",
  matchRate: 100,
  expectedFees: 579169,
  expectedWeight: 12997
}`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [
            `000000c1491d7d4229d4bf07e0dcaa7e396767b45be388e1174c7439a9490121`,
          ],
          response: `{
  hash: "000000c1491d7d4229d4bf07e0dcaa7e396767b45be388e1174c7439a9490121",
  matchRate: 100,
  expectedFees: 80520,
  expectedWeight: 16487
}`,
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      },
    },
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-blocks-audit-scores',
    title: 'GET Blocks Audit Scores',
    description: {
      default:
        'Returns blocks audit score for the past 16 blocks. If <code>:startHeight</code> is specified, the past 15 blocks before (and including) <code>:startHeight</code> are returned. Available fields: <code>hash</code>, <code>matchRate</code>, <code>expectedFees</code>, and <code>expectedWeight</code>.',
    },
    urlString: ['/v1/mining/blocks/audit/scores/:startHeight'],
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/mining/blocks/audit/scores/%{1}`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [`820000`],
          response: `[
  {
    hash: "000000000000000000034cd3689507da0386d3d1790dd56f2e6945e650e02c74",
    matchRate: 100,
    expectedFees: 225828975,
    expectedWeight: 3991756
  },
  {
    hash: "00000000000000000000b3ad97907e99c54e6b9145a8f77842e59d9c0c8377cf",
    matchRate: 100,
    expectedFees: 295107022,
    expectedWeight: 3991752
  },
  ...
]`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [`2566570`],
          response: `[
  {
    hash: "00000000000002e7e96e7b5ee04a5fbb3ef9575a9f4a99effb32a8a89d9d2f19",
    matchRate: 100,
    expectedFees: 964677,
    expectedWeight: 24959
  },
  {
    hash: "00000000000003bd3962806d0e06d9982eb2e06aeba912687b2bac3668db32aa",
    matchRate: 100,
    expectedFees: 631200,
    expectedWeight: 15516
  },
  ...
]`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [`175504`],
          response: `[
  {
    hash: "00000012d54289925efc151f2e111e0775e80c3b6bb4b0dcd3ff01dec4bbc5d0",
    matchRate: 100,
    expectedFees: 4767,
    expectedWeight: 2524
  },
  {
    hash: "00000031e269cf0b567260b01ae11453175f4598fdb4f1908c5e2f4265b9d93a",
    matchRate: 100,
    expectedFees: 9090,
    expectedWeight: 1851
  },
  ...
]`,
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      },
    },
  },
  {
    type: 'endpoint',
    category: 'mining',
    httpRequestMethod: 'GET',
    fragment: 'get-block-audit-summary',
    title: 'GET Block Audit Summary',
    description: {
      default:
        'Returns the block audit summary for the specified <code>:blockHash</code>. Available fields: <code>height</code>, <code>id</code>, <code>timestamp</code>, <code>template</code>, <code>missingTxs</code>, <code>addedTxs</code>, <code>freshTxs</code>, <code>sigopTxs</code>, <code>matchRate</code>, <code>expectedFees</code>, and <code>expectedWeight</code>.',
    },
    urlString: ['/v1/block/:blockHash/audit-summary'],
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/block/%{1}/audit-summary`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [
            `00000000000000000000f218ceda7a5d9c289040b9c3f05ef9f7c2f4930e0123`,
          ],
          response: `{
  height: 822418,
  id: "00000000000000000000f218ceda7a5d9c289040b9c3f05ef9f7c2f4930e0123",
  timestamp: 1703262962,
  template: [
    {
      txid: "1de119e4fe0fb92378de74a59fec337c39d505bbc0d04d20d151cc3fb7a91bf0",
      fee: 92000,
      size: 140.25,
      value: 354245800,
      rate: 655.9714795008913,
      flags: 1099511631881
    },
    ...
  ],
  missingTxs: [],
  addedTxs: [
    "3036565d1af6c5b14876a255cdf06214aa350e62154d1ce8619c8e933d0526f8",
    "aaa9d8e8f1de712574182a618b4d608f96f39bfc55e296d2e5904561cdef2e77",
    ...
  ],
  freshTxs: [
    "8ede292d8f0319cbe79fff9fd47564cd7f78fad74d7c506d2b157399ff41d904"
  ],
  sigopTxs: [],
  matchRate: 100,
  expectedFees: 169464627,
  expectedWeight: 3991702
}`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [
            `000000000000007cfba94e051326b3546c968a188a7e12e340a78cefc586bfe3`,
          ],
          response: `{
  height: 2566708,
  id: "000000000000007cfba94e051326b3546c968a188a7e12e340a78cefc586bfe3",
  timestamp: 1703684826,
  template: [
    {
      txid: "6556caa3c6bff537f04837a6f7182dd7a253f31a46de4f21dec9584720156d35",
      fee: 109707,
      vsize: 264.75,
      value: 456855,
      rate: 414.37960339943345,
      flags: 9895621445642
    },
    {
      txid: "53b7743b8cfa0108dbcdc7c2f5e661b9d8f56216845a439449d7f9dfc466b147",
      fee: 74640,
      vsize: 215.5,
      value: 19063915,
      rate: 348.5338491295938,
      flags: 1099528491017
    },
    ...
  ],
  missingTxs: [
    "8f2eae756119e43054ce1014a06e81d612113794d8b519e6ff393d7e0023396a",
    "012b44b0fc0fddc549a056c85850f03a83446c843504c588cd5829873b30f5a9",
    ...
  ],
  addedTxs: [],
  freshTxs: [
    "af36a8b88f6c19f997614dfc8a41395190eaf496a49e8db393dacb770999abd5",
    "fdfa272c8fe069573b964ddad605d748d8c737e94dfcd09bddaae0ee0a2445df",
    ...
  ],
  sigopTxs: [],
  matchRate: 86.96,
  expectedFees: 1541639,
  expectedWeight: 26425
}`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [
            `0000008acf5177d07f1d648f4d54f26095936a5d29a0a6145dd75a0415e63c0f`,
          ],
          response: `{
  height: 175519,
  id: "0000008acf5177d07f1d648f4d54f26095936a5d29a0a6145dd75a0415e63c0f",
  timestamp: 1703682844,
  template: [
    {
      txid: "f95b38742c483b81dc4ff49a803bae7625f1596ec5756c944d7586dfe8b38250",
      fee: 3766,
      vsize: 172.25,
      value: 115117171776,
      rate: 21.86357039187228,
      flags: 1099528425481
    },
    {
      txid: "8665c4d05732c930c2037bc0220e4ab9b1b64ce3302363ff7d118827c7347b52",
      fee: 3766,
      vsize: 172.25,
      value: 115116509429,
      rate: 21.86357039187228,
      flags: 1099528425481
    },
    ...
  ],
  missingTxs: [],
  addedTxs: [],
  freshTxs: [],
  sigopTxs: [],
  matchRate: 100,
  expectedFees: 10494,
  expectedWeight: 6582
}`,
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      },
    },
  },
  {
    type: 'category',
    category: 'fees',
    fragment: 'fees',
    title: 'Fees',
    showConditions: bitcoinNetworks,
  },
  {
    type: 'endpoint',
    category: 'fees',
    httpRequestMethod: 'GET',
    fragment: 'get-mempool-blocks-fees',
    title: 'GET Mempool Blocks Fees',
    description: {
      default: 'Returns current mempool as projected blocks.',
    },
    urlString: '/v1/fees/mempool-blocks',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/fees/mempool-blocks`,
          commonJS: `
        const { %{0}: { fees } } = mempoolJS();

        const feesMempoolBlocks = await fees.getFeesMempoolBlocks();

        document.getElementById("result").textContent = JSON.stringify(feesMempoolBlocks, undefined, 2);
        `,
          esModule: `
  const { %{0}: { fees } } = mempoolJS();

  const feesMempoolBlocks = await fees.getFeesMempoolBlocks();
  console.log(feesMempoolBlocks);
          `,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    blockSize: 873046,
    nTx: 863,
    totalFees: 8875608,
    medianFee: 10.79646017699115,
    feeRange: [
      1,
      2.4242424242424243,
      8.107816711590296,
      10.148014440433213,
      11.053311793214863,
      12.041811846689896,
      14.930957683741648,
      302.11480362537765
    ]
  }
]`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    blockSize: 2871,
    nTx: 11,
    totalFees: 3499,
    medianFee: 1.1799410029498525,
    feeRange: [
      1.00374531835206,
      1.00374531835206,
      1.0046860356138707,
      1.1799410029498525,
      1.183431952662722,
      1.3274336283185841,
      1.3995037220843674,
      5.0271041369472185
    ]
  }
]`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    blockSize: 16157,
    nTx: 75,
    totalFees: 13493,
    medianFee: 1.304812834224599,
    feeRange: [
      1.304812834224599,
      1.304812834224599,
      1.304812834224599,
      1.304812834224599,
      1.304812834224599,
      1.304812834224599,
      1.304812834224599,
      1.3123359580052494
    ]
  }
]`,
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    blockSize: 5011,
    nTx: 1,
    totalFees: 288,
    medianFee: 0.1882045417415455,
    feeRange: [
      0.1882045417415455,
      0.1882045417415455,
      0.1882045417415455,
      0.1882045417415455,
      0.1882045417415455,
      0.1882045417415455,
      0.1882045417415455,
      0.1882045417415455
    ]
  }
]`,
        },
        codeSampleLiquidTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    blockSize: 23782,
    nTx: 3,
    totalFees: 2089,
    medianFee: 0.10163043478260869,
    feeRange: [
      0.1,
      0.1,
      0.1,
      0.10163043478260869,
      0.10163043478260869,
      0.11385199240986717,
      0.11385199240986717,
      0.11385199240986717
    ]
  }
]`,
        },
      },
    },
  },
  {
    type: 'endpoint',
    category: 'fees',
    httpRequestMethod: 'GET',
    fragment: 'get-recommended-fees',
    title: 'GET Recommended Fees',
    description: {
      default: 'Returns our currently suggested fees for new transactions.',
    },
    urlString: '/v1/fees/recommended',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/fees/recommended`,
          commonJS: `
        const { %{0}: { fees } } = mempoolJS();

        const feesRecommended = await fees.getFeesRecommended();

        document.getElementById("result").textContent = JSON.stringify(feesRecommended, undefined, 2);
        `,
          esModule: `
  const { %{0}: { fees } } = mempoolJS();

  const feesRecommended = await fees.getFeesRecommended();
  console.log(feesRecommended);
          `,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  fastestFee: 1,
  halfHourFee: 1,
  hourFee: 1,
  economyFee: 1,
  minimumFee: 1
}`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  fastestFee: 1,
  halfHourFee: 1,
  hourFee: 1,
  economyFee: 1,
  minimumFee: 1
}`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  fastestFee: 1,
  halfHourFee: 1,
  hourFee: 1,
  economyFee: 1,
  minimumFee: 1
}`,
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  fastestFee: 0.1,
  halfHourFee: 0.1,
  hourFee: 0.1,
  economyFee: 0.1,
  minimumFee: 0.1
}`,
        },
        codeSampleLiquidTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  fastestFee: 0.1,
  halfHourFee: 0.1,
  hourFee: 0.1,
  economyFee: 0.1,
  minimumFee: 0.1
}`,
        },
      },
    },
  },
  {
    type: 'endpoint',
    category: 'fees',
    httpRequestMethod: 'GET',
    fragment: 'get-recommended-fees-precise',
    title: 'GET Recommended Fees (Precise)',
    description: {
      default:
        'Returns our currently-suggested feerates with up to 3 decimal places, including sub-sat feerates down to 0.1 s/vb.',
    },
    urlString: '/v1/fees/precise',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/fees/precise`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "fastestFee": 2.023,
  "halfHourFee": 1.094,
  "hourFee": 0.502,
  "economyFee": 0.2,
  "minimumFee": 0.1
}`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "fastestFee": 1.5,
  "halfHourFee": 1.25,
  "hourFee": 1,
  "economyFee": 1,
  "minimumFee": 1
}`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "fastestFee": 1.5,
  "halfHourFee": 1.25,
  "hourFee": 1,
  "economyFee": 1,
  "minimumFee": 1
}`,
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "fastestFee": 0.1,
  "halfHourFee": 0.1,
  "hourFee": 0.1,
  "economyFee": 0.1,
  "minimumFee": 0.1
}`,
        },
        codeSampleLiquidTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  "fastestFee": 0.1,
  "halfHourFee": 0.1,
  "hourFee": 0.1,
  "economyFee": 0.1,
  "minimumFee": 0.1
}`,
        },
      },
    },
  },
  {
    type: 'category',
    category: 'mempool',
    fragment: 'mempool',
    title: 'Mempool',
    showConditions: bitcoinNetworks,
  },
  {
    type: 'endpoint',
    category: 'mempool',
    httpRequestMethod: 'GET',
    fragment: 'get-mempool',
    title: 'GET Mempool',
    description: {
      default: 'Returns current mempool backlog statistics.',
    },
    urlString: '/mempool',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/mempool`,
          commonJS: `
        const { %{0}: { mempool } } = mempoolJS();

        const getMempool = await mempool.getMempool();

        document.getElementById("result").textContent = JSON.stringify(getMempool, undefined, 2);
        `,
          esModule: `
  const { %{0}: { mempool } } = mempoolJS();

  const getMempool = await mempool.getMempool();
  console.log(getMempool);
          `,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  count: 3169,
  vsize: 1891542,
  total_fee: 20317481,
  fee_histogram: []
}`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  count: 16,
  vsize: 2692,
  total_fee: 46318,
  fee_histogram: [
    [
      1.0071429,
      2692
    ]
  ]
}`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  count: 58,
  vsize: 8008,
  total_fee: 10407,
  fee_histogram: [
    [
      1,
      8008
    ]
  ]
}`,
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  count: 0,
  vsize: 0,
  total_fee: 0,
  fee_histogram: [ ]
}`,
        },
        codeSampleLiquidTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `{
  count: 3,
  vsize: 20457,
  total_fee: 2089,
  fee_histogram: [
    [
      0.09981343,
      20457
    ]
  ]
}`,
        },
      },
    },
  },
  {
    type: 'endpoint',
    category: 'mempool',
    httpRequestMethod: 'GET',
    fragment: 'get-mempool-transaction-ids',
    title: 'GET Mempool Transaction IDs',
    description: {
      default:
        'Get the full list of txids in the mempool as an array. The order of the txids is arbitrary and does not match bitcoind.',
    },
    urlString: '/mempool/txids',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/mempool/txids`,
          commonJS: `
        const { %{0}: { mempool } } = mempoolJS();

        const getMempoolTxids = await mempool.getMempoolTxids();

        document.getElementById("result").textContent = JSON.stringify(getMempoolTxids, undefined, 2);
        `,
          esModule: `
  const { %{0}: { mempool } } = mempoolJS();

  const getMempoolTxids = await mempool.getMempoolTxids();
  console.log(getMempoolTxids);
          `,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  "65b04c4618999a221e8b66943a17c216172a9c865f49c88b76de81212b24bf01",
  "4a3ebe804f273b4c7a96e63f6b963e812ef7e6e0e8381c2d662715bcf5bfa846",
  "1ef9df26fab649183b591d148011ce809756f9cd9e6be3d383e80808b1929724",
  ...
]`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  "af04a3e8b7bd49217165435e2717b6ed977cde9c0f6f2a5813c4c39eb53748af",
  "d4c4989617e9af40518f7846f98e98e4a187bc29fb95542c9aa469af159c61e4",
  "c4c0630b18e910be0a70ebd5d4897b379168b0f357a6536188a28e38d2cf8b43",
  "c6c9c44ca17ff8c1ebfe27978e57277be6098f0fb5129840370c013fe503db24",
  ...
]`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  "ddd40341cfa1268801407e9ff43da020cab03f8bf1b422239da0652a4496367e",
  "7fe571957cf61c41598e2acb54211be32cd13df2b71b1612af1d860bbfb5ee9f",
  "b7cd3be4de533db392bb5bd8aaedd8b25607514502c60c0c6d54358931a6d95f",
  "7786de8ee4fe0b11410658866800b90e5a798e3721dd6031c6b5094474bd80c1",
  ...
]`,
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  "f3f3acdaa6a823efcbbbbcc607ec4d1c2c40d618135ec09d8ed96e4d9b37db38"
]`,
        },
        codeSampleLiquidTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  "b644716cb1aeb3e6e9fb4258b0b95dfad8b8e4cd1ec8649bf1116a500cc870e5",
  "3ab8bc068ee05c1114647dc5196b3b954b00e5af3b03d470d1ef8a8953737357",
  "dfbe66e6e71e775c9529a822c14286de0ee1066c2760a53552615d05e17006f3"
]`,
        },
      },
    },
  },
  {
    type: 'endpoint',
    category: 'mempool',
    httpRequestMethod: 'GET',
    fragment: 'get-mempool-recent',
    title: 'GET Mempool Recent',
    description: {
      default:
        'Get a list of the last 10 transactions to enter the mempool. Each transaction object contains simplified overview data, with the following fields: <code>txid</code>, <code>fee</code>, <code>vsize</code>, and <code>value</code>.',
    },
    urlString: '/mempool/recent',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/mempool/recent`,
          commonJS: `
        const { %{0}: { mempool } } = mempoolJS();

        const getMempoolRecent = await mempool.getMempoolRecent();

        document.getElementById("result").textContent = JSON.stringify(getMempoolRecent, undefined, 2);
        `,
          esModule: `
  const { %{0}: { mempool } } = mempoolJS();

  const getMempoolRecent = await mempool.getMempoolRecent();
  console.log(getMempoolRecent);
          `,
        },
        codeSampleMainnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    txid: "4b93c138293a7e3dfea6f0a63d944890b5ba571b03cc22d8c66995535e90dce8",
    fee: 18277,
    vsize: 2585,
    value: 4972029
  },
  ...
]`,
        },
        codeSampleTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    txid: "1fc5098fe3378828a890fa5144883cdd1411d9cdbb1af365c20e72503b11dc81",
    fee: 221,
    vsize: 201,
    value: 944960
  },
  ...
]`,
        },
        codeSampleSignet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    txid: "18dcbd5405f65f583ed32db2f86f84510c07c59ac5321bb90cbd3a3f2963c224",
    fee: 183,
    vsize: 140,
    value: 4369990908
  },
  ...
]`,
        },
        codeSampleLiquid: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    txid: "06428bf0f6dc6a55e1d800afcd4697d1cdee4debbfaa7fd782d747a80d051c25",
    fee: 251,
    vsize: 2515
  },
  ...
]`,
        },
        codeSampleLiquidTestnet: {
          esModule: [],
          commonJS: [],
          curl: [],
          response: `[
  {
    txid: "814d9d285970dd55ea5b2f06f5d11fb895a2b78d61defbcd489477441e544f95",
    fee: 376,
    vsize: 3767
  },
  {
    txid: "e09a8b6bc950458bc77183acf4fd566d1cfd8e7373c4869f877b52e3b02ad9b1",
    fee: 138,
    vsize: 1379
  },
  ...
]`,
        },
      },
    },
  },
  {
    type: 'category',
    category: 'transactions',
    fragment: 'transactions',
    title: 'Transactions',
    showConditions: bitcoinNetworks,
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'GET',
    fragment: 'get-transaction',
    title: 'GET Transaction',
    description: {
      default:
        'Returns details about a transaction. Available fields: <code>txid</code>, <code>version</code>, <code>locktime</code>, <code>size</code>, <code>weight</code>, <code>fee</code>, <code>vin</code>, <code>vout</code>, and <code>status</code>.',
    },
    urlString: '/tx/:txid',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const tx = await transactions.getTx({ txid });

        document.getElementById("result").textContent = JSON.stringify(tx, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const tx = await transactions.getTx({ txid });
  console.log(tx);
          `,
        },
        codeSampleMainnet: {
          esModule: [
            '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521',
          ],
          commonJS: [
            '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521',
          ],
          curl: [
            '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521',
          ],
          response: `{
  txid: "15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521",
  version: 1,
  locktime: 0,
  vin: [],
  vout: [],
  size: 884,
  weight: 3536,
  fee: 20000,
  status: {
    confirmed: true,
    block_height: 363348,
    block_hash: "0000000000000000139385d7aa78ffb45469e0c715b8d6ea6cb2ffa98acc7171",
    block_time: 1435754650
  }
}`,
        },
        codeSampleTestnet: {
          esModule: [
            'eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d',
          ],
          commonJS: [
            'eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d',
          ],
          curl: [
            'eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d',
          ],
          response: `{
  txid: "eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d",
  version: 2,
  locktime: 2091198,
  vin: [],
  vout: [],
  size: 222,
  weight: 561,
  fee: 16332,
  status: {
    confirmed: true,
    block_height: 2091199,
    block_hash: "000000000000004d36632fda8180ff16855d606e5515aab0750d9d4fe55fe7d6",
    block_time: 1630648992
  }
}`,
        },
        codeSampleSignet: {
          esModule: [
            'fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025',
          ],
          commonJS: [
            'fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025',
          ],
          curl: [
            'fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025',
          ],
          response: `{
  txid: "fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025",
  version: 2,
  locktime: 0,
  vin: [],
  vout: [],
  size: 99,
  weight: 381,
  fee: 125,
  status: {
    confirmed: true,
    block_height: 53788,
    block_hash: "0000012a49f15fdbec49f647800d26dabc4027ade9739f398f618d167128b225",
    block_time: 1630648988
  }
}`,
        },
        codeSampleLiquid: {
          esModule: [
            `801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a`,
          ],
          commonJS: [
            `801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a`,
          ],
          curl: [
            `801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a`,
          ],
          response: `{
  txid: "801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a",
  version: 2,
  locktime: 1472364,
  vin: [],
  vout: [],
  size: 4599,
  weight: 5325,
  fee: 529,
  status: {
    confirmed: true,
    block_height: 1472366,
    block_hash: "8422f44e62d7349f8c54c3d353290a8edea1532898e6dc832902bf7ef396e7c1",
    block_time: 1630649218
  }
}`,
        },
        codeSampleLiquidTestnet: {
          esModule: [
            `59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4`,
          ],
          commonJS: [
            `59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4`,
          ],
          curl: [
            `59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4`,
          ],
          response: `{
  txid: "59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4",
  version: 2,
  locktime: 168763,
  vin: [],
  vout: [],
  size: 13557,
  weight: 15069,
  fee: 376,
  status: {
    confirmed: true,
    block_height: 168765,
    block_hash: "05a51089255650a16c17b4b3f3977376bc7ebe90a35584578f12916c3eaba59e",
    block_time: 1642000444
  }
}`,
        },
      },
    },
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'GET',
    fragment: 'get-transaction-hex',
    title: 'GET Transaction Hex',
    description: {
      default: 'Returns a transaction serialized as hex.',
    },
    urlString: '/tx/:txid/hex',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}/hex`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const txHex = await transactions.getTxHex({ txid });

        document.getElementById("result").textContent = JSON.stringify(txHex, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const txHex = await transactions.getTxHex({ txid });
  console.log(txHex);
          `,
        },
        codeSampleMainnet: {
          esModule: [
            '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521',
          ],
          commonJS: [
            '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521',
          ],
          curl: [
            '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521',
          ],
          response: `010000000536a007284bd52ee826680a7f43536472f1bcce1e76cd76b826b88c5884eddf1f0c0000006b483045022100bcdf40fb3b5ebfa2c158ac8d1a41c03eb3dba4e180b00e81836bafd56d946efd022005cc40e35022b614275c1e485c409599667cbd41f6e5d78f421cb260a020a24f01210255ea3f53ce3ed1ad2c08dfc23b211b15b852afb819492a9a0f3f99e5747cb5f0ffffffffee08cb90c4e84dd7952b2cfad81ed3b088f5b...`,
        },
        codeSampleTestnet: {
          esModule: [
            'eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d',
          ],
          commonJS: [
            'eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d',
          ],
          curl: [
            'eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d',
          ],
          response: `0200000000010146c398e70cceaf9d8f734e603bc53e4c4c0605ab46cb1b5807a62c90f5aed50d0100000000feffffff023c0fc10c010000001600145033f65b590f2065fe55414213f1d25ab20b6c4f487d1700000000001600144b812d5ef41fc433654d186463d41b458821ff740247304402202438dc18801919baa64eb18f7e925a...`,
        },
        codeSampleSignet: {
          esModule: [
            'fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025',
          ],
          commonJS: [
            'fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025',
          ],
          curl: [
            'fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025',
          ],
          response: `02000000000101b7913f140f19850975352064a7ccfd7e96e1ed9a847c463309839a37c9d01e530000000000ffffffff017d65a61d000000002200204ae81572f06e1b88fd5ced7a1a000945432e83e1551e6f721ee9c00b8cc3326001015100000000`,
        },
        codeSampleLiquid: {
          esModule: [
            `801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a`,
          ],
          commonJS: [
            `801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a`,
          ],
          curl: [
            `801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a`,
          ],
          response: `020000000101730fb6b65e115f4ec15690b3539311becd3ef8d1ed4c2b7e53ec3934b4254f65010000001716001436b178e63ed841263f7b82a97d2e783791394432feffffff020b5ff1f5c8059fc270bdeb196c5f38e3da2de8fd9034c34427b70fa66d2f388efe083745b65e4c6e029b020d74df709c5842737c4d50873ef4ec8e0579a3c41f09130274bf768af8b1c462b1e5b7ffb1bb496a019a0ed090e4ce26283a946542280c6f17a...`,
        },
        codeSampleLiquidTestnet: {
          esModule: [
            `59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4`,
          ],
          commonJS: [
            `59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4`,
          ],
          curl: [
            `59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4`,
          ],
          response: `020000000102fa567669f73a314138aa6dbe74e3935612895df273d20ccbbedbecd44a04d3ce0000000000fdffffff8412fed07b8316dd4304df90af6f20292d3b2950133711c0ee43eb94fe12cc4f0100000000fdffffff040b801035010192095b8d9316f28450e98a85c915994c3f80ecc493adf505d73e9609a51e48bc0f35e34f88c482654d659fa779dcbf0457dc71053f3edcf76bd3667f03821ffcc4fc4ae5c2668685fec678e4...`,
        },
      },
    },
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'GET',
    fragment: 'get-transaction-merkleblock-proof',
    title: 'GET Transaction Merkleblock Proof',
    description: {
      default:
        "Returns a merkle inclusion proof for the transaction using <a href='https://bitcoin.org/en/glossary/merkle-block'>bitcoind's merkleblock</a> format.",
    },
    urlString: '/tx/:txid/merkleblock-proof',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}/merkleblock-proof`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const txMerkleBlockProof = await transactions.getTxMerkleBlockProof({ txid });

        document.getElementById("result").textContent = JSON.stringify(txMerkleBlockProof, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const txMerkleBlockProof = await transactions.getTxMerkleBlockProof({ txid });
  console.log(txMerkleBlockProof);
          `,
        },
        codeSampleMainnet: {
          esModule: [
            '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521',
          ],
          commonJS: [
            '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521',
          ],
          curl: [
            '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521',
          ],
          response: `0300000058f6dd09ac5aea942c01d12e75b351e73f4304cc442741000000000000000000ef0c2fa8517414b742094a020da7eba891b47d660ef66f126ad01e5be99a2fd09ae093558e411618c14240df820700000ce4d15e17594f257b22d1ddf47d07b3b88779a8374fcd515ad883d79726c6027da6abfcbc1341a049b30277d3bf14e4663...`,
        },
        codeSampleTestnet: {
          esModule: [
            'eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d',
          ],
          commonJS: [
            'eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d',
          ],
          curl: [
            'eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d',
          ],
          response: `0000602002bf77bbb098f90f149430c314e71ef4e2671ea5e04a2503e0000000000000000406ffb54f2925360aae81bd3199f456928bbe6ae83a877902da9d9ffb08215da0ba3161ffff001a545a850bb80000000906e0c62f68fdf4865a46889e2e12d66f03cc537225d612aa77b08a38936b4d435d73544598d93174314d75e5833...`,
        },
        codeSampleSignet: {
          esModule: [
            'fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025',
          ],
          commonJS: [
            'fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025',
          ],
          curl: [
            'fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025',
          ],
          response: `00000020d356e0a14120d45653120a7bd53280ffce2aa2ced301682a1f2867687f000000298ef149a1675866dbdde315b22c24c63fd7670fdc5b86b588007fa187fa85089cba31619356011eaedd8800180000000656e9b938241cb350316cd9155167f3bce7370aa1095143c304ef7a44da4984e02550c48f3e01648dd65f5e3e290432c...`,
        },
        codeSampleLiquid: emptyCodeSample,
        codeSampleLiquidTestnet: emptyCodeSample,
      },
    },
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'GET',
    fragment: 'get-transaction-merkle-proof',
    title: 'GET Transaction Merkle Proof',
    description: {
      default:
        "Returns a merkle inclusion proof for the transaction using <a href='https://electrumx.readthedocs.io/en/latest/protocol-methods.html#blockchain-transaction-get-merkle'>Electrum's blockchain.transaction.get_merkle format.",
    },
    urlString: '/tx/:txid/merkle-proof',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}/merkle-proof`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const txMerkleProof = await transactions.getTxMerkleProof({ txid });

        document.getElementById("result").textContent = JSON.stringify(txMerkleProof, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const txMerkleProof = await transactions.getTxMerkleProof({ txid });
  console.log(txMerkleProof);
          `,
        },
        codeSampleMainnet: {
          esModule: [
            '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521',
          ],
          commonJS: [
            '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521',
          ],
          curl: [
            '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521',
          ],
          response: `{
  block_height: 363348,
  merkle: [
    "acf931fe8980c6165b32fe7a8d25f779af7870a638599db1977d5309e24d2478",
    "ee25997c2520236892c6a67402650e6b721899869dcf6715294e98c0b45623f9",
    "790889ac7c0f7727715a7c1f1e8b05b407c4be3bd304f88c8b5b05ed4c0c24b7",
    "facfd99cc4cfe45e66601b37a9637e17fb2a69947b1f8dc3118ed7a50ba7c901",
    "8c871dd0b7915a114f274c354d8b6c12c689b99851edc55d29811449a6792ab7",
    "eb4d9605966b26cfa3bf69b1afebe375d3d6aadaa7f2899d48899b6bd2fd6a43",
    "daa1dc59f22a8601b489fc8a89da78bc35415291c62c185e711b8eef341e6e70",
    "102907c1b95874e2893c6f7f06b45a3d52455d3bb17796e761df75aeda6aa065",
    "baeede9b8e022bb98b63cb765ba5ca3e66e414bfd37702b349a04113bcfcaba6",
    "b6f07be94b55144588b33ff39fb8a08004baa03eb7ff121e1847d715d0da6590",
    "7d02c62697d783d85a51cd4f37a87987b8b3077df4ddd1227b254f59175ed1e4"
  ],
  pos: 1465
}`,
        },
        codeSampleTestnet: {
          esModule: [
            'eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d',
          ],
          commonJS: [
            'eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d',
          ],
          curl: [
            'eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d',
          ],
          response: `{
  block_height: 2091199,
  merkle: [
    "434d6b93388ab077aa12d6257253cc036fd6122e9e88465a86f4fd682fc6e006",
    "bd9af28e56cf6731e78ee1503a65d9cc9b15c148daa474e71e085176f48996ac",
    "605f6f83423ef3b86623927ef2d9dcb0f8d9e40a8132217c2fa0910b84488ec7",
    "10b7ef06ef0756823dbf39dea717be397e7ccb49bbefc5cfc45e6f9d58793baf",
    "19183ceae11796a9b1d0893e0561870bbce4d060c9547b1e91ad8b34eb3d5001",
    "1b16723739522955422b4286b4d8620d2a704b6997e6bbd809d151b8d8d64611",
    "6f8496469b19dd35871684332dfd3fc0205d83d2c58c44ebdae068542bc951f6",
    "e0d2733bd7bce4e5690b71bc8f7cedb1edbc49a5ff85c3678ecdec894ea1c023"
  ],
  pos: 1
}`,
        },
        codeSampleSignet: {
          esModule: [
            'fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025',
          ],
          commonJS: [
            'fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025',
          ],
          curl: [
            'fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025',
          ],
          response: `{
  block_height: 53788,
  merkle: [
    "e08449da447aef04c3435109a10a37e7bcf3675115d96c3150b31c2438b9e956",
    "027699486d6cc71669bbc8168632101ed95266dcd02fa8b757830d570ef54d15",
    "62458b115b3db7e9dafecb37de1fcb985891bc77a323018811b6d0392e3705a6",
    "3a32287eccca335a3dac6aede77855a78faed4060d16bb89517da9816a763cb4",
    "76a86eb801f1884b99389af3cd41a7994679c3f93c53f9fcf0505ab1340b329f"
  ],
  pos: 1
}`,
        },
        codeSampleLiquid: {
          esModule: [
            '801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a',
          ],
          commonJS: [
            '801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a',
          ],
          curl: [
            '801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a',
          ],
          response: `{
  block_height: 1472366,
  merkle: [
    "ce1903e0a8a5e17c6267cf3397d42011611eb26aa7b65fd73b9851b71da3fc66",
    "377158243ad98ae874cc624e39f7da10d7072e2cbb5229c33cc0bee0bfb6eb4e"
  ],
  pos: 1
}`,
        },
        codeSampleLiquidTestnet: {
          esModule: [
            '59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4',
          ],
          commonJS: [
            '59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4',
          ],
          curl: [
            '59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4',
          ],
          response: `{
  block_height: 168765,
  merkle: [
    "1dbe7041197b78f73c0d4a3810c47080c252bc928f041b787acaad3fa76ba7a0"
  ],
  pos: 1
}`,
        },
      },
    },
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'GET',
    fragment: 'get-transaction-outspend',
    title: 'GET Transaction Outspend',
    description: {
      default:
        'Returns the spending status of a transaction output. Available fields: <code>spent</code> (boolean), <code>txid</code> (optional), <code>vin</code> (optional), and <code>status</code> (optional, the status of the spending tx).',
    },
    urlString: '/tx/:txid/outspend/:vout',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}/outspend/%{2}`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const txOutspend = await transactions.getTxOutspend({
          txid,
          vout: %{2},
        });

        document.getElementById("result").textContent = JSON.stringify(txOutspend, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const txOutspend = await transactions.getTxOutspend({
    txid,
    vout: %{2},
  });
  console.log(txOutspend);
          `,
        },
        codeSampleMainnet: {
          esModule: [
            '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521',
            '3',
          ],
          commonJS: [
            '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521',
            '3',
          ],
          curl: [
            '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521',
            '3',
          ],
          response: `{
  spent: true,
  txid: "2a1b8ec06d68096911da82b02806c3848c415b0044a0046850c4a97cbffac7b1",
  vin: 1,
  status: {
    confirmed: true,
    block_height: 363354,
    block_hash: "000000000000000012e6130dec174ca877bf39ead6e3d04a8ba3b0cd683c1661",
    block_time: 1435758032
  }
}`,
        },
        codeSampleTestnet: {
          esModule: [
            'eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d',
            '0',
          ],
          commonJS: [
            'eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d',
            '0',
          ],
          curl: [
            'eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d',
            '0',
          ],
          response: `{
  spent: true,
  txid: "37e867526abb7cde3f64f86f60b42bee1f989aa8514730ae2e741dd05bbc286b",
  vin: 0,
  status: {
    confirmed: true,
    block_height: 2091199,
    block_hash: "000000000000004d36632fda8180ff16855d606e5515aab0750d9d4fe55fe7d6",
    block_time: 1630648992
  }
}`,
        },
        codeSampleSignet: {
          esModule: [
            'fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025',
            '0',
          ],
          commonJS: [
            'fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025',
            '0',
          ],
          curl: [
            'fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025',
            '0',
          ],
          response: `{
  spent: true,
  txid: "ad9cb0f6770219f0a2325d77466d30ff2ddd18b0f7f68b1deb547c4b3b972623",
  vin: 0,
  status: {
    confirmed: true,
    block_height: 53789,
    block_hash: "000000372e6b34e56866b4e4c75a372454e956bc42f6760b1b119bfa5ce58223",
    block_time: 1630649351
  }
}`,
        },
        codeSampleLiquid: {
          esModule: [
            '801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a',
            '0',
          ],
          commonJS: [
            '801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a',
            '0',
          ],
          curl: [
            '801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a',
            '0',
          ],
          response: `{
  spent: true,
  txid: "c02e132181dfc5f65ea16eadf53b346915b9f3937179c49e209b995e57c319c2",
  vin: 0,
  status: {
    confirmed: true,
    block_height: 1472368,
    block_hash: "a07de4ccbb212ea203c455dde477069fb6ed6120fc96c78402fa9d129efa31ff",
    block_time: 1630649338
  }
}`,
        },
        codeSampleLiquidTestnet: {
          esModule: [
            '59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4',
            '0',
          ],
          commonJS: [
            '59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4',
            '0',
          ],
          curl: [
            '59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4',
            '0',
          ],
          response: `{
  spent: true,
  txid: "814d9d285970dd55ea5b2f06f5d11fb895a2b78d61defbcd489477441e544f95",
  vin: 0,
  status: {
    confirmed: true,
    block_height: 168793,
    block_hash: "3b10cdce761c4a2ec3e1239648c7d034922b34608a66f894e2f707307dae6b18",
    block_time: 1642002136
  }
}`,
        },
      },
    },
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'GET',
    fragment: 'get-transaction-outspends',
    title: 'GET Transaction Outspends',
    description: {
      default: 'Returns the spending status of all transaction outputs.',
    },
    urlString: '/tx/:txid/outspends',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}/outspends`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const txOutspends = await transactions.getTxOutspends({ txid });
        document.getElementById("result").textContent = JSON.stringify(txOutspends, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const txOutspends = await transactions.getTxOutspends({ txid });

  console.log(txOutspends);
          `,
        },
        codeSampleMainnet: {
          esModule: [
            '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521',
          ],
          commonJS: [
            '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521',
          ],
          curl: [
            '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521',
          ],
          response: `[
  {
    spent: true,
    txid: "34de8ba520eb846da8831fa47c06eef9b4eb4a2ff6a3271165fd6b9aafc5a20c",
    vin: 12,
    status: {
      confirmed: true,
      block_height: 363349,
      block_hash: "000000000000000012ad81b3ea2cb1c4ba115901bd1b41cd05a6a8d736691322",
      block_time: 1435754897
    }
  },
  ...
]`,
        },
        codeSampleTestnet: {
          esModule: [
            'eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d',
          ],
          commonJS: [
            'eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d',
          ],
          curl: [
            'eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d',
          ],
          response: `[
  {
    spent: true,
    txid: "37e867526abb7cde3f64f86f60b42bee1f989aa8514730ae2e741dd05bbc286b",
    vin: 0,
    status: {
      confirmed: true,
      block_height: 2091199,
      block_hash: "000000000000004d36632fda8180ff16855d606e5515aab0750d9d4fe55fe7d6",
      block_time: 1630648992
    }
  },
  {
    spent: false
  }
]`,
        },
        codeSampleSignet: {
          esModule: [
            'fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025',
          ],
          commonJS: [
            'fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025',
          ],
          curl: [
            'fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025',
          ],
          response: `[
  {
    spent: true,
    txid: "ad9cb0f6770219f0a2325d77466d30ff2ddd18b0f7f68b1deb547c4b3b972623",
    vin: 0,
    status: {
      confirmed: true,
      block_height: 53789,
      block_hash: "000000372e6b34e56866b4e4c75a372454e956bc42f6760b1b119bfa5ce58223",
      block_time: 1630649351
    }
  }
]`,
        },
        codeSampleLiquid: {
          esModule: [
            '801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a',
          ],
          commonJS: [
            '801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a',
          ],
          curl: [
            '801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a',
          ],
          response: `{
  spent: true,
  txid: "c02e132181dfc5f65ea16eadf53b346915b9f3937179c49e209b995e57c319c2",
  vin: 0,
  status: {
    confirmed: true,
    block_height: 1472368,
    block_hash: "a07de4ccbb212ea203c455dde477069fb6ed6120fc96c78402fa9d129efa31ff",
    block_time: 1630649338
  }
}`,
        },
        codeSampleLiquidTestnet: {
          esModule: [
            '59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4',
          ],
          commonJS: [
            '59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4',
          ],
          curl: [
            '59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4',
          ],
          response: `[
  {
    spent: false
  },
  {
    spent: true,
    txid: "814d9d285970dd55ea5b2f06f5d11fb895a2b78d61defbcd489477441e544f95",
    vin: 0,
    status: {
      confirmed: true,
      block_height: 168793,
      block_hash: "3b10cdce761c4a2ec3e1239648c7d034922b34608a66f894e2f707307dae6b18",
      block_time: 1642002136
    }
  },
  {
    spent: false
  },
  {
    spent: false
  }
]`,
        },
      },
    },
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'GET',
    fragment: 'get-transaction-raw',
    title: 'GET Transaction Raw',
    description: {
      default: 'Returns a transaction as binary data.',
    },
    urlString: '/tx/:txid/raw',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}/raw`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const txRaw = await transactions.getTxRaw({ txid });

        document.getElementById("result").textContent = JSON.stringify(txRaw, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const txRaw = await transactions.getTxRaw({ txid });
  console.log(txRaw);
          `,
        },
        codeSampleMainnet: {
          esModule: [
            '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521',
          ],
          commonJS: [
            '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521',
          ],
          curl: [
            '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521',
          ],
          response: ``,
        },
        codeSampleTestnet: {
          esModule: [
            'eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d',
          ],
          commonJS: [
            'eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d',
          ],
          curl: [
            'eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d',
          ],
          response: ``,
        },
        codeSampleSignet: {
          esModule: [
            'fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025',
          ],
          commonJS: [
            'fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025',
          ],
          curl: [
            'fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025',
          ],
          response: ``,
        },
        codeSampleLiquid: {
          esModule: [
            '801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a',
          ],
          commonJS: [
            '801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a',
          ],
          curl: [
            '801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a',
          ],
          response: ``,
        },
        codeSampleLiquidTestnet: {
          esModule: [
            '59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4',
          ],
          commonJS: [
            '59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4',
          ],
          curl: [
            '59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4',
          ],
          response: ``,
        },
      },
    },
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'GET',
    fragment: 'get-transaction-status',
    title: 'GET Transaction Status',
    description: {
      default:
        'Returns the confirmation status of a transaction. Available fields: <code>confirmed</code> (boolean), <code>block_height</code> (optional), and <code>block_hash</code> (optional).',
    },
    urlString: '/tx/:txid/status',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/tx/%{1}/status`,
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txid = '%{1}';
        const txStatus = await transactions.getTxStatus({ txid });

        document.getElementById("result").textContent = JSON.stringify(txStatus, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txid = '%{1}';
  const txStatus = await transactions.getTxStatus({ txid });
  console.log(txStatus);
          `,
        },
        codeSampleMainnet: {
          esModule: [
            '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521',
          ],
          commonJS: [
            '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521',
          ],
          curl: [
            '15e10745f15593a899cef391191bdd3d7c12412cc4696b7bcb669d0feadc8521',
          ],
          response: `{
  confirmed: true,
  block_height: 363348,
  block_hash: "0000000000000000139385d7aa78ffb45469e0c715b8d6ea6cb2ffa98acc7171",
  block_time: 1435754650
}`,
        },
        codeSampleTestnet: {
          esModule: [
            'eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d',
          ],
          commonJS: [
            'eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d',
          ],
          curl: [
            'eefbafa4006e77099db059eebe14687965813283e5754d317431d9984554735d',
          ],
          response: `{
  confirmed: false
}`,
        },
        codeSampleSignet: {
          esModule: [
            'fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025',
          ],
          commonJS: [
            'fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025',
          ],
          curl: [
            'fe80c0c2439d41d301f35570018b4239ca3204293e5e5fd68d64013e8fc45025',
          ],
          response: `{
  confirmed: true,
  block_height: 53788,
  block_hash: "0000012a49f15fdbec49f647800d26dabc4027ade9739f398f618d167128b225",
  block_time: 1630648988
}`,
        },
        codeSampleLiquid: {
          esModule: [
            '801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a',
          ],
          commonJS: [
            '801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a',
          ],
          curl: [
            '801c8cccdfb1cac41f97d290e00e3e608753bb5b8fbc5ba39f3ab6feef13dd4a',
          ],
          response: `{
  confirmed: true,
  block_height: 1472366,
  block_hash: "8422f44e62d7349f8c54c3d353290a8edea1532898e6dc832902bf7ef396e7c1",
  block_time: 1630649218
}`,
        },
        codeSampleLiquidTestnet: {
          esModule: [
            '59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4',
          ],
          commonJS: [
            '59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4',
          ],
          curl: [
            '59dd7a0bce4f3310272ff352402291bc555f141149812d8f573f62e7fdc19cc4',
          ],
          response: `{
  confirmed: true,
  block_height: 168765,
  block_hash: "05a51089255650a16c17b4b3f3977376bc7ebe90a35584578f12916c3eaba59e",
  block_time: 1642000444
}`,
        },
      },
    },
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'GET',
    fragment: 'get-transaction-times',
    title: 'GET Transaction Times',
    description: {
      default:
        'Returns the timestamps when a list of unconfirmed transactions was initially observed in the mempool. If a transaction is not found in the mempool or has been mined, the timestamp will be <code>0</code>.',
    },
    urlString: '/v1/transaction-times',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefaultFalse,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `/api/v1/transaction-times?txId[]=%{1}&txId[]=%{2}`,
          commonJS: ``,
          esModule: ``,
        },
        codeSampleMainnet: {
          curl: [
            '51545ef0ec7f09196e60693b59369a134870985c8a90e5d42655b191de06285e',
            '6086089bd1c56a9c42a39d470cdfa7c12d4b52bf209608b390dfc4943f2d3851',
          ],
          response: `[1703082129,1702325558]`,
        },
        codeSampleTestnet: {
          curl: [
            '25e7a95ebf10ed192ee91741653d8d970ac88f8e0cd6fb14cc6c7145116d3964',
            '1e158327e52acae35de94962e60e53fc70f6b175b0cfc3e2058bed4b895203b4',
          ],
          response: `[1703267563,1703267322]`,
        },
        codeSampleSignet: {
          curl: [
            '8af0c5199acd89621244f2f61107fe5a9c7c7aad54928e8400651d03ca949aeb',
            '08f840f7b0c33c5b0fdadf1666e8a8c206836993d95fc1eeeef39b5ef9de03d0',
          ],
          response: `[1703267652,1703267696]`,
        },
        codeSampleLiquid: {
          curl: [
            '6091498f06a3054f82a0c3e5be0a23030185c658dc3568684b0bccc4e759be11',
            '631212a073aa4ca392e3aeb469d1366ec2ee288988b106e4a6fc8dae8c4d7a9a',
          ],
          response: `[1703267652,1703267696]`,
        },
        codeSampleLiquidTestnet: {
          curl: [
            'fa8d43e47b2c4bbee12fd8bc1c7440028be2da6ac0f1df6ac77c983938c503fb',
            '26b12cd450f8fa8b6a527578db218bf212a60b2d5eb65c168f8eb3be6f5fd991',
          ],
          response: `[1703268185,1703268209]`,
        },
      },
    },
  },
  {
    type: 'endpoint',
    category: 'transactions',
    httpRequestMethod: 'POST',
    fragment: 'post-transaction',
    title: 'POST Transaction',
    description: {
      default:
        'Broadcast a raw transaction to the network. The transaction should be provided as hex in the request body. The <code>txid</code> will be returned on success.',
    },
    urlString: '/api/tx',
    showConditions: bitcoinNetworks,
    showJsExamples: showJsExamplesDefault,
    codeExample: {
      default: {
        codeTemplate: {
          curl: `%{1}" "[[hostname]][[baseNetworkUrl]]/api/tx`, //custom interpolation technique handled in replaceCurlPlaceholder()
          commonJS: `
        const { %{0}: { transactions } } = mempoolJS();

        const txHex = '%{1}';

        const txid = await transactions.postTx({ txHex });

        document.getElementById("result").textContent = JSON.stringify(txid, undefined, 2);
        `,
          esModule: `
  const { %{0}: { transactions } } = mempoolJS();

  const txHex = '%{1}';

  const txid = await transactions.postTx({ txHex });
  console.log(txid);
          `,
        },
        codeSampleMainnet: {
          esModule: [
            '0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000',
          ],
          commonJS: [
            '0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000',
          ],
          curl: [
            '0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000',
          ],
          response: ``,
        },
        codeSampleTestnet: {
          esModule: [
            '0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000',
          ],
          commonJS: [
            '0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000',
          ],
          curl: [
            '0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000',
          ],
          response: ``,
        },
        codeSampleSignet: {
          esModule: [
            '0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000',
          ],
          commonJS: [
            '0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000',
          ],
          curl: [
            '0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000',
          ],
          response: ``,
        },
        codeSampleLiquid: {
          esModule: [
            `0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000`,
          ],
          commonJS: [
            `0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000`,
          ],
          curl: [
            `0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000`,
          ],
          response: ``,
        },
        codeSampleLiquidTestnet: {
          esModule: [
            `0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000`,
          ],
          commonJS: [
            `0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000`,
          ],
          curl: [
            `0200000001fd5b5fcd1cb066c27cfc9fda5428b9be850b81ac440ea51f1ddba2f987189ac1010000008a4730440220686a40e9d2dbffeab4ca1ff66341d06a17806767f12a1fc4f55740a7af24c6b5022049dd3c9a85ac6c51fecd5f4baff7782a518781bbdd94453c8383755e24ba755c01410436d554adf4a3eb03a317c77aa4020a7bba62999df633bba0ea8f83f48b9e01b0861d3b3c796840f982ee6b14c3c4b7ad04fcfcc3774f81bff9aaf52a15751fedfdffffff02416c00000000000017a914bc791b2afdfe1e1b5650864a9297b20d74c61f4787d71d0000000000001976a9140a59837ccd4df25adc31cdad39be6a8d97557ed688ac00000000`,
          ],
          response: ``,
        },
      },
    },
  },
];

export const faqData = [
  {
    type: 'category',
    category: 'basics',
    fragment: 'basics',
    title: 'Basics',
    showConditions: bitcoinNetworks,
  },
  {
    type: 'endpoint',
    category: 'basics',
    showConditions: bitcoinNetworks,
    fragment: 'what-is-a-mempool',
    title: 'What is a mempool?',
  },
  {
    type: 'endpoint',
    category: 'basics',
    showConditions: bitcoinNetworks,
    fragment: 'what-is-a-mempool-explorer',
    title: 'What is a mempool explorer?',
  },
  {
    type: 'endpoint',
    category: 'basics',
    showConditions: bitcoinNetworks,
    fragment: 'what-is-a-blockchain',
    title: 'What is a blockchain?',
  },
  {
    type: 'endpoint',
    category: 'basics',
    showConditions: bitcoinNetworks,
    fragment: 'what-is-a-block-explorer',
    title: 'What is a block explorer?',
  },
  {
    type: 'endpoint',
    category: 'basics',
    showConditions: bitcoinNetworks,
    fragment: 'what-is-mining',
    title: 'What is mining?',
  },
  {
    type: 'endpoint',
    category: 'basics',
    showConditions: bitcoinNetworks,
    fragment: 'what-are-mining-pools',
    title: 'What are mining pools?',
  },
  {
    type: 'endpoint',
    category: 'basics',
    showConditions: bitcoinNetworks,
    fragment: 'what-are-vb-wu',
    title: 'What are virtual bytes (vB) and weight units (WU)?',
  },
  {
    type: 'endpoint',
    category: 'basics',
    showConditions: bitcoinNetworks,
    fragment: 'what-is-svb',
    title: 'What is sat/vB?',
  },
  {
    type: 'category',
    category: 'help',
    fragment: 'help-stuck-transaction',
    title: 'Help! My transaction is stuck',
    showConditions: bitcoinNetworks,
  },
  {
    type: 'endpoint',
    category: 'help',
    showConditions: bitcoinNetworks,
    fragment: 'why-is-transaction-stuck-in-mempool',
    title: "Why isn't my transaction confirming?",
  },
  {
    type: 'endpoint',
    category: 'help',
    showConditions: bitcoinNetworks,
    fragment: 'how-to-get-transaction-confirmed-quickly',
    title: 'How can I get my transaction confirmed more quickly?',
  },
  {
    type: 'endpoint',
    category: 'help',
    showConditions: bitcoinNetworks,
    fragment: 'how-prevent-stuck-transaction',
    title: 'How can I prevent a transaction from getting stuck in the future?',
  },
  {
    type: 'category',
    category: 'using',
    fragment: 'using-this-website',
    title: 'Using this website',
    showConditions: bitcoinNetworks,
  },
  {
    type: 'endpoint',
    category: 'how-to',
    showConditions: bitcoinNetworks,
    fragment: 'looking-up-transactions',
    title: 'How can I look up a transaction?',
  },
  {
    type: 'endpoint',
    category: 'how-to',
    showConditions: bitcoinNetworks,
    fragment: 'looking-up-addresses',
    title: 'How can I look up an address?',
  },
  {
    type: 'endpoint',
    category: 'how-to',
    showConditions: bitcoinNetworks,
    fragment: 'looking-up-blocks',
    title: 'How can I look up a block?',
  },
  {
    type: 'endpoint',
    category: 'how-to',
    showConditions: bitcoinNetworks,
    fragment: 'looking-up-fee-estimates',
    title: 'How can I look up fee estimates?',
  },
  {
    type: 'endpoint',
    category: 'how-to',
    showConditions: bitcoinNetworks,
    fragment: 'looking-up-historical-trends',
    title: 'How can I explore historical trends?',
  },
  {
    type: 'category',
    category: 'advanced',
    fragment: 'advanced',
    title: 'Advanced',
    showConditions: bitcoinNetworks,
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    fragment: 'what-is-full-mempool',
    title: 'What does it mean for the mempool to be "full"?',
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    fragment: 'how-big-is-mempool-used-by-mempool-space',
    title: 'How big is the mempool used by explorer.melroy.org?',
    options: { officialOnly: true },
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    fragment: 'what-is-memory-usage',
    title: 'What is memory usage?',
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    fragment: 'why-empty-blocks',
    title: 'Why are there empty blocks?',
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    fragment: 'why-block-timestamps-dont-always-increase',
    title: "Why don't block timestamps always increase?",
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    fragment: 'why-dont-fee-ranges-match',
    title:
      "Why doesn't the fee range shown for a block match the feerates of transactions within the block?",
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    options: { auditOnly: true },
    fragment: 'how-do-block-audits-work',
    title: 'How do block audits work?',
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    options: { auditOnly: true },
    fragment: 'what-is-block-health',
    title: 'What is block health?',
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    fragment: 'how-do-explorer-goggles-work',
    title: 'How do Explorer Goggles work?',
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    fragment: 'what-are-sigops',
    title: 'What are sigops?',
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    fragment: 'what-is-adjusted-size',
    title: 'What is adjusted size?',
  },
  {
    type: 'endpoint',
    category: 'advanced',
    showConditions: bitcoinNetworks,
    fragment: 'why-do-the-projected-block-fee-ranges-overlap',
    title: 'Why do the projected block fee ranges overlap?',
  },
  {
    type: 'category',
    category: 'self-hosting',
    fragment: 'self-hosting',
    title: 'Self-Hosting',
    showConditions: bitcoinNetworks,
  },
  {
    type: 'endpoint',
    category: 'self-hosting',
    showConditions: bitcoinNetworks,
    fragment: 'who-runs-this-website',
    title: 'Who runs this website?',
  },
  {
    type: 'endpoint',
    category: 'self-hosting',
    showConditions: bitcoinNetworks,
    fragment: 'host-my-own-instance-raspberry-pi',
    title: 'How can I host my own instance on a Raspberry Pi?',
  },
  {
    type: 'endpoint',
    category: 'self-hosting',
    showConditions: bitcoinNetworks,
    fragment: 'host-my-own-instance-server',
    title: 'How can I host a BCH Explorerinstance on my own server?',
  },
  {
    type: 'endpoint',
    category: 'self-hosting',
    showConditions: bitcoinNetworks,
    fragment: 'install-mempool-with-docker',
    title: 'Can I install BCH Explorerusing Docker?',
  },
  {
    type: 'endpoint',
    category: 'self-hosting',
    showConditions: bitcoinNetworks,
    fragment: 'address-lookup-issues',
    title:
      'Why do I get an error for certain address lookups on my BCH Explorerinstance?',
  },
];
