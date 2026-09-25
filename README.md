# keep-riding — DaPenguin

Anthony Brown's cycling site. Static site, built by GitHub Pages.

- **Live:** https://dapenguincycling.com
- **Deploy:** GitHub Pages, legacy build, from `main` at `/`. Push to `main` publishes.

## How it is built

GitHub Pages already runs Jekyll on this repo, so the shared chrome lives in
Jekyll layouts and includes instead of being copy-pasted into every page.

```
_config.yml              site settings + the real URLs the pages link to
_layouts/default.html    the page shell: <head>, nav, footer, scripts
_includes/nav.html       global navigation
_includes/footer.html    global footer
_data/stats.json         Strava year-to-date mileage, written by a GitHub Action
_data/rides.yml          the rides listed on Rides, and the home "Latest ride"
_data/videos.yml         the clips in the Video section of Photos & Video
videos/                  the clips themselves, plus a poster image for each
css/site.css             our CSS; everything else in css/ is Webflow's export
js/nav.js                mobile menu toggle
js/contact-form.js       contact form submission (loads only on Contact)
```

Page files (`index.html`, `event.html`, `portfolio.html`, `about.html`,
`work-with-me.html`, `contact.html`) hold only their own content plus a front
matter block naming the layout, the `<title>`, the meta description, and which
nav item to highlight.

Do not hand-edit `css/normalize.css`, `css/webflow.css` or
`css/dapenguin.webflow.css` — those are Webflow's export and a re-export would
overwrite the changes. Put overrides in `css/site.css`, which loads last.

## Running it locally

```bash
bundle install
bundle exec jekyll serve
```

Then open http://localhost:4000.

If the build fails with `Invalid US-ASCII character`, your shell has no UTF-8
locale. GitHub Pages is unaffected; locally, prefix the command:

```bash
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec jekyll serve
```

## Things that are configuration, not code

These live in `_config.yml`. A blank value makes the link or section disappear
rather than render as a dead link, so it is safe to leave one empty until the
real value is known.

| Key | What it controls |
| --- | --- |
| `social.facebook` | Facebook link in the footer and on Contact |
| `social.strava` | Overrides the Strava link; normally left blank (see below) |
| `forms.endpoint` | Contact form. **Blank, so no form renders**; see below |
| `contact.email` | The email address shown on Contact. Single-sourced — changing it here changes it everywhere |
| `contact.whatsapp_url` | WhatsApp link target; blank it and the row disappears |
| `contact.whatsapp_label` | The text shown for it. The number is not displayed |
| `baseurl` | `""` for the custom domain; `"/keep-riding"` for the github.io URL |

### The contact form

The old markup was a Webflow form. Webflow forms only collect submissions on
Webflow's own hosting — on GitHub Pages they post nowhere, so that form was a
button that did nothing.

It now posts to a **Google Apps Script web app** that emails each submission to
`RECIPIENT`. Free, no third-party account, and no monthly submission cap the way
Formspree's free tier has. **Setup instructions are in the header comment of
`scripts/contact-form.gs`** — about five minutes, one time.

Once deployed, paste the `/exec` URL into `forms.endpoint`. Until then the form
does not render at all and the Contact page leads with the email address, so
there is never a submit button that silently does nothing.

How it behaves:

- `scripts/contact-form.gs` validates, rejects bad input, and sets `replyTo` to
  the sender, so replying in Gmail goes to them.
- A hidden honeypot field catches bots. A tripped honeypot returns success and
  sends nothing, so the bot gets no signal.
- `js/contact-form.js` submits in the background and shows the result inline.
- The form has a real `action` and `method="post"`, so with JavaScript off it
  submits normally and the Apps Script returns its own confirmation page.

If you edit the `.gs` file you must redeploy it as a **new version**, or the live
endpoint keeps running the old code.

### Hiding the phone number

The Contact page shows "Message on WhatsApp" rather than the digits — the number
lives only in the link target. Note that a `wa.me/<number>` URL still contains
the digits, so they are in the page source even though nothing displays them.
That stops casual copying, not a scraper.

