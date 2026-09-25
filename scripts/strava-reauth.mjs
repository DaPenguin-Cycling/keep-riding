/**
 * Mint a Strava refresh token with the scopes this repo needs.
 *
 * Why this exists: a Strava token's scopes are fixed when it is authorised.
 * There is no setting anywhere that widens an existing one — the only way to
 * add `activity:read` is to authorise again and swap the refresh token. The app
 * itself (client id and secret) is unchanged; only STRAVA_REFRESH_TOKEN moves.
 *
 * Run it from the repo root with the app's credentials in the environment:
 *
 *   STRAVA_CLIENT_ID=xxxxx STRAVA_CLIENT_SECRET=yyyyy node scripts/strava-reauth.mjs
 *
 * It prints an authorise URL, waits for the code, and prints the new refresh
 * token. Two things to get right:
 *
 *   1. Open the URL while signed in to Strava AS ANTHONY. The token grants
 *      access to whoever approves it, so approving as anyone else would point
 *      the site at the wrong athlete's rides.
 *
 *   2. After approving, the browser follows the callback and lands on a page
 *      that does not exist — a 404 from the live site. That is fine; nothing is
 *      meant to be there. The part that matters is in the address bar: copy the
 *      value of `code=`, up to the `&`.
 *
 * Then put the printed refresh token into the repo's STRAVA_REFRESH_TOKEN
 * secret (Settings -> Secrets and variables -> Actions) and the next run picks
 * it up. Nothing else changes.
 */

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const clientId = process.env.STRAVA_CLIENT_ID;
const clientSecret = process.env.STRAVA_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error(
    "Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET. Both are on the app's page\n" +
      "at https://www.strava.com/settings/api — the same values already in the\n" +
      "repo's Actions secrets."
  );
  process.exit(1);
}

// read           profile and totals, which is what the mileage already uses
// activity:read  public activities, which is what the per-ride figures need
//
// approval_prompt=force matters: without it Strava can skip the consent screen
// for an already-approved app and hand back a token carrying the OLD scopes,
// which looks like success and then fails the same way at the activities call.
const scope = "read,activity:read";

// Strava checks this against the Authorization Callback Domain on the app's
// settings page and rejects anything else outright, so the two have to agree.
// The app is set to dapenguincycling.com; if that field is ever changed, pass
// the new value as STRAVA_CALLBACK_DOMAIN rather than editing this.
//
// It only matters here. The daily Action authenticates with the refresh grant,
// which never sends a redirect_uri, so nothing in normal operation depends on
// this field.
const callbackDomain = process.env.STRAVA_CALLBACK_DOMAIN || "dapenguincycling.com";
const scheme = callbackDomain.startsWith("localhost") ? "http" : "https";
const redirectUri = `${scheme}://${callbackDomain}/exchange_token`;

const authUrl =
  `https://www.strava.com/oauth/authorize` +
  `?client_id=${encodeURIComponent(clientId)}` +
  `&response_type=code` +
  `&redirect_uri=${encodeURIComponent(redirectUri)}` +
  `&approval_prompt=force` +
  `&scope=${encodeURIComponent(scope)}`;

console.log("\n1. Sign in to Strava as Anthony, then open:\n");
console.log(authUrl);
console.log(`\n2. Approve. The browser lands on ${redirectUri}, which 404s.`);
console.log("   That is expected — nothing is meant to be there.");
console.log("3. Copy the `code=` value out of the address bar (stop at the `&`).\n");

const rl = createInterface({ input: stdin, output: stdout });
const code = (await rl.question("Paste the code here: ")).trim();
rl.close();

if (!code) {
  console.error("No code given.");
  process.exit(1);
}

const res = await fetch("https://www.strava.com/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
  }),
});

if (!res.ok) {
  const body = await res.text();
  console.error(`\nExchange failed: ${res.status} ${body}`);
  if (body.includes("redirect_uri") || body.includes("invalid")) {
    console.error(
      `\nIf it is complaining about the redirect, ${callbackDomain} does not match the\n` +
        `Authorization Callback Domain on https://www.strava.com/settings/api.\n` +
        `Set STRAVA_CALLBACK_DOMAIN to whatever that page says and run this again.`
    );
  }
  console.error("A code is single-use and expires quickly — authorise again for a fresh one.");
  process.exit(1);
}

const token = await res.json();
const granted = token.scope || "(not reported)";

console.log(`\nAthlete:  ${token.athlete?.firstname ?? "?"} ${token.athlete?.lastname ?? ""} (id ${token.athlete?.id ?? "?"})`);
console.log(`Scopes:   ${granted}`);

if (!String(granted).includes("activity:read")) {
  console.error(
    "\nThis token does NOT carry activity:read, so per-ride figures will still be\n" +
      "skipped. That usually means the consent screen was skipped — authorise\n" +
      "again and check `activity:read` is ticked before approving."
  );
  process.exit(1);
}

console.log(`\nNew refresh token:\n\n  ${token.refresh_token}\n`);
console.log("Put that in the repo's STRAVA_REFRESH_TOKEN secret. Nothing else changes.");
