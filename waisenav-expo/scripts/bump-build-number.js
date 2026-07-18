/**
 * Increments expo.ios.buildNumber in app.json by 1 (creates it at "1" if
 * missing). Run before `eas build --local` — with cli.appVersionSource
 * "local" in eas.json, EAS reads the build number straight from this
 * file, so bumping it here is enough (no EAS-side version sync needed).
 */
const fs = require('fs');
const path = require('path');

const appJsonPath = path.join(__dirname, '..', 'app.json');
const config = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

const current = parseInt(config.expo.ios?.buildNumber ?? '0', 10) || 0;
const next = String(current + 1);

config.expo.ios = config.expo.ios || {};
config.expo.ios.buildNumber = next;

fs.writeFileSync(appJsonPath, JSON.stringify(config, null, 2) + '\n');
console.log(`iOS build number: ${current} -> ${next}`);