To keep the number out of the source entirely, create a free WhatsApp Business
short link (`wa.link/xxxxx`) and put that in `contact.whatsapp_url`. It resolves
to the number without exposing it, and nothing else needs to change.

### The Strava link

Normally nothing to do. `scripts/update-strava-stats.mjs` already calls
`/api/v3/athlete` to get the athlete id it needs for the stats request, so it
also records the public profile URL in `_data/stats.json`. The footer and the
Contact page fall back to that, so the Strava link appears on its own after the
next daily run. Set `social.strava` only to override it with something else.

TikTok is not on the site. To add it later: put the URL in `_config.yml` under
`social`, then copy the Facebook `{%- if ... %}` block in `_includes/footer.html`
and in `contact.html`.

## Adding or changing a ride

Edit `_data/rides.yml` — no HTML, and nothing else to touch. `completed` is
newest first, and the home page's "Latest ride" block reads the first entry, so
adding a ride there updates the Rides page and the home page together and they
cannot drift apart.

A new entry needs `name`, `dates`, `meta` and `body`. Everything else is
optional:

- the Strava figures arrive on their own, matched on `dates`
- a photo is `image` plus its alt and dimensions
- `home_body` is a shorter note for the home card; without one it falls back to
  `body`

To add a photo to a ride, drop the file in `images/` and add `image`,
`image_alt`, `image_w` and `image_h` to that entry (plus `image_srcset` if you
have resized variants). Leave them out and the ride renders as a text card.
Only attach a photo that is genuinely from that ride.

To show logged figures on a ride, add a `strava` block with `distance`,
`elevation` and `time`. Add `url` as well and the row links to the activity —
only do that for an activity that is public, or the link 404s for visitors.
These are typed in by hand: the daily Action fetches year-to-date totals, not
per-activity data, so nothing fills them in automatically.

`upcoming: []` is a valid state — the Rides page then says "Nothing on the board
right now." Add an entry with `name`, `meta` and `body` to list a real event.

## JavaScript

The site runs on two small first-party files and no framework:

- `js/nav.js` — opens and closes the mobile menu.
- `js/contact-form.js` — submits the contact form; loads only on Contact, and
  only when `forms.endpoint` is set.

`js/webflow.js` (217KB) and its jQuery dependency (~89KB) are gone. By the end of
the rewrite webflow.js was only still being loaded to toggle that one menu —
every other Webflow class on the site is styling only. Webflow's WebFont.load
script went too; fonts are a plain stylesheet link now.

`js/nav.js` reuses Webflow's own CSS hook (`[data-nav-menu-open]`), so it needed
no new CSS, and it improves on what was there: the trigger is a real `<button>`
rather than a `<div role="button">`, `aria-expanded` stays accurate, Escape
closes and returns focus, and the menu closes on outside click, on following a
link, and when the viewport grows past the breakpoint.

With JavaScript off the mobile menu cannot be opened. That was equally true
before; the footer carries the same five links, so every page stays reachable.

## If Webflow gets replaced

The plan is to drop the Webflow CSS for Tailwind or plain CSS eventually. What
is here helps, but be clear about how much:

- The chrome lives in three files (`_layouts/default.html`, `_includes/nav.html`,
  `_includes/footer.html`) instead of being duplicated across six pages, so the
  header and footer get restyled once.
- Content is separated from presentation in `_data/rides.yml` and `_config.yml`,
  so rides and links survive a rewrite untouched.
- `css/site.css` is already ours and separate from the Webflow export.

What it does *not* do: the page bodies still carry Webflow class names
(`heading_primary`, `card_body`, `grid_2-col`, …), and those have to be swapped
by hand whichever direction you go. The win is that there are six content files
to work through rather than six content files plus six copies of the chrome.

The JavaScript side of that is already done — see above. What remains is purely
the CSS and the class names in the markup.

## Not built yet

