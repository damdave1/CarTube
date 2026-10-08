// Runs the page's pure helpers (the first inline script in index.html) in Node.
// Usage: node test/helpers.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
const ctx = vm.createContext({ URLSearchParams });
vm.runInContext(scripts[0], ctx);
scripts.forEach((code, index) => new vm.Script(code, { filename: `inline-script-${index}` }));   // syntax check only

const { parseVideoId, looksLikeLink, buildSearchUrl, decodeEntities, mapSearchItems, describeApiError, addRecent } = ctx;
const { cleanKey, keyShapeHint, isInvalidKeyError, charKind } = ctx;
// Built at run time so no key-shaped literal sits in the repository.
const shapedKey = 'AIza' + 'x'.repeat(35);
const plain = value => JSON.parse(JSON.stringify(value));   // drops the vm realm so deepEqual compares values

const tests = {
  'parseVideoId reads every common link shape'() {
    const id = 'dQw4w9WgXcQ';
    for (const link of [
      `https://www.youtube.com/watch?v=${id}`,
      `https://www.youtube.com/watch?v=${id}&t=42s&list=PL123`,
      `https://www.youtube.com/watch?app=desktop&v=${id}`,
      `https://youtu.be/${id}?si=abcdef`,
      `https://www.youtube.com/embed/${id}`,
      `https://www.youtube.com/live/${id}?feature=share`,
      `https://www.youtube.com/shorts/${id}`,
      `m.youtube.com/watch?v=${id}`,
      `  ${id}  `,
    ]) assert.equal(parseVideoId(link), id, link);
  },
  'parseVideoId leaves searches alone'() {
    for (const query of ['lofi hip hop', 'Documentary', 'programming', 'youtube rewind 2018', 'news', 'ELECTRONICS'.toLowerCase()]) {
      assert.equal(parseVideoId(query), null, query);
    }
  },
  'parseVideoId rejects YouTube links with no video'() {
    assert.equal(parseVideoId('https://www.youtube.com/@SomeChannel'), null);
    assert.equal(parseVideoId('https://www.youtube.com/watch?v=tooShort'), null);
    assert.equal(looksLikeLink('https://www.youtube.com/@SomeChannel'), true);
    assert.equal(looksLikeLink('youtube rewind 2018'), false);
  },
  'buildSearchUrl asks for embeddable videos and keeps the key out of the URL'() {
    const url = new URL(buildSearchUrl('cats & dogs', false));
    assert.equal(url.origin + url.pathname, 'https://www.googleapis.com/youtube/v3/search');
    assert.equal(url.searchParams.get('q'), 'cats & dogs');
    assert.equal(url.searchParams.get('type'), 'video');
    assert.equal(url.searchParams.get('videoEmbeddable'), 'true');
    assert.equal(url.searchParams.has('eventType'), false);
    assert.equal(url.searchParams.has('key'), false);
    assert.equal(new URL(buildSearchUrl('news', true)).searchParams.get('eventType'), 'live');
  },
  'decodeEntities handles the entities the API sends'() {
    assert.equal(decodeEntities('Tom &amp; Jerry &#39;live&#39; &quot;4K&quot; &lt;3'), 'Tom & Jerry \'live\' "4K" <3');
    assert.equal(decodeEntities('&#x1F600; &AMP; &unknown; &#0; &amp;amp;'), '\u{1F600} & &unknown; &#0; &amp;');
  },
  'mapSearchItems keeps only playable videos'() {
    const data = {
      items: [
        { id: { videoId: 'aaaaaaaaaa1' }, snippet: { title: 'A &amp; B', channelTitle: 'Chan', liveBroadcastContent: 'live' } },
        { id: { channelId: 'UC123' }, snippet: { title: 'a channel' } },
        { id: { videoId: 'aaaaaaaaaa2' } },
      ],
    };
    assert.deepEqual(plain(mapSearchItems(data)), [
      { id: 'aaaaaaaaaa1', title: 'A & B', channel: 'Chan', live: true },
      { id: 'aaaaaaaaaa2', title: 'Untitled', channel: '', live: false },
    ]);
    assert.deepEqual(plain(mapSearchItems({})), []);
  },
  'describeApiError explains the failures seen from the real API'() {
    const invalid = { error: { message: 'API key not valid. Please pass a valid API key.', errors: [{ reason: 'badRequest' }] } };
    assert.match(describeApiError(400, invalid), /rejected the API key/);
    const quota = { error: { message: 'The request cannot be completed because you have exceeded your <a href="/youtube/v3/getting-started#quota">quota</a>.', errors: [{ reason: 'quotaExceeded' }] } };
    assert.match(describeApiError(403, quota), /quota is used up/);
    const referer = { error: { message: 'Requests from referer https://example.com/ are blocked.', errors: [{ reason: 'forbidden' }] } };
    assert.match(describeApiError(403, referer), /restricted to another website/);
    const disabled = { error: { message: 'YouTube Data API v3 has not been used in project 1 before or it is disabled.', errors: [{ reason: 'accessNotConfigured' }] } };
    assert.match(describeApiError(403, disabled), /not enabled/);
    assert.equal(describeApiError(500, { error: { message: 'Backend <b>Error</b>' } }), 'YouTube search failed (HTTP 500): Backend Error');
    assert.equal(describeApiError(502, null), 'YouTube search failed (HTTP 502).');
  },
  'cleanKey removes what a touch keyboard adds'() {
    assert.equal(cleanKey('  AIza Sy-ab_c \n'), 'AIzaSy-ab_c');
    assert.equal(cleanKey('ab–cd—ef−gh'), 'ab-cd-ef-gh');
    assert.equal(cleanKey(shapedKey), shapedKey);
  },
  'keyShapeHint says what is off about a mistyped key'() {
    assert.equal(keyShapeHint(shapedKey), '');
    assert.equal(keyShapeHint('AIza' + 'x_-9Z'.repeat(7)), '');
    assert.match(keyShapeHint(shapedKey.slice(0, 38)), /it has 38 characters instead of 39\.$/);
    assert.match(keyShapeHint('Alza' + 'x'.repeat(35)), /does not start with AIza/);
    assert.match(keyShapeHint('aiza' + 'x'.repeat(35)), /does not start with AIza/);
    assert.match(keyShapeHint('AIza' + 'x'.repeat(34) + '!'), /a character that keys never use/);
    assert.match(keyShapeHint('nope'), /4 characters instead of 39, and it does not start with AIza/);
  },
  'charKind tells look-alike characters apart'() {
    assert.deepEqual([...'0O1lI-_cC'].map(charKind), ['digit', 'upper', 'digit', 'lower', 'upper', 'other', 'other', 'lower', 'upper']);
  },
  'isInvalidKeyError separates a wrong key from a restricted one'() {
    assert.equal(isInvalidKeyError({ error: { message: 'API key not valid. Please pass a valid API key.' } }), true);
    assert.equal(isInvalidKeyError({ error: { message: 'Requests from referer https://example.com/ are blocked.' } }), false);
    assert.equal(isInvalidKeyError(null), false);
  },
  'addRecent puts the newest first, without duplicates, capped at 12'() {
    const list = Array.from({ length: 12 }, (_, i) => ({ id: 'id' + i }));
    const next = plain(addRecent(list, { id: 'id5' }));
    assert.equal(next.length, 12);
    assert.equal(next[0].id, 'id5');
    assert.equal(next.filter(item => item.id === 'id5').length, 1);
    assert.equal(plain(addRecent(list, { id: 'new' })).length, 12);
  },
};

let failed = 0;
for (const [name, run] of Object.entries(tests)) {
  try {
    run();
    console.log('ok   ' + name);
  } catch (error) {
    failed++;
    console.log('FAIL ' + name + '\n     ' + String(error.message).split('\n').join('\n     '));
  }
}
console.log(`${Object.keys(tests).length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
