/*
 * Shared activity tracker (EV-1). Loaded in the outer portal page and in every content file.
 * Content never implements its own tracking; it may call window.__trk.track(type, details), and for
 * learning questions marks each question box with data-trk-q="<id>" and calls window.__trk.answer({id, chosen, correct}).
 *
 * Config comes from window.__TRK_CFG (set by the server just before this script):
 *   endpoint, progressEndpoint, endEndpoint, loginUrl, sessionId, module, defaultChapter, contentVersion,
 *   settings {idleWarnMs, idleFinalMs, idleLogoutMs, heartbeatMs, activeWindowMs},
 *   storage (content files only): the module's saved state for this student.
 *
 * Roles
 *   top   - the outer page (or a content file opened on its own). Runs the inactivity timer,
 *           the warnings, heartbeats and presence pings.
 *   frame - a content file inside the portal's iframe. Sends its own events and reports every
 *           input to the top page so the inactivity timer sees it (LG-7).
 *
 * Tracking never blocks content (EV-9): every entry point is wrapped, and failures are reported.
 */
(function () {
  "use strict";
  if (window.__trk) return;

  var realLS = null;
  try { realLS = window.localStorage; } catch (e) {}

  function safe(fn) {
    return function () {
      try { return fn.apply(this, arguments); } catch (err) { reportError(err); }
    };
  }
  var errorsSent = 0;
  function reportError(err) {
    try {
      if (errorsSent++ > 5) return;
      var body = JSON.stringify({ sessionId: CFG.sessionId, events: [mk("tracker_error", { message: String(err && err.message || err).slice(0, 300) })] });
      navigator.sendBeacon && navigator.sendBeacon(CFG.endpoint || "/api/events", new Blob([body], { type: "application/json" }));
    } catch (e) {}
  }

  var CFG = window.__TRK_CFG || {};
  var S = CFG.settings || {};
  var IDLE_WARN = S.idleWarnMs || 300000;
  var IDLE_FINAL = S.idleFinalMs || 360000;
  var IDLE_LOGOUT = S.idleLogoutMs || 420000;
  var HEARTBEAT = S.heartbeatMs || 15000;
  var ACTIVE_WINDOW = S.activeWindowMs || 60000;
  var ENDPOINT = CFG.endpoint || "/api/events";

  var embedded = false;
  try { embedded = window.parent !== window && !!window.parent.document; } catch (e) { embedded = false; }
  var role = embedded ? "frame" : "top";

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach(function (_, i) { b[i] = Math.random() * 256; });
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join("");
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
  }

  // One tab ID per browser tab. sessionStorage is shared by a tab's top page and its same-origin iframes.
  var tabId;
  try {
    tabId = sessionStorage.getItem("__trk_tab");
    if (!tabId) { tabId = uuid(); sessionStorage.setItem("__trk_tab", tabId); }
  } catch (e) { tabId = uuid(); }

  // ---------------------------------------------------------------- context
  var ctx = { module: CFG.module || null, chapter: null, page: location.pathname };
  var chapterSince = Date.now();

  function frameCtx() {
    // The top page asks its content iframe for the current chapter.
    try {
      var f = document.querySelector("iframe");
      var t = f && f.contentWindow && f.contentWindow.__trk;
      return t ? t.ctx() : null;
    } catch (e) { return null; }
  }
  function currentCtx() {
    var c = { module: ctx.module, chapter: ctx.chapter, page: ctx.page };
    if (role === "top") {
      var f = frameCtx();
      if (f) { c.module = f.module || c.module; c.chapter = f.chapter; }
    }
    return c;
  }

  function mk(type, details, extra) {
    var c = currentCtx();
    var e = {
      id: uuid(),
      type: type,
      ts: new Date().toISOString(),
      module: c.module,
      chapter: c.chapter,
      element: (extra && extra.element) || null,
      page: location.pathname + location.hash,
      tab: tabId,
      cv: CFG.contentVersion || null,
      details: details || null,
    };
    return e;
  }

  // ---------------------------------------------------------------- queue (EV-7)
  var QKEY = "__trk_q_" + role;
  var queue = [];
  var sending = false;
  var backoff = 0;
  var lastSentAt = 0;

  // Events left over from a page that closed before they were sent, for this same session only.
  try {
    var saved = realLS && JSON.parse(realLS.getItem(QKEY) || "null");
    if (saved && saved.sessionId === CFG.sessionId && saved.events && saved.events.length) queue = saved.events.slice(-500);
    realLS && realLS.removeItem(QKEY);
  } catch (e) {}

  function track(type, details, extra) {
    if (!CFG.sessionId) return;
    queue.push(mk(type, details, extra));
    if (queue.length > 2000) queue.splice(0, queue.length - 2000);
    if (queue.length >= 25) flush();
  }

  function payload(events) {
    return JSON.stringify({ sessionId: CFG.sessionId, tabId: tabId, role: role, inputAgoMs: Date.now() - sharedLastInput, events: events });
  }

  function flush(force) {
    if (sending || !CFG.sessionId) return;
    if (!queue.length && !force) return;
    var batch = queue.splice(0, 100);
    sending = true;
    lastSentAt = Date.now();
    fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload(batch), keepalive: true, credentials: "same-origin" })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j }; });
      })
      .then(function (res) {
        sending = false;
        if (res.status >= 500) throw new Error("server " + res.status);
        backoff = 0;
        if (res.body && res.body.session === "ended") onSessionEnded(res.body.reason);
        if (queue.length >= 25) flush();
      })
      .catch(function () {
        sending = false;
        queue = batch.concat(queue); // keep through a network drop
        backoff = Math.min(60000, (backoff || 2000) * 2);
      });
  }

  function flushOnClose() {
    if (!CFG.sessionId) return;
    var batch = queue.splice(0, queue.length);
    var ok = false;
    try { ok = navigator.sendBeacon(ENDPOINT, new Blob([payload(batch)], { type: "application/json" })); } catch (e) {}
    if (!ok && batch.length) {
      try { realLS && realLS.setItem(QKEY, JSON.stringify({ sessionId: CFG.sessionId, events: batch })); } catch (e) {}
    }
  }

  setInterval(safe(function () {
    if (backoff && Date.now() - lastSentAt < backoff) return;
    // Presence ping at least once a minute from the top page, so the server knows a tab is open.
    flush(role === "top" && Date.now() - lastSentAt > 60000);
  }), 5000);

  // ---------------------------------------------------------------- input and inactivity (LG-6, LG-7)
  var lastInput = Date.now();
  var sharedLastInput = Date.now();
  var bc = null;
  try { bc = new BroadcastChannel("__trk"); } catch (e) {}
  try {
    var stored = realLS && Number(realLS.getItem("__trk_last_input"));
    if (stored && stored > sharedLastInput - IDLE_LOGOUT && stored < Date.now()) sharedLastInput = Math.max(sharedLastInput, stored);
  } catch (e) {}

  var lastBroadcast = 0;
  var lastParentPing = 0;
  function onInput() {
    var now = Date.now();
    lastInput = now;
    sharedLastInput = now;
    if (now - lastBroadcast > 3000) {
      lastBroadcast = now;
      try { bc && bc.postMessage({ t: "input", at: now }); } catch (e) {}
      try { realLS && realLS.setItem("__trk_last_input", String(now)); } catch (e) {}
    }
    if (role === "frame" && now - lastParentPing > 1000) {
      lastParentPing = now;
      try { window.parent.__trk && window.parent.__trk._input(now); } catch (e) {}
    }
    if (role === "top" && idleStage) checkIdle();
  }
  ["mousemove", "mousedown", "keydown", "touchstart", "pointerdown", "wheel", "click"].forEach(function (ev) {
    window.addEventListener(ev, safe(onInput), { capture: true, passive: true });
  });
  window.addEventListener("scroll", safe(onInput), { capture: true, passive: true });

  var loggingOut = false;
  if (bc) {
    bc.onmessage = safe(function (m) {
      var d = m.data || {};
      if (d.t === "input" && d.at > sharedLastInput) { sharedLastInput = d.at; if (role === "top" && idleStage) checkIdle(); }
      if (d.t === "logout" && role === "top" && !loggingOut) { loggingOut = true; goToLogin(d.reason); }
    });
  }

  var idleStage = 0; // 0 none, 1 first warning, 2 final warning
  var ui = null;

  function el(tag, css, text) {
    var n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (text) n.textContent = text;
    return n;
  }
  var FONT = "font-family:system-ui,-apple-system,'Segoe UI',Arial,sans-serif;";
  function buildUi() {
    if (ui) return ui;
    var bar = el("div", FONT + "position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:2147483646;background:#fff;color:#1d2833;border:1px solid #c9d2da;border-left:6px solid #153044;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:12px 16px;display:none;align-items:center;gap:14px;max-width:calc(100vw - 32px);font-size:14px");
    bar.setAttribute("role", "status");
    var barText = el("div", "");
    var barTitle = el("strong", "display:block;margin-bottom:2px", "Still there?");
    var barMsg = el("span", "");
    barText.appendChild(barTitle); barText.appendChild(barMsg);
    var barBtn = el("button", "flex-shrink:0;background:#153044;color:#fff;border:0;border-radius:8px;padding:8px 14px;font:inherit;font-weight:600;cursor:pointer", "I'm here");
    bar.appendChild(barText); bar.appendChild(barBtn);

    var overlay = el("div", FONT + "position:fixed;inset:0;z-index:2147483647;background:rgba(12,20,28,.55);display:none;align-items:center;justify-content:center;padding:16px");
    var box = el("div", "background:#fff;color:#1d2833;border-radius:14px;max-width:400px;width:100%;padding:24px;box-shadow:0 16px 48px rgba(0,0,0,.3);text-align:center");
    box.setAttribute("role", "alertdialog");
    box.setAttribute("aria-modal", "true");
    var boxTitle = el("h2", "margin:0 0 8px;font-size:20px", "");
    var boxMsg = el("p", "margin:0 0 18px;color:#4b5966;font-size:15px", "");
    var boxBtn = el("button", "background:#153044;color:#fff;border:0;border-radius:10px;padding:12px 18px;font:inherit;font-weight:600;cursor:pointer;width:100%", "");
    box.appendChild(boxTitle); box.appendChild(boxMsg); box.appendChild(boxBtn);
    overlay.appendChild(box);

    document.body.appendChild(bar);
    document.body.appendChild(overlay);
    barBtn.addEventListener("click", safe(function () { onInput(); checkIdle(); }));
    boxBtn.addEventListener("click", safe(function () { if (boxBtn.dataset.href) location.href = boxBtn.dataset.href; else { onInput(); checkIdle(); } }));
    ui = { bar: bar, barMsg: barMsg, overlay: overlay, boxTitle: boxTitle, boxMsg: boxMsg, boxBtn: boxBtn };
    return ui;
  }

  function fmt(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2);
  }

  function checkIdle() {
    if (loggingOut || !CFG.sessionId || !document.body) return;
    var idle = Date.now() - sharedLastInput;
    if (idle >= IDLE_LOGOUT) return doLogout("timeout");
    var u;
    if (idle >= IDLE_FINAL) {
      u = buildUi();
      if (idleStage !== 2) { idleStage = 2; track("idle_warning_6", { idle_seconds: Math.round(idle / 1000) }); }
      u.bar.style.display = "none";
      u.overlay.style.display = "flex";
      u.boxTitle.textContent = "Signing out in " + fmt(IDLE_LOGOUT - idle);
      u.boxMsg.textContent = "You have been inactive for " + Math.floor(IDLE_FINAL / 60000) + " minutes. Your place is saved.";
      u.boxBtn.textContent = "Stay signed in";
      delete u.boxBtn.dataset.href;
    } else if (idle >= IDLE_WARN) {
      u = buildUi();
      if (idleStage !== 1) { idleStage = 1; track("idle_warning_5", { idle_seconds: Math.round(idle / 1000) }); }
      u.overlay.style.display = "none";
      u.bar.style.display = "flex";
      var left = Math.ceil((IDLE_LOGOUT - idle) / 60000);
      u.barMsg.textContent = "You will be signed out after " + left + " more minute" + (left === 1 ? "" : "s") + " without activity.";
    } else if (idleStage) {
      track("idle_dismissed", { stage: idleStage });
      idleStage = 0;
      if (ui) { ui.bar.style.display = "none"; ui.overlay.style.display = "none"; }
    }
  }

  function goToLogin(reason) {
    var next = location.pathname + location.search;
    location.href = (CFG.loginUrl || "/login") + "?reason=" + encodeURIComponent(reason || "timeout") + "&next=" + encodeURIComponent(next);
  }

  function doLogout(reason) {
    if (loggingOut) return;
    loggingOut = true;
    var inputAgoMs = Date.now() - sharedLastInput;
    track("session_timeout", { idle_seconds: Math.round(inputAgoMs / 1000) });
    try { bc && bc.postMessage({ t: "logout", reason: reason }); } catch (e) {}
    var done = function () { goToLogin(reason); };
    // Deliver the last events first: once the session is ended the server refuses them.
    var last = queue.splice(0, queue.length);
    var opts = { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true, credentials: "same-origin" };
    var send = last.length ? fetch(ENDPOINT, Object.assign({ body: payload(last) }, opts)).catch(function () {}) : Promise.resolve();
    send.then(function () { return fetch(CFG.endEndpoint || "/api/session/end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: CFG.sessionId, reason: reason, inputAgoMs: inputAgoMs }),
      keepalive: true,
      credentials: "same-origin",
    }); }).then(done, done);
  }

  var ENDED_TEXT = {
    taken_over: ["You were signed out", "Your account was used on another device."],
    timeout: ["You were signed out", "You were signed out after 7 minutes without activity."],
    logout: ["You have signed out", "You signed out in another tab."],
  };
  function onSessionEnded(reason) {
    if (loggingOut) return;
    loggingOut = true;
    CFG.sessionId = null; // stop sending
    if (role === "frame") {
      try { window.parent.__trk && window.parent.__trk._ended(reason); } catch (e) {}
      return;
    }
    var u = buildUi();
    var t = ENDED_TEXT[reason] || ["Your session has ended", "Please sign in again."];
    u.bar.style.display = "none";
    u.overlay.style.display = "flex";
    u.boxTitle.textContent = t[0];
    u.boxMsg.textContent = t[1];
    u.boxBtn.textContent = "Sign in again";
    u.boxBtn.dataset.href = (CFG.loginUrl || "/login") + "?next=" + encodeURIComponent(location.pathname + location.search);
  }

  if (role === "top") {
    setInterval(safe(checkIdle), 1000);

    // Heartbeat (EV-5): visible tab, input in the last 60 s anywhere in this user's tabs.
    setInterval(safe(function () {
      if (!CFG.sessionId || document.visibilityState !== "visible") return;
      if (Date.now() - sharedLastInput > ACTIVE_WINDOW) return;
      track("heartbeat", { active_seconds: Math.round(HEARTBEAT / 1000) });
    }), HEARTBEAT);
  }

  // ---------------------------------------------------------------- presence (EV-6)
  document.addEventListener("visibilitychange", safe(function () {
    if (role !== "top") return;
    track(document.visibilityState === "hidden" ? "tab_hidden" : "tab_visible");
    if (document.visibilityState === "hidden") flush(); else checkIdle();
  }));
  if (role === "top") {
    window.addEventListener("blur", safe(function () {
      // Clicking into the content iframe blurs the top window; that is not leaving the page.
      setTimeout(safe(function () {
        if (document.activeElement && document.activeElement.tagName === "IFRAME") return;
        track("window_blur");
      }), 0);
    }));
    window.addEventListener("focus", safe(function () { track("window_focus"); }));
  }
  window.addEventListener("pagehide", safe(function () {
    if (isContent) {
      closeChapter();
      track("module_closed");
    }
    track("page_unload");
    saveProgress(true);
    flushOnClose();
  }));

  // ---------------------------------------------------------------- clicks and widgets (EV-4, EV-8, EV-13)
  var ID_ATTRS = ["data-trk", "data-id", "data-go", "data-nav", "data-qid", "data-k", "data-set", "data-theme", "data-v", "data-i", "data-o"];
  function stableId(n) {
    if (!n || n.nodeType !== 1) return null;
    if (n.id) return "#" + n.id;
    for (var i = 0; i < ID_ATTRS.length; i++) {
      var v = n.getAttribute(ID_ATTRS[i]);
      if (v != null && v !== "") return "[" + ID_ATTRS[i] + "=" + v + "]";
    }
    // Fallback: nearest ancestor with an ID, then a short path.
    var path = [];
    var cur = n;
    while (cur && cur.nodeType === 1 && path.length < 4) {
      if (cur.id) { path.unshift("#" + cur.id); break; }
      var tag = cur.tagName.toLowerCase();
      var p = cur.parentElement;
      if (p) {
        var same = Array.prototype.filter.call(p.children, function (c) { return c.tagName === cur.tagName; });
        if (same.length > 1) tag += ":" + (same.indexOf(cur) + 1);
      }
      path.unshift(tag);
      cur = p;
    }
    return path.join(">");
  }
  var TEXT_INPUT = /^(text|search|email|password|tel|url|)$/;
  function labelOf(n) {
    var tag = n.tagName;
    if (tag === "TEXTAREA" || (tag === "INPUT" && TEXT_INPUT.test(n.type || ""))) {
      return (n.getAttribute("aria-label") || n.name || n.placeholder || "").slice(0, 80); // never the typed text
    }
    var l = n.getAttribute("aria-label") || n.getAttribute("title") || n.innerText || n.textContent || n.value || "";
    return String(l).replace(/\s+/g, " ").trim().slice(0, 80);
  }
  var CLICKABLE = "button,a,input,select,textarea,label,summary,[role=button],[role=tab],[role=option],[onclick],[data-trk],[data-id],[data-go],[data-nav],[data-qid],[data-k],[data-o],[data-i],[data-v]";
  document.addEventListener("click", safe(function (e) {
    var t = e.target && e.target.nodeType === 1 ? e.target : e.target && e.target.parentElement;
    if (!t || (ui && (ui.bar.contains(t) || ui.overlay.contains(t)))) return;
    var n = (t.closest && t.closest(CLICKABLE)) || t;
    track("click", {
      label: labelOf(n),
      tag: n.tagName.toLowerCase(),
      x: Math.round(e.clientX), y: Math.round(e.clientY),
      vw: window.innerWidth, vh: window.innerHeight,
    }, { element: stableId(n) });
  }), true);

  document.addEventListener("change", safe(function (e) {
    var n = e.target;
    if (!n || !n.tagName) return;
    var tag = n.tagName, type = (n.type || "").toLowerCase();
    if (tag === "TEXTAREA" || (tag === "INPUT" && TEXT_INPUT.test(type))) return; // typed text is not recorded
    var value = type === "checkbox" || type === "radio" ? n.checked : n.value;
    track("widget_interacted", { control: labelOf(n), input: tag === "SELECT" ? "select" : type, value: String(value).slice(0, 60) }, { element: stableId(n) });
  }), true);

  // ---------------------------------------------------------------- chapters and scroll (frame / standalone content)
  var scrollMarks = {};
  function closeChapter() {
    if (!ctx.chapter) return;
    track("chapter_closed", { seconds_open: Math.round((Date.now() - chapterSince) / 1000) });
  }
  function setChapter(id) {
    id = id ? String(id).slice(0, 80) : null;
    if (!id || id === ctx.chapter) return;
    var from = ctx.chapter;
    closeChapter();
    ctx.chapter = id;
    chapterSince = Date.now();
    scrollMarks = {};
    track("chapter_opened", { from: from });
  }
  function chapterFromPage() {
    var h = location.hash.slice(1);
    if (h) return decodeURIComponent(h);
    // Modules that open on their saved chapter without setting the hash keep it under a "last" key.
    if (moduleStore) {
      var keys = Object.keys(moduleStore.map);
      for (var i = 0; i < keys.length; i++) {
        if (/(^|:)last$/.test(keys[i])) {
          try { var v = JSON.parse(moduleStore.map[keys[i]]); if (typeof v === "string") return v; } catch (e) {}
        }
      }
    }
    return CFG.defaultChapter || null;
  }

  function onScroll() {
    if (!ctx.chapter) return;
    var d = document.documentElement;
    var max = Math.max(d.scrollHeight - window.innerHeight, 1);
    var pct = Math.min(100, Math.round(((window.scrollY || d.scrollTop) / max) * 100));
    if (d.scrollHeight <= window.innerHeight + 4) pct = 100;
    [25, 50, 75, 100].forEach(function (m) {
      if (pct >= m && !scrollMarks[m]) { scrollMarks[m] = 1; track("scroll_depth", { percent: m }); }
    });
  }

  // ---------------------------------------------------------------- learning questions
  // Content marks each question's box with data-trk-q="<question id>" and calls __trk.answer() on an answer.
  // "Shown" is the first moment at least half of the question is on screen; answers are timed from it.
  var shownAt = {};
  var qObserver = null;
  function watchQuestions(root) {
    if (!qObserver || !root || root.nodeType !== 1) return;
    if (root.hasAttribute("data-trk-q")) qObserver.observe(root);
    var list = root.querySelectorAll("[data-trk-q]");
    for (var i = 0; i < list.length; i++) qObserver.observe(list[i]);
  }
  function answer(a) {
    var id = a && a.id ? String(a.id).slice(0, 80) : "";
    if (!id) return;
    track("answer_submitted", {
      question: id,
      option: a.chosen == null ? null : String(a.chosen).slice(0, 200),
      correct: !!a.correct,
      seconds: shownAt[id] ? Math.round((Date.now() - shownAt[id]) / 1000) : null,
    }, { element: id });
  }
  /** Retakes: the next time these questions appear they count as shown again. */
  function resetQuestions(ids) {
    (ids || Object.keys(shownAt)).forEach(function (id) { delete shownAt[id]; });
  }

  // ---------------------------------------------------------------- server-backed module storage (LG-10)
  // Content keeps calling localStorage as before, but each student's module state lives on the server.
  var moduleStore = null;
  var saveTimer = null;
  function saveProgress(now) {
    if (!moduleStore || !moduleStore.dirty || !CFG.sessionId) return;
    var body = JSON.stringify({ sessionId: CFG.sessionId, module: CFG.module, data: moduleStore.map });
    if (body.length > 250000) return;
    moduleStore.dirty = false;
    if (now) {
      try { if (navigator.sendBeacon(CFG.progressEndpoint || "/api/progress", new Blob([body], { type: "application/json" }))) return; } catch (e) {}
    }
    fetch(CFG.progressEndpoint || "/api/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: body, keepalive: true, credentials: "same-origin" })
      .catch(function () { moduleStore.dirty = true; });
  }
  function installStorage(initial) {
    var map = {};
    Object.keys(initial || {}).forEach(function (k) { map[k] = String(initial[k]); });
    moduleStore = { map: map, dirty: false };
    var changed = function () {
      moduleStore.dirty = true;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(safe(function () { saveProgress(false); }), 1500);
    };
    var has = Object.prototype.hasOwnProperty;
    var api = {
      getItem: function (k) { k = String(k); return has.call(moduleStore.map, k) ? moduleStore.map[k] : null; },
      setItem: function (k, v) { moduleStore.map[String(k)] = String(v); changed(); },
      removeItem: function (k) { delete moduleStore.map[String(k)]; changed(); },
      clear: function () { Object.keys(moduleStore.map).forEach(function (k) { delete moduleStore.map[k]; }); changed(); },
      key: function (i) { var ks = Object.keys(moduleStore.map); return i < ks.length ? ks[i] : null; },
    };
    Object.defineProperty(api, "length", { get: function () { return Object.keys(moduleStore.map).length; } });
    try {
      Object.defineProperty(window, "localStorage", { configurable: true, enumerable: true, get: function () { return api; } });
    } catch (e) {}
    if (window.localStorage !== api) {
      moduleStore = null;
      reportError(new Error("storage shim not installed"));
    }
  }

  if (CFG.storage !== undefined && CFG.module) installStorage(CFG.storage);

  // ---------------------------------------------------------------- start
  var isContent = CFG.kind === "content";
  if (isContent) {
    track("module_opened", { title: CFG.title || null, embedded: embedded });
    if (window.IntersectionObserver && window.MutationObserver) {
      qObserver = new IntersectionObserver(safe(function (entries) {
        entries.forEach(function (en) {
          var id = en.isIntersecting && en.target.getAttribute("data-trk-q");
          if (!id || shownAt[id]) return;
          shownAt[id] = Date.now();
          track("question_shown", { question: id }, { element: id });
        });
      }), { threshold: 0.5 });
      // Modules redraw questions as students answer them; watch new ones as they appear.
      new MutationObserver(safe(function (muts) {
        muts.forEach(function (m) { for (var i = 0; i < m.addedNodes.length; i++) watchQuestions(m.addedNodes[i]); });
      })).observe(document.documentElement, { childList: true, subtree: true });
    }
    var onReady = safe(function () {
      setChapter(chapterFromPage());
      watchQuestions(document.body);
      onScroll();
    });
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(onReady, 0); });
    else setTimeout(onReady, 0);
    window.addEventListener("hashchange", safe(function () { setChapter(chapterFromPage()); }));
    var scrollTimer = null;
    window.addEventListener("scroll", function () {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(safe(onScroll), 250);
    }, { passive: true });
  }

  window.__trk = {
    role: role,
    tabId: tabId,
    ctx: function () { return currentCtx(); },
    track: safe(function (type, details, element) { track(String(type), details || null, { element: element || null }); }),
    chapter: safe(function (id) { setChapter(id); }),
    answer: safe(function (a) { answer(a); }),
    resetQuestions: safe(function (ids) { resetQuestions(ids); }),
    setContext: safe(function (c) {
      var changed = c.page !== ctx.page || c.module !== ctx.module;
      if (c.sessionId) CFG.sessionId = c.sessionId;
      ctx.module = c.module || null;
      ctx.chapter = null;
      ctx.page = c.page || location.pathname;
      if (changed) track("page_view", { title: c.title || document.title });
    }),
    flush: safe(function () { flush(true); }),
    _input: safe(function (at) {
      if (at > sharedLastInput) sharedLastInput = at;
      lastInput = Math.max(lastInput, at);
      if (idleStage) checkIdle();
    }),
    _ended: safe(function (reason) { onSessionEnded(reason); }),
  };

  if (role === "top" && !isContent) track("page_view", { title: CFG.title || document.title });
})();
