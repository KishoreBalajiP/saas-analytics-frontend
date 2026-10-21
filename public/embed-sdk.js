/*!
 * Analivo embed SDK (dependency-free).
 *
 *   <div id="kpis"></div>
 *   <script src="https://app.analivo.example/embed-sdk.js"></script>
 *   <script>
 *     // `token` is minted by YOUR backend (POST /api/v1/embed/api/tokens
 *     // with an API key carrying the embed:create scope).
 *     const embed = AnalivoEmbed.mount({
 *       container: document.getElementById('kpis'),
 *       token,
 *       theme: 'light',              // optional: light | dark | auto
 *       onEvent: (type, detail) => {} // loaded | resize | filters | error
 *     });
 *     embed.setFilters({ filters: [{ field: 'region', op: 'eq', value: 'EU' }] });
 *     embed.destroy();
 *   </script>
 *
 * The token is sent to the iframe by postMessage (targeted at the Analivo
 * origin only), never in a URL. Messages are accepted only from that iframe.
 */
(function (global) {
  "use strict";

  var PREFIX = "analivo:";

  function scriptOrigin() {
    var doc = global.document;
    var current = doc && doc.currentScript;
    if (current && current.src) {
      try {
        return new URL(current.src).origin;
      } catch (e) {
        /* fall through */
      }
    }
    return global.location ? global.location.origin : "";
  }

  var DEFAULT_ORIGIN = scriptOrigin();

  function mount(options) {
    var opts = options || {};
    if (!opts.container) throw new Error("AnalivoEmbed: container is required");
    if (typeof opts.token !== "string" || !opts.token)
      throw new Error("AnalivoEmbed: token is required");
    var frameOrigin = opts.origin || DEFAULT_ORIGIN;
    var onEvent = typeof opts.onEvent === "function" ? opts.onEvent : function () {};

    var iframe = global.document.createElement("iframe");
    iframe.src = frameOrigin + "/embedded";
    iframe.title = opts.title || "Analivo dashboard";
    iframe.style.width = "100%";
    iframe.style.border = "0";
    iframe.style.height = (opts.height || 400) + "px";
    iframe.setAttribute("referrerpolicy", "no-referrer");
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
    opts.container.appendChild(iframe);

    var initialised = false;

    function send(message) {
      if (iframe.contentWindow) iframe.contentWindow.postMessage(message, frameOrigin);
    }

    function onMessage(event) {
      if (event.source !== iframe.contentWindow || event.origin !== frameOrigin) return;
      var data = event.data;
      if (!data || typeof data.type !== "string" || data.type.indexOf(PREFIX) !== 0) return;
      var type = data.type.slice(PREFIX.length);
      if (type === "ready") {
        if (initialised) return;
        initialised = true;
        var init = { type: PREFIX + "init", token: opts.token };
        if (opts.theme) init.theme = opts.theme;
        send(init);
        return;
      }
      if (type === "resize" && typeof data.height === "number" && opts.autoResize !== false) {
        iframe.style.height = Math.max(50, Math.ceil(data.height)) + "px";
      }
      var detail = {};
      for (var k in data)
        if (k !== "type" && Object.prototype.hasOwnProperty.call(data, k)) detail[k] = data[k];
      onEvent(type, detail);
    }

    global.addEventListener("message", onMessage);

    return {
      iframe: iframe,
      setFilters: function (filters) {
        send({ type: PREFIX + "set-filters", filters: filters });
      },
      destroy: function () {
        global.removeEventListener("message", onMessage);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      },
    };
  }

  global.AnalivoEmbed = { mount: mount, version: "1.0.0" };
})(typeof window !== "undefined" ? window : this);
