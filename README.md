# Anime Randomizer

Mobile-first SFW anime randomizer with a dark cyberpunk / glassmorphism look.
Plain HTML, CSS and vanilla JavaScript (ES modules), plus two tiny Vercel
serverless functions. No build step, no dependencies.

## Features

- Generate Random Anime / Generate Again
- Image card with series and character name, alt text on every image
- Loading, error and retry states
- Save Favorite (localStorage), with a Favorites section where items can be viewed or removed
- Recently generated history (last 12), with Clear history
- Responsive on phones, tablets and desktop; respects reduced-motion settings

## Project structure

```
anime-randomizer/
├── index.html            Page markup and the thumbnail <template>
├── css/styles.css        Theme and layout
├── js/
│   ├── api.js            API service: endpoint, fetch, timeout, response mapping
│   ├── storage.js        localStorage for favorites and history
│   └── app.js            UI rendering and events
├── api/
│   ├── _config.js        Server-side settings (env vars)
│   ├── random-anime.js   GET /api/random-anime  -> calls the upstream API
│   └── image.js          GET /api/image?src=... -> serves the image over HTTPS
├── vercel.json           Security headers and function limits
├── package.json
├── favicon.svg
└── .env.example
```

## Why the serverless functions?

The anime API runs on plain HTTP (`http://192.46.208.170:7856/...`). Vercel
serves your site over HTTPS, and browsers block HTTP requests and images on
HTTPS pages (mixed content). So the browser calls `/api/random-anime` on your
own domain, the function calls the real API server-side, and images are served
through `/api/image`. This also keeps any API key out of the frontend.

## Deploy to Vercel

**Option A: dashboard**
1. Push this folder to a GitHub repository.
2. In Vercel choose *Add New > Project* and import the repository.
3. Framework Preset: **Other**. Leave build command and output directory empty.
4. Deploy.

**Option B: CLI**
```bash
npm i -g vercel
cd anime-randomizer
vercel          # preview deployment
vercel --prod   # production
```

## Run locally

Opening `index.html` directly will not work (ES modules and the `/api` routes
need a server). Use the Vercel dev server:

```bash
cd anime-randomizer
npx vercel dev
```

Then open http://localhost:3000.

## Configuration

Optional environment variables (Vercel > Project > Settings > Environment
Variables). They are only read by the serverless functions.

| Variable        | Purpose                                              | Default                                   |
|-----------------|------------------------------------------------------|-------------------------------------------|
| `ANIME_API_URL` | Random-anime endpoint                                | `http://192.46.208.170:7856/rgb/anime`    |
| `ANIME_API_KEY` | Sent as `Authorization: Bearer <key>` if your API needs one | not set                            |

## Replacing the API later

1. Set `ANIME_API_URL` to the new endpoint. If it returns the same JSON shape
   (`status`, `message_id`, `image_url`, `series`, `character_name`) you are done.
2. If the JSON differs, update the mapping in two places:
   - `api/random-anime.js` (server-side, reads the upstream fields)
   - `normalizeResponse()` in `js/api.js` (what the UI receives)
3. To call a CORS-enabled HTTPS API directly from the browser, change
   `API_CONFIG.endpoint` in `js/api.js` and add that host to `connect-src` and
   `img-src` in the Content-Security-Policy in `vercel.json`.

Never put secret keys in `js/`. Anything in that folder is public.

## Notes and limits

- **Image size:** Vercel serverless responses are limited to 4.5 MB. Larger images
  return an error in the app; press Retry to get another one.
- **Favorites and history** are stored per browser in localStorage. Saved entries
  keep the image link, not the image itself, so they depend on the upstream
  server still hosting the file. Broken thumbnails show a blank tile with the name.
- **SFW:** the app has no adult content of its own, but it shows whatever the API
  returns. Check the API's content policy before making the site public.
- **Fonts:** headings use Chakra Petch from Google Fonts with a system fallback.
  Remove the two `fonts.*` links in `index.html` and the CSP entries in
  `vercel.json` if you want zero third-party requests.
