# CarTube

A single-page YouTube player for an in-car browser: one box to search YouTube or paste a video link, a large player, and a list of results. Everything is in `index.html`; there is no build step and no server.

## Using it

- **Play a link:** paste any YouTube link (or an 11-character video ID) into the box and press Search. This needs no setup.
- **Search:** type words and press Search. This needs a free API key, see below.
- **Live only:** limits a search to streams that are live right now.
- **Recent:** the last 12 videos played on this device.
- **Keep playing:** when on, playback resumes by itself if something pauses it, and the Pause button on the page is the way to stop. When off, pausing in the YouTube player works as usual.

When a video ends, the next one in the list starts. When nothing is playing, the player shows `logo.webp` (also the browser tab icon); tap it to start the loaded video. Replace that file to change the logo.

## Search setup

Search uses YouTube's official Data API, which needs an API key from your own Google account. The free quota is 10,000 units a day and one search costs 100, so about 100 searches a day.

1. Open [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com) in Google Cloud, create a project if asked, and choose **Enable**.
2. Under **Credentials**, choose **Create credentials**, then **API key**.
3. Restrict the key. Application restrictions: **Websites**, and add the address the page is hosted at (the Settings panel shows the exact value). API restrictions: **YouTube Data API v3**.
4. Open **Settings** on the page, paste the key and save. The page checks the key with YouTube straight away (this costs 1 quota unit) and says whether it works. If it was mistyped, Settings says what looks wrong and shows the saved key in colour-coded groups of five to compare against Google Cloud. The key stays in the text box, so a single wrong character can be corrected and saved again.

The key is stored in that browser's local storage and is sent only to `googleapis.com`. It is never in this repository. To avoid typing it on a touch screen you can open the page once as `https://your-site/#key=YOUR_KEY`; the page saves the key and removes it from the address.

## Hosting

Any static host works (GitHub Pages is enough). The page has to be served over HTTPS: the YouTube player needs a real web address and does not start when the file is opened directly.

## Tests

```
node test/helpers.test.js
```

This runs the page's link parsing, search request building and error-message helpers in Node. Playback itself can only be checked in a browser on the hosted page.

## Notes

- The embedded player has no sign-in, so there are no subscriptions or Premium, and ads play.
- Whether Keep playing has any effect in a moving car depends on the car's browser and has not been tested in one.
- For passengers only. Keep your eyes on the road.
