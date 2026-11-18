// Enquire · enquire.nexus — the page's behaviour. Plain JS, no libraries.
(function () {
  "use strict";

  var ICONS = {"all": "<path d=\"M10.6 11l-.9 9h4.6l-.9-9\"/><path d=\"M8 20h8\"/><rect x=\"10.2\" y=\"7.6\" width=\"3.6\" height=\"3.4\" rx=\".7\"/><path d=\"M12 5.4v2.2\"/><path d=\"M8.6 8.4 4 7.2M8.6 10.2 4 11.4M15.4 8.4 20 7.2M15.4 10.2 20 11.4\"/>", "news": "<path d=\"M4 5.5h11.5v12.8A1.7 1.7 0 0 0 17.2 20H5.7A1.7 1.7 0 0 1 4 18.3z\"/><path d=\"M15.5 9H20v9.3a1.7 1.7 0 0 1-3.4 0\"/><path d=\"M7 9h5.5M7 12h5.5M7 15h3.5\"/>", "observer": "<path d=\"M2.5 12s3.6-6 9.5-6 9.5 6 9.5 6-3.6 6-9.5 6-9.5-6-9.5-6z\"/><circle cx=\"12\" cy=\"12\" r=\"3.1\"/><circle cx=\"12\" cy=\"12\" r=\"1\" fill=\"currentColor\" stroke=\"none\"/>", "thinkpeople": "<path d=\"M4.2 4.6Q9.4 6.6 10.9 10.8M19.8 4.6Q14.6 6.6 13.1 10.8M4.2 19.4Q9.4 17.4 10.9 13.2M19.8 19.4Q14.6 17.4 13.1 13.2\"/><circle cx=\"12\" cy=\"12\" r=\"1.4\"/>", "shaiping": "<path d=\"M12 20v-7.2\"/><path d=\"M12 12.8c0-3.7 2.6-5.9 6.6-5.9 0 3.7-2.6 5.9-6.6 5.9z\"/><path d=\"M12 15.2c0-3-2.2-4.7-5.6-4.7 0 3 2.2 4.7 5.6 4.7z\"/><path d=\"M6.5 20h11\"/>", "leonardo": "<circle cx=\"12\" cy=\"11.6\" r=\"8.4\"/><circle cx=\"12\" cy=\"6.5\" r=\"1.1\"/><path d=\"M12 7.6v5.4\"/><path d=\"M5 9.7h14\" stroke-width=\"1.3\"/><path d=\"M5.9 6.9 12 9.1l6.1-2.2\" stroke-width=\"1.3\"/><path d=\"M12 13l-1 6.9M12 13l1 6.9\" stroke-width=\"1.3\"/><path d=\"M12 13 7.9 18.7M12 13l4.1 5.7\" stroke-width=\"1.3\"/>", "wellbeing": "<path d=\"M12 12c-2.3-1.9-2.3-5.6 0-7.5 2.3 1.9 2.3 5.6 0 7.5z\" transform=\"rotate(0 12 12)\"/><path d=\"M12 12c-2.3-1.9-2.3-5.6 0-7.5 2.3 1.9 2.3 5.6 0 7.5z\" transform=\"rotate(72 12 12)\"/><path d=\"M12 12c-2.3-1.9-2.3-5.6 0-7.5 2.3 1.9 2.3 5.6 0 7.5z\" transform=\"rotate(144 12 12)\"/><path d=\"M12 12c-2.3-1.9-2.3-5.6 0-7.5 2.3 1.9 2.3 5.6 0 7.5z\" transform=\"rotate(216 12 12)\"/><path d=\"M12 12c-2.3-1.9-2.3-5.6 0-7.5 2.3 1.9 2.3 5.6 0 7.5z\" transform=\"rotate(288 12 12)\"/><circle cx=\"12\" cy=\"12\" r=\"1.1\" fill=\"currentColor\" stroke=\"none\"/>", "rooms": "<circle cx=\"7.6\" cy=\"12\" r=\"3.6\"/><path d=\"M11.2 12H20.5M17.5 12v2.8M20.5 12v2.2\"/>"};

  var EDITIONS = [
    { key: "all", short: "Ask across every edition at once", name: "All of Enquire", domain: "enquire.nexus", desc: "Every public edition at once. Members also see the signed-in rooms.",
      sources: ["News", "Malta Observer", "ThinkPeople Nexus", "SHaiPING Malta", "Leonardo 2050", "Wellbeing", "Members’ rooms, after sign-in"] },
    { key: "news", short: "Malta, Europe and the world in the news", name: "News", domain: "enquire.news", x: 22.3, y: 73, desc: "Reporting from Malta, Europe and the world, with the corporate desk and Meridian’s news monitoring.",
      sources: ["cde.news", "The Corporate Times", "Meridian news", "TPN evidence engine"] },
    { key: "observer", short: "Malta’s economy and outlook, in official figures and reports", name: "Malta Observer", domain: "enquire.observer", x: 35.3, y: 56, desc: "Malta’s economy, skills, resilience and standing, read through official statistics and the Observer’s reports.",
      sources: ["Malta Observer", "NSO Malta official statistics", "Malta news monitoring"] },
    { key: "thinkpeople", short: "The Nexus, its services and its practice", name: "ThinkPeople Nexus", domain: "enquire.thinkpeople.io", x: 45.6, y: 48, desc: "How the Nexus works, its published services, and the path for organisations getting ready for AI.",
      sources: ["ThinkPeople Nexus", "Challenge Navigation", "Responsible Intelligence", "People Capability", "HUMaiNE Stewardship"] },
    { key: "shaiping", short: "SHaiPING Malta: purpose, evidence and method", name: "SHaiPING Malta", domain: "enquire.shaipingmalta.eu", x: 51, y: 70.5, desc: "SHaiPING Malta’s purpose, evidence and method.",
      sources: ["SHaiPING Malta purpose", "Evidence and method", "People Future Readiness Index (to follow)"] },
    { key: "leonardo", short: "The philosophy of the Nexus: human wisdom and AI", name: "Leonardo 2050", domain: "enquire.leonardo2050.com", x: 62.8, y: 47.6, desc: "The philosophy behind the Nexus: human wisdom and artificial intelligence, and why 2050.",
      sources: ["Leonardo 2050", "Co-WISDOM", "HUMaiNE", "RELaiTIONAL"] },
    { key: "wellbeing", short: "Wellbeing in Malta through the WBGI (to follow)", name: "Wellbeing", domain: "enquire.thinkpeople.you", x: 81.9, y: 47.5, desc: "Wellbeing in Malta through the published, approved WBGI snapshots. Connection to follow.",
      sources: ["WBGI published snapshots (to follow)"] },
    { key: "rooms", short: "Private rooms for members, after sign-in", name: "Members’ rooms", domain: "enquire.nexus", x: 91.6, y: 56, locked: true, desc: "The private rooms for members: analysis, deep research and working data. Sign-in required.",
      sources: ["Meridian analysis", "Dispatch PRO", "Malta Skills Workbench rooms", "WBGI observatory", "SHaiPING workspaces"] }
  ];

  var HOSTS = { "enquire.news": "news", "enquire.observer": "observer", "enquire.thinkpeople.io": "thinkpeople",
    "enquire.leonardo2050.com": "leonardo", "enquire.shaipingmalta.eu": "shaiping", "enquire.thinkpeople.you": "wellbeing" };

  var $ = function (id) { return document.getElementById(id); };
  var byKey = {};
  EDITIONS.forEach(function (e) { byKey[e.key] = e; });
  var hostEdition = HOSTS[location.hostname] || null;
  var state = { sel: hostEdition || "all" };

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k]; // only ever our own static icon markup
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function icon(key) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[key] + "</svg>";
  }

  // pins on the map, and the same choices as buttons on phones
  function build() {
    var pins = $("pins"), chips = $("chips");
    EDITIONS.forEach(function (e) {
      if (e.key !== "all") {
        var b = el("button", { type: "button", "class": "pin", "data-pick": e.key, "aria-label": e.name, "aria-pressed": "false", html: icon(e.key) });
        b.style.left = e.x + "%"; b.style.top = e.y + "%";
        b.appendChild(el("span", { "class": "pin-label", text: e.name }));
        pins.appendChild(b);
      }
      var c = el("button", { type: "button", "class": "chip", "data-pick": e.key, "aria-pressed": "false", html: icon(e.key) });
      c.appendChild(document.createTextNode(e.name));
      chips.appendChild(c);
    });
    // the description card for pins and the lighthouse
    var tip = el("div", { "class": "tip", role: "tooltip", id: "map-tip", hidden: "" });
    var map = document.querySelector(".map");
    map.appendChild(tip);
    function showTip(target) {
      var e = byKey[target.getAttribute("data-pick")];
      if (!e) return;
      tip.textContent = "";
      tip.appendChild(el("strong", { text: e.name }));
      tip.appendChild(el("span", { "class": "tip-desc", text: e.short }));
      tip.appendChild(el("span", { "class": "tip-dom", text: e.locked ? "Sign-in required" : e.domain }));
      var x = e.key === "all" ? 69.8 : e.x, y = e.key === "all" ? 34 : e.y;
      tip.style.left = x + "%"; tip.style.top = y + "%";
      tip.setAttribute("data-edge", x > 78 ? "right" : x < 22 ? "left" : "mid");
      tip.setAttribute("data-big", e.key === "all" ? "1" : "0");
      tip.hidden = false;
      target.setAttribute("aria-describedby", "map-tip");
    }
    function hideTip(target) { tip.hidden = true; if (target) target.removeAttribute("aria-describedby"); }
    map.querySelectorAll(".pin, .light").forEach(function (b) {
      b.addEventListener("mouseenter", function () { showTip(b); });
      b.addEventListener("mouseleave", function () { hideTip(b); });
      b.addEventListener("focus", function () { showTip(b); });
      b.addEventListener("blur", function () { hideTip(b); });
    });
    document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") hideTip(); });

    document.addEventListener("click", function (ev) {
      var t = ev.target.closest("[data-pick]");
      if (t) { pick(t.getAttribute("data-pick")); }
    });
  }

  function pick(key) {
    if (!byKey[key]) return;
    if (hostEdition && key !== hostEdition && key !== "rooms") {
      // an edition site answers as itself; other paths live on enquire.nexus
      location.href = "https://enquire.nexus/?edition=" + encodeURIComponent(key);
      return;
    }
    state.sel = key;
    render();
    var u = new URL(location.href);
    if (key === "all") u.searchParams.delete("edition"); else u.searchParams.set("edition", key);
    history.replaceState(null, "", u);
  }

  function render() {
    var e = byKey[state.sel];
    document.querySelectorAll("[data-pick]").forEach(function (b) {
      if (b.classList.contains("signin")) return;
      b.setAttribute("aria-pressed", b.getAttribute("data-pick") === e.key ? "true" : "false");
    });
    $("q").placeholder = e.key === "all" ? "Ask across all of Enquire" : "Ask " + e.name;
    $("sel-name").textContent = e.name;
    $("sel-domain").textContent = e.domain;
    $("path-name").textContent = e.name;
    $("path-domain").textContent = e.domain;
    $("path-desc").textContent = e.desc;
    $("path-signin").hidden = !e.locked;
    var ul = $("path-sources"); ul.textContent = "";
    e.sources.forEach(function (s) { ul.appendChild(el("li", { text: s })); });
  }

  // ---- asking
  var busy = false;
  function fmtDate(s) {
    if (!s) return "";
    var t = Date.parse(s);
    if (isNaN(t) || !/^\d{4}-\d{2}/.test(s)) return s;
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Malta" }).format(new Date(t));
  }
  var KIND = { news: "Reporting", filing: "Filing", figure: "Official figure", passage: "Governed passage", analysis: "Analysis" };

  function showLoading(q, e) {
    var r = $("result"); r.hidden = false; r.textContent = "";
    r.appendChild(el("p", { "class": "asked", text: "Your enquiry · " + e.name }));
    r.appendChild(el("p", { "class": "question", text: "“" + q + "”" }));
    r.appendChild(el("p", { "class": "loading" }, [el("i"), document.createTextNode("Reading the sources…")]));
    r.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function citeLink(n) {
    var a = el("a", { "class": "cite", href: "#src-" + n, text: String(n), "aria-label": "Source " + n });
    a.addEventListener("click", function (ev) {
      ev.preventDefault();
      var li = $("src-" + n); if (!li) return;
      li.scrollIntoView({ behavior: "smooth", block: "center" });
      li.classList.remove("flash"); void li.offsetWidth; li.classList.add("flash");
    });
    return a;
  }

  function showAnswer(d, e) {
    var r = $("result"); r.textContent = "";
    r.appendChild(el("p", { "class": "asked", text: "Your enquiry · " + (d.edition ? d.edition.name : e.name) }));
    r.appendChild(el("p", { "class": "question", text: "“" + d.q + "”" }));

    if (d.error && !(d.sources && d.sources.length)) {
      r.appendChild(el("p", { "class": "note", text: d.error }));
      if (d.signIn) pick("rooms");
      return;
    }
    var grid = el("div", { "class": "answer" });
    var left = el("div");
    if (d.error) left.appendChild(el("p", { "class": "note", text: d.error }));
    if (d.summary) {
      var reading = el("div", { "class": "block reading" }, [el("h3", { text: "Reading" }), el("p", { text: d.summary })]);
      if (d.points && d.points.length) {
        var ol = el("ul", { "class": "points" });
        d.points.forEach(function (p) {
          var li = el("li", { text: p.text });
          (p.cites || []).forEach(function (n) { li.appendChild(citeLink(n)); });
          ol.appendChild(li);
        });
        reading.appendChild(ol);
      }
      left.appendChild(reading);
    }
    if (d.uncertainty) left.appendChild(el("div", { "class": "block unc" }, [el("h3", { text: "Uncertainty" }), el("p", { text: d.uncertainty })]));
    grid.appendChild(left);

    if (d.sources && d.sources.length) {
      var list = el("ol", { "class": "srcs" });
      d.sources.forEach(function (s) {
        var title = s.url ? el("a", { "class": "t", href: s.url, target: "_blank", rel: "noopener", text: s.title }) : el("span", { "class": "t", text: s.title });
        var body = el("div", null, [title]);
        if (s.status) body.appendChild(el("span", { "class": "badge", text: s.status }));
        body.appendChild(el("span", { "class": "meta", text: [KIND[s.kind] || s.kind, s.via, fmtDate(s.date)].filter(Boolean).join(" · ") }));
        if (s.excerpt) body.appendChild(el("span", { "class": "ex", text: s.excerpt }));
        list.appendChild(el("li", { id: "src-" + s.n }, [el("span", { "class": "n", text: String(s.n) }), body]));
      });
      grid.appendChild(el("div", { "class": "block source" }, [el("h3", { text: "Sources" }), list]));
    }
    r.appendChild(grid);
    r.appendChild(el("p", { "class": "again", text: (d.cached ? "Answered from a recent enquiry. " : "") + "Enquire reads only the sources listed. Human judgement remains responsible for meaning and decisions." }));
  }

  function ask(q) {
    if (busy) return;
    var e = byKey[state.sel];
    q = q.replace(/\s+/g, " ").trim();
    if (q.length < 3) { $("q").focus(); return; }
    busy = true; $("ask").querySelector("button").disabled = true;
    showLoading(q, e);
    var u = new URL(location.href); u.searchParams.set("q", q); history.replaceState(null, "", u);
    fetch("/api/enquire?q=" + encodeURIComponent(q) + "&edition=" + encodeURIComponent(e.key), { headers: { accept: "application/json" } })
      .then(function (res) { return res.json().catch(function () { return { q: q, error: "Enquire could not be reached. Please try again." }; }); })
      .then(function (d) { showAnswer(d, e); })
      .catch(function () { showAnswer({ q: q, error: "Enquire could not be reached. Please check your connection and try again." }, e); })
      .then(function () { busy = false; $("ask").querySelector("button").disabled = false; });
  }

  build();
  var params = new URLSearchParams(location.search);
  var askedEdition = params.get("edition");
  if (!hostEdition && askedEdition && byKey[askedEdition]) state.sel = askedEdition;
  render();
  $("ask").addEventListener("submit", function (ev) { ev.preventDefault(); ask($("q").value); });
  $("path-signin").addEventListener("click", function (ev) { ev.preventDefault(); showAnswer({ q: "Members’ rooms", error: "Sign-in for the members’ rooms is being set up. It will use the same ThinkPeople sign-in as tpnintel." }, byKey.rooms); });
  if (params.get("q")) { $("q").value = params.get("q"); ask(params.get("q")); }
})();