**A blog.** Anthony wants one eventually. Jekyll does this natively — add a
`_posts/` folder with `YYYY-MM-DD-title.md` files, a `post` layout, and an index
page; the nav and footer are single includes, so a "Journal" link is a one-line
addition to each. Deliberately not scaffolded yet: it needs his writing, and an
empty blog or placeholder posts would be worse than no blog. The old nav's
"Blog" link went nowhere, which is why it was removed.

**Ride detail pages.** The "Ride Details" / "See Photos" style CTAs were removed
rather than pointed at pages that do not exist. If these get built, `_data/rides.yml`
is already the right shape to generate them from.

## Adding a video

Drop the encoded `.mp4` and a `.jpg` poster of the same name into `videos/`,
then add an entry to `_data/videos.yml`. Ordered oldest first.

Encode from the master, not from a file already in here:

```bash
ffmpeg -i master.mp4 -vf scale=540:960 -c:v libx264 -crf 27 -preset slow \
  -pix_fmt yuv420p -c:a aac -b:a 96k -movflags +faststart videos/<slug>.mp4
ffmpeg -ss <seconds> -i master.mp4 -frames:v 1 -vf scale=540:960 -q:v 4 videos/<slug>.jpg
```

540x960 is deliberate. The masters are 1080x1920 and run 8-10 Mbps, which is
edit quality, not delivery quality; at the size these play in the grid the
re-encode is indistinguishable and roughly a sixth of the weight. Pick the
poster timestamp by eye — a frame mid-clip usually beats the opening one, which
is often a title card or a fade from black.

Every clip is `preload="none"`, so the page loads eight posters (~430KB) rather
than eight videos (~42MB). Nothing downloads until someone presses play. Keep
that attribute on any clip you add.

## Mileage

`_data/stats.json` holds year-to-date miles. `.github/workflows/update-strava-stats.yml`
runs daily, calls the Strava API via `scripts/update-strava-stats.mjs`, and commits
the file if it changed. That commit triggers a Pages rebuild, so the number on the
home page is baked into the HTML at build time — no JavaScript, no loading flicker.

It also writes `_data/ride_stats.json` — every ride-type activity of the current
year, keyed by date, with multiple activities on one date summed. Each ride in
`_data/rides.yml` carries a `dates` list; the card looks its dates up in there
and shows distance, elevation and time. A multi-day trip sums across its days.

The card links to the activity only when a single activity sits behind the
figures, since pointing a combined total at one of several rides would
misrepresent it.

Needs repo secrets `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REFRESH_TOKEN`.

### Scopes

Per-ride figures need `activity:read`; the mileage alone does not. A Strava
token's scopes are fixed when it is authorised — nothing widens an existing one
— so adding it means minting a new refresh token against the same app:

```bash
STRAVA_CLIENT_ID=xxxxx STRAVA_CLIENT_SECRET=yyyyy node scripts/strava-reauth.mjs
```

Authorise **as Anthony**, paste the code back, and put the printed refresh token
into the `STRAVA_REFRESH_TOKEN` secret. Only that secret changes.

The redirect has to match the Authorization Callback Domain on
<https://www.strava.com/settings/api>; the script assumes `dapenguincycling.com`
and takes `STRAVA_CALLBACK_DOMAIN` to override it. After approving, the browser
lands on a path that does not exist and shows a 404 — that is expected, the code
is in the address bar.

Until then nothing breaks: the Action writes the mileage as usual, logs that it
skipped the per-ride figures, and leaves any existing `ride_stats.json` alone.

### Tokens

The **access token** is short-lived and needs no attention — it is minted fresh
from the refresh token on every run and never stored. An expiry notice from
Strava about one is nothing to act on.

The **refresh token** is the one that matters. Strava can rotate it during a
refresh, invalidating the old one, and an Action cannot write back to the secret
that holds it. So the script stops with a clear error if that happens rather
than letting the next day's run fail for no visible reason. Mint a replacement
with `scripts/strava-reauth.mjs` and update the secret.

This repo is public, which makes its Action logs public too. GitHub masks secret
values it already knows, but not a token that has just been rotated — so the
script never prints one.
