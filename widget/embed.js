// Copyright 2026 ArrowMem Inc.
// SPDX-License-Identifier: Apache-2.0
// Drop-in widget loader. One classic script tag (not type="module": document.currentScript is
// null for a module, so the loader would find no src and do nothing). It frames the widget host
// named by its own src origin and accepts only a plain integer height back, posted from that same
// origin by the frame it created. See CONTRACT.md for the full frame contract. Never edit this
// file in place: a change ships as a new file name and dealers re-paste the new snippet, because
// the served path is cached immutable (CONTRACT.md, "Why the loader is versioned").
//
// Differs from the deployed copy only in this wrapping, so it can run under node --test: the
// height-validation and origin-check logic is pulled into two named, pure functions; a node guard
// skips the DOM-wiring block and exports those functions instead. The DOM-wiring block itself,
// the sandbox string, the height cap and the origin check are unchanged.
(function (root) {
  "use strict";
  var CAP = 100000; // a real shop page runs about 19000 tall; this just needs to be well above that
  var SANDBOX = "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation";

  function isValidHeight(h) {
    return Number.isInteger(h) && h > 0 && h <= CAP;
  }

  // The height to apply, or null if the message must be ignored: wrong origin, no data, or a
  // height that fails isValidHeight. Pure: plain values in, no DOM.
  function heightFromMessage(msgOrigin, hostOrigin, data) {
    if (msgOrigin !== hostOrigin || !data || typeof data !== "object") return null;
    return isValidHeight(data.h) ? data.h : null;
  }

  if (typeof document === "undefined") {
    // node --test: no DOM here, so only the pure functions are exported.
    root.ArrowMemWidget = { CAP: CAP, SANDBOX: SANDBOX, isValidHeight: isValidHeight, heightFromMessage: heightFromMessage };
    return;
  }

  var src = document.currentScript && document.currentScript.src;
  if (!src) return;
  var hostOrigin = new URL(src).origin;
  var frames = [];
  document.querySelectorAll("[data-arrowmem-widget]").forEach(function (el) {
    var f = document.createElement("iframe");
    f.src = hostOrigin + "/quote";
    f.title = "Store tools";
    f.setAttribute("sandbox", SANDBOX);
    f.setAttribute("allow", "clipboard-write");
    f.style.cssText = "width:100%;border:0;display:block;height:900px";
    el.appendChild(f);
    frames.push(f);
  });
  window.addEventListener("message", function (e) {
    var h = heightFromMessage(e.origin, hostOrigin, e.data);
    if (h == null) return;
    frames.forEach(function (f) { if (f.contentWindow === e.source) f.style.height = h + "px"; });
  });
})(typeof window !== "undefined" ? window : globalThis);
