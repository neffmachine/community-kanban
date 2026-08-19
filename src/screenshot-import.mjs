// Screenshot → item fields, via Claude's vision API.
//
// Ported from the Express server, with two changes that matter for a shop that
// isn't yours:
//
//  1. It uses fetch rather than node:https, so the same code runs locally and
//     in the Workers runtime.
//  2. The API key comes from the environment ONLY. The original could also
//     store a key in the app's settings file; this never writes a key anywhere,
//     so a key can't leak into a backup, a database dump, or a git commit.
//
// Every shop brings its own key and pays its own bill — there is no shared or
// bundled key, and the app works fine without one. This feature simply stays
// switched off until a key is set.

// Field extraction from a product screenshot is not a hard reasoning job, so the
// default is a mid-tier model: it keeps each import cheap for whoever is paying.
// Override with ANTHROPIC_MODEL if you'd rather trade cost for capability.
export const DEFAULT_MODEL = 'claude-sonnet-5';

// Anthropic rejects images past ~5MB. Base64 inflates bytes by about 4/3, so
// catch it here and say so plainly rather than letting the API return a wall of
// JSON about request size.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const PROMPT = `This is a screenshot of a product page (McMaster-Carr, Amazon, or similar). Extract the following and respond with ONLY valid JSON, no other text:
{
  "description": "full product name/title",
  "sku": "part number or SKU",
  "supplier": "vendor/supplier name",
  "price": 0.00,
  "url": "product URL if visible"
}
If a field is not visible, use null. For price use a number only, no $ sign.`;

// How to set a key, in the words that fit the host they're actually on.
export function howToAddKey(hostMode) {
  if (hostMode === 'cloudflare') {
    return 'Get a key at console.anthropic.com, then add it to your own Cloudflare '
      + 'project: npx wrangler pages secret put ANTHROPIC_API_KEY — and redeploy. '
      + 'The key stays in your Cloudflare account; it is billed to you.';
  }
  return 'Get a key at console.anthropic.com, then add this line to your .env file '
    + 'and restart the app:  ANTHROPIC_API_KEY=sk-ant-...  '
    + 'The key stays on this machine; it is billed to you.';
}

// Pull the JSON object out of the model's reply. It is asked for bare JSON, but
// a stray sentence or code fence around it shouldn't lose the whole import.
export function extractJson(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

// Keep only the fields the form knows about, so a surprising reply can't inject
// anything unexpected into the item being created.
export function pickFields(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  const out = {};
  for (const key of ['description', 'sku', 'supplier', 'url']) {
    if (typeof parsed[key] === 'string' && parsed[key].trim()) out[key] = parsed[key].trim();
  }
  // Guard the empty cases before converting: the prompt tells the model to send
  // null for anything it can't see, and Number(null) is 0 — which would quietly
  // price an item at $0.00 instead of leaving it blank.
  const raw = parsed.price;
  if (raw !== null && raw !== undefined && raw !== '') {
    const price = Number(raw);
    if (Number.isFinite(price) && price >= 0) out.price = price;
  }
  return out;
}

// Returns { status, body } for the route to hand straight back.
export async function importFromScreenshot({ image, mediaType, config, fetchImpl = fetch }) {
  if (!image) {
    return { status: 400, body: { error: 'No image provided' } };
  }
  if (image.length > MAX_IMAGE_BYTES) {
    return {
      status: 413,
      body: {
        error: 'That screenshot is too large',
        detail: 'Anthropic accepts images up to about 5MB. Crop it to the product details and try again.',
      },
    };
  }
  if (!config.anthropicKey) {
    return {
      status: 400,
      body: {
        error: 'No Anthropic API key set up yet — screenshot import is off',
        detail: howToAddKey(config.hostMode),
      },
    };
  }

  let response;
  try {
    response = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.anthropicModel || DEFAULT_MODEL,
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/png', data: image } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    });
  } catch (err) {
    return {
      status: 502,
      body: {
        error: 'Could not reach the Anthropic API',
        detail: 'Check this machine has internet access. ' + (err?.message || ''),
      },
    };
  }

  if (!response.ok) {
    // 401 is by far the most likely, and "unauthorized" tells a machinist nothing.
    const detail = response.status === 401
      ? 'The API key was rejected. Check it is correct and still active at console.anthropic.com.'
      : response.status === 429
        ? 'Your Anthropic account is rate-limited or out of credit. Check your usage at console.anthropic.com.'
        : 'The Anthropic API returned an error.';
    return { status: 502, body: { error: `Screenshot import failed (${response.status})`, detail } };
  }

  const data = await response.json().catch(() => null);
  const text = data?.content?.[0]?.text || '';
  const fields = pickFields(extractJson(text));
  if (!fields) {
    return {
      status: 422,
      body: {
        error: "Couldn't read that screenshot",
        detail: 'Try a tighter crop showing the product title, part number and price.',
      },
    };
  }
  return { status: 200, body: fields };
}
