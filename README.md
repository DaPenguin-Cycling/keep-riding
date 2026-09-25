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
css/site.css             our CSS; everything else in css/ is Webflow's export
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
| `contact.email` | The email address shown on Contact |
| `baseurl` | `""` for the custom domain; `"/keep-riding"` for the github.io URL |

### The contact form

The old markup was a Webflow form. Webflow forms only collect submissions on
Webflow's own hosting — on GitHub Pages they post nowhere, so that form was a
button that did nothing. It is now driven by `forms.endpoint`: while that is
blank the Contact page leads with the email address instead. Paste an endpoint
from a form handler (Formspree, Basin, Getform, …) into `forms.endpoint` and the
full form renders and works. Nothing else needs to change.

### The Strava link

Normally nothing to do. `scripts/update-strava-stats.mjs` already calls
`/api/v3/athlete` to get the athlete id it needs for the stats request, so it
also records the public profile URL in `_data/stats.json`. The footer and the
Contact page fall back to that, so the Strava link appears on its own after the
next daily run. Set `social.strava` only to override it with something else.

TikTok is not on the site. To add it later: put the URL in `_config.yml` under
`social`, then copy the Facebook `{%- if ... %}` block in `_includes/footer.html`
and in `contact.html`.

## Mileage

`_data/stats.json` holds year-to-date miles. `.github/workflows/update-strava-stats.yml`
runs daily, calls the Strava API via `scripts/update-strava-stats.mjs`, and commits
the file if it changed. That commit triggers a Pages rebuild, so the number on the
home page is baked into the HTML at build time — no JavaScript, no loading flicker.

Needs repo secrets `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REFRESH_TOKEN`.
