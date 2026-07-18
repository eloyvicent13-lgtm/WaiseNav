/**
 * Sets expo.ios.buildNumber in app.json. Run before `eas build --local` —
 * with cli.appVersionSource "local" in eas.json, EAS reads the build
 * number straight from this file.
 *
 * CI passes the GitHub Actions run number explicitly (always unique and
 * strictly increasing, even across re-runs) so we never need to commit
 * the bumped value back to the repo — every workflow run computes its own
 * build number fresh from `github.run_number`, so it can't collide with a
 * previous one the way a plain "increment what's on disk" approach would
 * (that version silently reused build numbers whenever the bump wasn't
 * pushed back, and Apple rejects duplicate build numbers per version).
 *
 * Local/manual use (no arg): falls back to current+1 for convenience.
 */
const fs = require('fs');
const path = require('path');

const appJsonPath = path.join(__dirname, '..', 'app.json');
const config = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

const explicit = process.argv[2];
const current = parseInt(config.expo.ios?.buildNumber ?? '0', 10) || 0;
const next = explicit ? String(parseInt(explicit, 10)) : String(current + 1);

config.expo.ios = config.expo.ios || {};
config.expo.ios.buildNumber = next;

fs.writeFileSync(appJsonPath, JSON.stringify(config, null, 2) + '\n');
console.log(`iOS build number: ${current} -> ${next}`);
