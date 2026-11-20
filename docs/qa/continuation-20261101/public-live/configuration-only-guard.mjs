import { chromium } from '/workspace/Yautja-hive-warriors/node_modules/playwright/index.mjs';
let networkCalls = 0, launches = 0;
globalThis.fetch = () => { networkCalls++; throw Error('NETWORK_DISABLED_FOR_CONFIG_CHECK'); };
chromium.launch = () => { launches++; throw Error('CHROMIUM_DISABLED_FOR_CONFIG_CHECK'); };
process.on('exit', () => console.log(JSON.stringify({ guard: true, networkCalls, launches })));
