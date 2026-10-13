/* The questions of a lecture page. scripts/build_demo.py puts this in front of the week's demo/lecture/lecture.js;
   the questions themselves are parsed from demo/lecture/text/*.md by scripts/quiz_text.py into #quiz-data.

   lecture.js registers what the markdown cannot hold:
     QUIZ.figs.name = host => { ...draw an SVG into host... }   for every <div data-fig="name"></div> in a question
                                                                 or an answer; a `point` question's clickable parts
                                                                 carry data-pick="key" matching its options
     QUIZ.values.name = 0.631                                     for a fill answer written as `@name`
   Answers are kept in localStorage per page (meta[name=quiz-store]) so a student can leave and come back;
   "Reset answers" in the rail clears them. Nothing here depends on the seminar's demo_data. */
"use strict";
const QUIZ = { figs: {}, values: {}, data: null, state: null };

document.addEventListener("DOMContentLoaded", () => {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const DATA = JSON.parse($("#quiz-data").textContent);
  const STORE = "quiz:" + (($('meta[name="quiz-store"]') || {}).content || location.pathname);
  const load = () => { try { return JSON.parse(localStorage.getItem(STORE) || "{}"); } catch (e) { return {}; } };
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* private window: answers live until reload */ } };
  let state = load();
  QUIZ.data = DATA; QUIZ.state = () => state;

  /* ------------------------------------------------------------- figures */
  function drawFigs(root) {
    $$("[data-fig]", root).forEach(h => {
      if (h.dataset.drawn) return;
      const f = QUIZ.figs[h.dataset.fig];
      if (f) { f(h); h.dataset.drawn = "1"; }
      else h.innerHTML = `<div class="qz-nofig">figure “${esc(h.dataset.fig)}” is not drawn in lecture.js</div>`;
    });
  }

  /* -------------------------------------------------------------- answers */
  const norm = s => String(s).toLowerCase().replace(/[×*]/g, "x").replace(/\s+/g, " ").replace(/[.,;:]+$/, "").trim();
  const num = s => { const v = parseFloat(String(s).replace(",", ".").replace(/[^0-9eE+.\-]/g, "")); return isNaN(v) ? null : v; };
  function expected(alt) {
    if (alt.startsWith("@")) {
      const v = QUIZ.values[alt.slice(1)];
      if (v === undefined) throw new Error(`QUIZ.values.${alt.slice(1)} is not set in lecture.js`);
      return v;
    }
    return alt;
  }
  function matches(given, blank) {
    for (const alt of blank.alts) {
      const e = expected(alt);
      const en = typeof e === "number" ? e : num(e);
      if (en !== null && (blank.tol != null || typeof e === "number" || /^[-+]?[0-9.,eE]+$/.test(String(e).trim()))) {
        const g = num(given); if (g === null) continue;
        const dec = (String(e).split(".")[1] || "").length;
        const tol = Math.max(blank.tol || 0, dec ? 0.5 * Math.pow(10, -dec) : 0, Math.abs(en) * 1e-9);
        if (Math.abs(g - en) <= tol) return true;
      } else if (norm(given) === norm(e)) return true;
    }
    return false;
  }
  const shown = blank => { const e = expected(blank.alts[0]); return typeof e === "number" ? (blank.tol != null ? +e.toFixed(Math.max(0, Math.ceil(-Math.log10(blank.tol)))) : +e.toFixed(3)) : e; };

  /* `{name}` in a question, an option or an answer -> QUIZ.values.name (a number the browser computed), so the
     markdown holds the sentence and never the number */
  const fmtv = v => typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(3)) : String(v);
  const fill = html => html.replace(/\{([a-z][a-z0-9_]*)\}/g, (m, k) => k in QUIZ.values ? esc(fmtv(QUIZ.values[k])) : m);

  /* ------------------------------------------------------------ rendering */
  const KIND = {
    pick: q => q.multi ? "tick all that apply" : "pick one",
    point: q => q.multi ? "click everything that fits" : "click in the picture",
    sort: () => "sort into bins", fill: () => "fill in", write: () => "write, then reveal",
  };
  const pad = n => String(n).padStart(2, "0");

  function render(q) {
    const host = $(`.qz[data-q="${q.key}"]`);
    const st = state[q.key] || (state[q.key] = {});
    host.dataset.type = q.type;
    host.classList.toggle("done", !!st.done);
    host.innerHTML = `<div class="qz-head"><span class="qz-n">${pad(q.n)}</span><span class="qz-kind">${KIND[q.type](q)}</span></div>
      <div class="qz-q">${fill(q.q)}</div><div class="qz-ui"></div>
      <div class="qz-a" hidden>${fill(q.a)}${q.miss ? `<p class="qz-miss"><b>if the answer is</b>${fill(q.miss)}</p>` : ""}</div>`;
    drawFigs(host);
    UI[q.type](q, host, st);
    if (st.done) finish(q, host, st, true);
  }

  function row(extra) { return `<div class="btnrow qz-row">${extra || ""}<span class="qz-verdict"></span></div>`; }
  const verdict = (host, text, ok) => { const v = $(".qz-verdict", host); v.textContent = text; v.className = "qz-verdict " + (ok === true ? "ok" : ok === false ? "no" : ""); };

  const UI = {
    pick(q, host, st) { UI.point(q, host, st); },
    point(q, host, st) {
      const ui = $(".qz-ui", host);
      ui.innerHTML = `<div class="picklist qz-opts">${q.opts.map(o => `<button data-k="${esc(o.k)}">${fill(o.label)}</button>`).join("")}</div>`
        + row(q.multi ? `<button class="primary qz-check" disabled>Check</button>` : "");
      st.sel = st.sel || [];
      const parts = $$("[data-pick]", $(".qz-q", host));
      parts.forEach(p => p.classList.add("qz-pickable"));
      const btns = $$(".qz-opts button", host);
      const keyOf = el => el.dataset.k !== undefined ? el.dataset.k : el.dataset.pick;
      const paint = () => {
        [...btns, ...parts].forEach(el => el.classList.toggle("pick", st.sel.includes(keyOf(el))));
        const ck = $(".qz-check", host); if (ck) ck.disabled = !st.sel.length;
      };
      const choose = k => {
        if (st.done) return;
        if (q.multi) { st.sel = st.sel.includes(k) ? st.sel.filter(x => x !== k) : [...st.sel, k]; paint(); save(); }
        else { st.sel = [k]; finish(q, host, st); }
      };
      btns.forEach(b => b.addEventListener("click", () => choose(b.dataset.k)));
      parts.forEach(p => p.addEventListener("click", () => choose(p.dataset.pick)));
      const ck = $(".qz-check", host); if (ck) ck.addEventListener("click", () => finish(q, host, st));
      paint();
    },
    sort(q, host, st) {
      const ui = $(".qz-ui", host);
      st.sel = st.sel || {};
      ui.innerHTML = `<table class="qz-sort"><tbody>${q.items.map((it, i) => `<tr data-i="${i}"><td class="qz-item">${fill(it.label)}</td>
        <td class="qz-bins">${q.bins.map(b => `<button data-b="${esc(b)}">${esc(b)}</button>`).join("")}</td></tr>`).join("")}</tbody></table>`
        + row(`<button class="primary qz-check" disabled>Check</button><span class="qz-count mono"></span>`);
      const paint = () => {
        $$("tr", ui).forEach(tr => $$("button", tr).forEach(b => b.classList.toggle("pick", st.sel[tr.dataset.i] === b.dataset.b)));
        const n = Object.keys(st.sel).length;
        $(".qz-check", host).disabled = n < q.items.length;
        $(".qz-count", host).textContent = st.done ? "" : `${n} / ${q.items.length} placed`;
      };
      ui.addEventListener("click", e => {
        const b = e.target.closest("button[data-b]"); if (!b || st.done) return;
        st.sel[b.closest("tr").dataset.i] = b.dataset.b; paint(); save();
      });
      $(".qz-check", host).addEventListener("click", () => finish(q, host, st));
      paint();
    },
    fill(q, host, st) {
      const ui = $(".qz-ui", host);
      ui.innerHTML = row(`<button class="primary qz-check" disabled>Check</button>`);
      st.vals = st.vals || {};
      const inputs = $$("input.qz-blank", host);
      const paint = () => { $(".qz-check", host).disabled = inputs.some(i => !i.value.trim()); };
      inputs.forEach(i => {
        i.value = st.vals[i.dataset.blank] || "";
        i.addEventListener("input", () => { st.vals[i.dataset.blank] = i.value; paint(); save(); });
        i.addEventListener("keydown", e => { if (e.key === "Enter" && !$(".qz-check", host).disabled) finish(q, host, st); });
      });
      $(".qz-check", host).addEventListener("click", () => finish(q, host, st));
      paint();
    },
    write(q, host, st) {
      const ui = $(".qz-ui", host);
      ui.innerHTML = `<textarea class="qz-text" rows="3" placeholder="Your answer, in a few sentences — then reveal."></textarea>`
        + row(`<button class="primary qz-check">Reveal</button>`);
      const ta = $("textarea", ui);
      ta.value = st.text || "";
      ta.addEventListener("input", () => { st.text = ta.value; save(); });
      $(".qz-check", host).addEventListener("click", () => finish(q, host, st));
    },
  };

  function finish(q, host, st, restoring) {
    st.done = true;
    host.classList.add("done");
    const ck = $(".qz-check", host); if (ck) ck.remove();
    if (q.type === "pick" || q.type === "point") {
      const right = new Set(q.opts.filter(o => o.right).map(o => o.k));
      const parts = $$("[data-pick]", $(".qz-q", host));
      [...$$(".qz-opts button", host), ...parts].forEach(el => {
        const k = el.dataset.k !== undefined ? el.dataset.k : el.dataset.pick;
        el.classList.remove("pick");
        el.classList.toggle("right", right.has(k));
        el.classList.toggle("wrong", st.sel.includes(k) && !right.has(k));
        el.classList.toggle("missed", right.has(k) && !st.sel.includes(k));
        el.disabled = true;
      });
      const hit = st.sel.filter(k => right.has(k)).length, wrong = st.sel.length - hit, missed = right.size - hit;
      if (!q.multi) verdict(host, hit ? "right" : "not quite", !!hit);
      else verdict(host, wrong + missed === 0 ? "all of them" : `${hit} right · ${wrong} wrong · ${missed} missed`, wrong + missed === 0);
    } else if (q.type === "sort") {
      let agree = 0;
      $$("table.qz-sort tr", host).forEach(tr => {
        const it = q.items[+tr.dataset.i], chosen = st.sel[tr.dataset.i], ok = it.bins.includes(chosen);
        agree += ok ? 1 : 0;
        $$("button", tr).forEach(b => {
          b.classList.remove("pick"); b.disabled = true;
          b.classList.toggle("right", b.dataset.b === chosen && ok);
          b.classList.toggle("wrong", b.dataset.b === chosen && !ok);
          b.classList.toggle("ans", it.bins.includes(b.dataset.b) && b.dataset.b !== chosen);
        });
      });
      $(".qz-count", host).textContent = "";
      verdict(host, `${agree} of ${q.items.length} agree with the answer`, agree === q.items.length ? true : agree >= q.items.length * 0.7 ? null : false);
    } else if (q.type === "fill") {
      let ok = 0;
      $$("input.qz-blank", host).forEach(i => {
        const b = q.blanks.find(x => x.id === i.dataset.blank), good = matches(i.value, b);
        ok += good ? 1 : 0;
        i.classList.toggle("right", good); i.classList.toggle("wrong", !good); i.readOnly = true;
        if (!good && !i.nextElementSibling?.classList.contains("qz-exp")) i.insertAdjacentHTML("afterend", `<span class="qz-exp">${esc(shown(b))}</span>`);
      });
      verdict(host, ok === q.blanks.length ? "right" : `${ok} of ${q.blanks.length}`, ok === q.blanks.length);
    } else if (q.type === "write") {
      $("textarea", host).readOnly = false;
      if (q.check.length && !$(".qz-ticks", host)) {
        st.ticks = st.ticks || [];
        $(".qz-ui", host).insertAdjacentHTML("beforeend", `<div class="qz-ticks"><div class="qz-ticks-k">tick what your answer had</div>${q.check.map((c, i) =>
          `<label><input type="checkbox" data-i="${i}" ${st.ticks.includes(i) ? "checked" : ""}> <span>${fill(c)}</span></label>`).join("")}</div>`);
        $(".qz-ticks", host).addEventListener("change", e => {
          const i = +e.target.dataset.i; st.ticks = e.target.checked ? [...new Set([...st.ticks, i])] : st.ticks.filter(x => x !== i); save();
        });
      }
    }
    const a = $(".qz-a", host); a.hidden = false; drawFigs(a);
    if (!restoring) save();
    progress();
  }

  /* ------------------------------------------------------------- progress */
  const isOptional = host => !!host.closest("details.optional");
  function progress() {
    const hosts = $$(".qz"), main = hosts.filter(h => !isOptional(h)), opt = hosts.filter(isOptional);
    const done = l => l.filter(h => h.classList.contains("done")).length;
    const el = $("#quiz-progress"); if (!el) return;
    el.textContent = `answered ${done(main)} / ${main.length}` + (opt.length ? ` · ${done(opt)} / ${opt.length} optional` : "");
    $$(".optional-count").forEach(c => { const l = $$(".qz", c.closest("details")); c.textContent = `${done(l)} / ${l.length}`; });
  }

  /* ----------------------------------------------------------------- rail */
  const nav = $("#nav");
  if (nav) {
    const secs = $$("main section").filter(s => s.id && $("h2", s));
    nav.innerHTML = secs.map((s, i) => `<a href="#${s.id}"><span>${pad(i + 1)}</span><span>${esc($("h2", s).textContent)}</span></a>`).join("");
    const links = $$("a", nav);
    const onScroll = () => {
      const y = window.scrollY + 120; let cur = 0;
      secs.forEach((s, i) => { if (s.offsetTop <= y) cur = i; });
      links.forEach((a, i) => a.classList.toggle("on", i === cur));
    };
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  }
  const theme = $("#btn-theme");
  if (theme) theme.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    const dark = cur ? cur === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", dark ? "light" : "dark");
  });
  const reset = $("#btn-reset");
  if (reset) {
    let armed = 0;
    reset.addEventListener("click", () => {
      if (Date.now() - armed > 4000) { armed = Date.now(); reset.textContent = "Click again to reset"; setTimeout(() => { reset.textContent = "Reset answers"; }, 4000); return; }
      QUIZ.reset();
      reset.textContent = "Reset answers";
    });
  }
  QUIZ.reset = () => { state = {}; save(); $$("[data-fig]").forEach(h => delete h.dataset.drawn); Object.values(DATA).forEach(render); progress(); };

  /* ----------------------------------------------------------------- go */
  (function fillProse() {   // `{name}` in the page's own prose, text nodes only, so markup and figures are untouched
    const walker = document.createTreeWalker(document.querySelector("main") || document.body, NodeFilter.SHOW_TEXT);
    const nodes = []; while (walker.nextNode()) if (/\{[a-z][a-z0-9_]*\}/.test(walker.currentNode.nodeValue)) nodes.push(walker.currentNode);
    nodes.forEach(n => { n.nodeValue = n.nodeValue.replace(/\{([a-z][a-z0-9_]*)\}/g, (m, k) => k in QUIZ.values ? fmtv(QUIZ.values[k]) : m); });
  })();
  drawFigs(document);
  Object.values(DATA).sort((a, b) => a.n - b.n).forEach(render);
  progress();
});
