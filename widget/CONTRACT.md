# Widget frame contract

`embed.js` is the whole of the drop-in widget's public surface. Everything else a widget touches
(the framed page itself, the store's chat assistant, the payment path, the admin) is closed and
served by the hosting platform; this file documents the contract between the loader and that
platform, not the platform's own code.

Every host name below is a placeholder. Read `https://widget.example.com` as "wherever the
platform tells you to point the script tag," never as a real ArrowMem address.

## The snippet

One classic script tag, wherever the widget should appear on the page:

```html
<div data-arrowmem-widget></div>
<script src="https://widget.example.com/embed.js" async></script>
```

It must be a classic script, not `type="module"`: the loader reads its own address from
`document.currentScript.src`, and `document.currentScript` is always `null` inside a module
script. A module tag finds no `src` and the loader does nothing.

`data-arrowmem-widget` marks the element the iframe is appended into. The loader looks for every
element carrying that attribute and gives each one its own frame.

## The iframe

The loader creates the iframe itself; a site never writes the `<iframe>` tag by hand.

- `src`: the widget host's own origin (read from the loader's own `src`, see above) plus `/quote`.
- `title`: `"Store tools"`.
- `sandbox`, exact string:
  `allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation`
- `allow`: `"clipboard-write"`.
- Starts at `height:900px`, width 100%, no border, block display; the height message below
  resizes it after that.

### Every window this frame can open, and the navigation it can trigger

`allow-popups` and `allow-popups-to-escape-sandbox` govern every new window the framed page can
open, not only its payment step. Reviewed against the deployed loader and framed page on
2026-09-28, there are three, plus one top-level navigation:

1. **The payment-fee handoff.** A blank tab is opened first (`window.open("about:blank",
   "_blank")`), then filled once the platform's own fee endpoint responds: the tab is pointed at
   the URL that response returns. If the browser blocked that tab (popup blockers can), the frame
   navigates ITSELF to that same URL instead, ordinary same-window self-navigation of the frame's
   own window; no top-navigation sandbox flag is involved in that fallback at all.
2. **The PDF print view.** A blank window is opened and never given a URL; it is filled entirely
   by writing the visitor's own project data into it directly, HTML-escaped first. No network
   request follows and no third-party origin is loaded, only the visitor's own data reflected
   back into a window they already caused to open.
3. **A reply link.** Text the assistant returns is HTML-escaped, then any `http(s)://` URL found
   in it is turned into a link that opens with `rel="noopener" target="_blank"`. Unlike the two
   cases above, this one is not restricted to the platform's own origin by anything in this
   loader's contract or in the sandbox flags: the matching is a plain URL pattern, and the
   platform's own test fixture for it exercises an external domain. Whatever narrows which URLs
   a reply can actually contain, if anything does, is a property of the assistant's own backend,
   which is closed and out of this repository; it is not enforced by the code this contract
   describes, and a widget host relying on it should verify that separately rather than take it
   on faith from this document.

**The one top-level navigation this contract grants** belongs to a pay control on a different
framed page (also served on the same widget host): on a real click it checks whether it is
already the top window and, when it is not, sets `window.top.location.href` to the payment page,
with a plain `target="_top"` link as a fallback if that is blocked or throws. Its own comment states why: the
payment provider refuses to be framed, so paying has to open in the whole top window, and the
sandbox allows that only on a real click. This is exactly what
`allow-top-navigation-by-user-activation` grants and is the only path in this contract that uses
it; whether the click's activation survives the awaited fetch that runs before that navigation is
browser-dependent, and a host should verify this in whichever browsers it cares about rather than
assume it from this document.

The condition this flag combination is accepted under: every window the framed page opens either
loads a URL from the platform's own fee endpoint (case 1), or is filled only with the visitor's
own already-escaped data and no URL at all (case 2); the one top-level navigation it can trigger
follows a real click and only ever targets the payment page. Case 3 is a distinct, narrower risk
(an open-redirect-shaped link, mitigated by `rel="noopener"` and by the text being escaped before
any URL is extracted from it, but not by an origin allow-list) and should be judged on those
terms, not folded into the same "safe because it's one of the accepted cases" condition. Any new
`window.open` call, or any change to what a reply link or the top-navigation target can point to,
re-runs this review before it ships.

## Height message: frame to loader

The framed page posts its own height to the parent after every resize:

```js
parent.postMessage({ h: <integer, 1 to 100000> }, targetOrigin);
```

`targetOrigin` is never a wildcard. The framed page decides it from, in order: the browser's own
`ancestorOrigins` entry, then `document.referrer`, then an origin saved from the frame's own first
load in that session, each checked against the site owner's `embedOrigins` list (below). The first
one on the list wins; if none of the three is on the list, no message is posted at all for that
frame's lifetime.

The loader accepts a height message only when:

1. `event.origin` equals the widget host's own origin (the same origin the loader derived its
   frame `src` from), and
2. the payload is an object with an integer `h` where `0 < h <= 100000`, and
3. `event.source` is the exact frame the loader created (so one page's several widgets cannot
   resize each other).

Anything else is silently dropped: no console warning, no thrown error, both by design. The
100000 cap and the framed page's own resize clamp are the same number on both sides of the
contract; the loader and the framed page's own script must be kept in agreement if either one
changes it.

## `embedOrigins`: the site owner's allow-list

The widget host only frames for origins the site owner has listed, and only posts height to a
listed origin. An entry is exact scheme plus host plus optional port, no path, no trailing slash,
no wildcard, e.g. `https://www.example.com` or `https://example.com:8443`. A malformed entry is a
build-time error (the list is validated, not merely filtered), not a silent drop.

The same list drives the `frame-ancestors` directive the framed page serves on itself:

```
frame-ancestors https://www.example.com https://example.com:8443
```

or `frame-ancestors 'none'` when the list is empty, so the framed page cannot be embedded by
anything until an owner adds an origin. `X-Frame-Options` is not sent alongside it (a legacy
header some proxies still honour instead of CSP would otherwise block every embed).

On the loader's own file, the same list gates cross-origin fetches of it: the response carries
`Access-Control-Allow-Origin` for a listed origin only, `Vary: Origin` always, and no header at
all for anything else, so the immutable cache never serves one dealer's CORS grant to another
dealer's page.

## Why the loader is versioned and immutable

The served path is cached as immutable content. A change to what the loader does is shipped as a
new file name (in the deployed system, `embed.v2.js`, `embed.v3.js`, and so on); the old file
keeps running exactly as before for every page that still references it, and a site owner moves
to the new behaviour by re-pasting the new snippet. This repository's copy is named plainly,
`embed.js`, because it carries no version number of its own; a platform serving it under this
contract is expected to give its own deployed copy the versioned name and caching policy above.

## What is closed, and stays out of this repository

- The framed page itself (the tools behind `/quote` and the pages it links to).
- The payment path (the platform's fee collection and its Stripe integration).
- The chat assistant.
- The admin the site owner uses to manage their own content.
- Any real host name, dealer name, store name, or API key.

This repository documents and tests only the loader and the shape of the two messages that cross
the frame boundary. Everything the framed page does once it is loaded is the hosting platform's
own closed code.

## Tests

```sh
node --test widget/embed.test.js
```
