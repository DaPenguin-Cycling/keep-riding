import { writeFile } from "node:fs/promises";

const clientId = process.env.STRAVA_CLIENT_ID;
const clientSecret = process.env.STRAVA_CLIENT_SECRET;
const refreshToken = process.env.STRAVA_REFRESH_TOKEN;

if (!clientId || !clientSecret || !refreshToken) {
  console.error(
    "Missing STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, or STRAVA_REFRESH_TOKEN env vars."
  );
  process.exit(1);
}

async function main() {
  const tokenRes = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Token refresh failed: ${tokenRes.status} ${await tokenRes.text()}`);
  }
  const { access_token: accessToken } = await tokenRes.json();

  const athleteRes = await fetch("https://www.strava.com/api/v3/athlete", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!athleteRes.ok) {
    throw new Error(`Fetching athlete failed: ${athleteRes.status} ${await athleteRes.text()}`);
  }
  const athlete = await athleteRes.json();

  const statsRes = await fetch(
    `https://www.strava.com/api/v3/athletes/${athlete.id}/stats`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!statsRes.ok) {
    throw new Error(`Fetching stats failed: ${statsRes.status} ${await statsRes.text()}`);
  }
  const stats = await statsRes.json();

  const ytdMeters = stats.ytd_ride_totals?.distance ?? 0;
  const ytdMiles = Math.round(ytdMeters / 1609.344);

  const output = {
    ytdMiles,
    updatedAt: new Date().toISOString(),
  };

  await writeFile("data/stats.json", JSON.stringify(output, null, 2) + "\n");
  console.log("Wrote data/stats.json:", output);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
