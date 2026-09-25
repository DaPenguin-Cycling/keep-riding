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

  // The athlete response is already in hand for the stats call, so record the
  // public profile URL too. That lets the site link to Strava without anyone
  // having to look the handle up by hand.
  const output = {
    ytdMiles,
    athleteId: athlete.id,
    stravaUrl: `https://www.strava.com/athletes/${athlete.id}`,
    updatedAt: new Date().toISOString(),
  };

  await writeFile("_data/stats.json", JSON.stringify(output, null, 2) + "\n");
  console.log("Wrote _data/stats.json:", output);

  await writeRideStats(accessToken);
}

/**
 * Per-ride figures for the cards on the Rides page.
 *
 * Writes every ride-type activity of the current year to _data/ride_stats.json,
 * keyed by local date, with several activities on one date summed. The site
 * looks each ride's `dates` up in here, which keeps the matching in the
 * template and means this script never has to read the rides file.
 *
 * Deliberately non-fatal: this needs the `activity:read` scope, which the older
 * refresh tokens for this app were not issued with. If it is missing, the
 * mileage above has already been written and should not be lost over it, so
 * this logs what happened, leaves any existing ride_stats.json alone, and
 * returns.
 */
async function writeRideStats(accessToken) {
  const year = new Date().getUTCFullYear();
  const after = Math.floor(Date.UTC(year, 0, 1) / 1000);
  const before = Math.floor(Date.UTC(year + 1, 0, 1) / 1000);

  const activities = [];
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${after}&before=${before}&per_page=200&page=${page}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (res.status === 401 || res.status === 403) {
      console.warn(
        `Skipping per-ride figures: ${res.status} from /athlete/activities. ` +
          `This needs the 'activity:read' scope — reauthorise the app and ` +
          `refresh STRAVA_REFRESH_TOKEN to enable it. ` +
          `Year-to-date mileage was still written.`
      );
      return;
    }
    if (!res.ok) {
      console.warn(
        `Skipping per-ride figures: ${res.status} ${await res.text()}`
      );
      return;
    }

    const batch = await res.json();
    activities.push(...batch);
    if (batch.length < 200) break;
  }

  const byDate = {};
  for (const a of activities) {
    if (a.type !== "Ride" && a.sport_type !== "Ride" && a.sport_type !== "GravelRide") continue;
    // start_date_local is the athlete's own clock, which is what the ride dates
    // on the site are written in. Using the UTC field would slide an early or
    // late ride onto the wrong day.
    const date = String(a.start_date_local).slice(0, 10);
    const entry = (byDate[date] ??= {
      activityIds: [],
      distanceMeters: 0,
      elevationMeters: 0,
      movingSeconds: 0,
      elapsedSeconds: 0,
    });
    entry.activityIds.push(a.id);
    entry.distanceMeters += a.distance ?? 0;
    entry.elevationMeters += a.total_elevation_gain ?? 0;
    entry.movingSeconds += a.moving_time ?? 0;
    entry.elapsedSeconds += a.elapsed_time ?? 0;
  }

  const dates = {};
  for (const [date, e] of Object.entries(byDate)) {
    dates[date] = {
      distanceMi: Math.round((e.distanceMeters / 1609.344) * 100) / 100,
      elevationFt: Math.round(e.elevationMeters * 3.28084),
      movingSeconds: e.movingSeconds,
      // Elapsed is what Strava headlines on an activity, so it is what the
      // card shows; moving time is kept in case it is ever the better figure.
      elapsedSeconds: e.elapsedSeconds,
      // Only link when the day is a single activity; pointing a combined
      // figure at one of several rides would misrepresent it.
      url:
        e.activityIds.length === 1
          ? `https://www.strava.com/activities/${e.activityIds[0]}`
          : null,
    };
  }

  const out = { updatedAt: new Date().toISOString(), dates };
  await writeFile("_data/ride_stats.json", JSON.stringify(out, null, 2) + "\n");
  console.log(
    `Wrote _data/ride_stats.json: ${Object.keys(dates).length} dates from ${activities.length} activities`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
