// Builds the VNIT content catalogue (CT-1, CT-2) from the module files themselves:
// chapters, and every quick-check and quiz question with its options and correct answer.
//
//   node scripts/build-catalogue.mjs
//
// Writes src/data/catalogue/vnit.json, which the app loads into the database on start.
// Run it again whenever a module file changes.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "src/data/catalogue/vnit.json");

const MODULES = [
  { id: "vnit-data-visualisation", file: "vnit/Seeing Data Clearly_ Interactive Learning Module on Data Visualisation.html", type: "module", format: "dvlm" },
  { id: "vnit-data-engineering", file: "vnit/Data Engineering _ Interactive Learning Module.html", type: "module", format: "addq" },
  { id: "vnit-market-basket", file: "vnit/Market Basket Analysis _ Interactive Learning Module.html", type: "module", format: "mba" },
  { id: "vnit-inventory-forecasting", file: "vnit/Inventory Forecasting _ Interactive Learning Module.html", type: "module", format: "addq" },
  { id: "vnit-eternal-dashboard", file: "vnit/eternal-ceo-revenue-dashboard.html", type: "dashboard", format: "none" },
];

// Quiz questions the module does not tag to a chapter. These tags are proposed from the question
// content and are marked "proposed" in the catalogue until the product owner confirms them.
const PROPOSED_CHAPTERS = {
  "vnit-data-engineering": {
    f1: "c2", f2: "c1", f3: "c3", f4: "c3", f5: "c4", f6: "c5",
    f7: "c5", f8: "c6", f9: "c6", f10: "c7", f11: "c7", f12: "c8",
  },
  "vnit-market-basket": {
    "final-1": "m2", "final-2": "m3", "final-3": "m4", "final-4": "m4", "final-5": "m4",
    "final-6": "m7", "final-7": "m7", "final-8": "m6", "final-9": "m6", "final-10": "m4",
  },
};

// ---------------------------------------------------------------- JS literal extraction
/** Returns the source of the bracketed expression starting at `open` ("[", "{" or "("). */
function balanced(src, open) {
  const pairs = { "[": "]", "{": "}", "(": ")" };
  const stack = [];
  let i = open;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      i = skipString(src, i);
      continue;
    }
    if (c === "/" && src[i + 1] === "/") { i = src.indexOf("\n", i); continue; }
    if (c === "/" && src[i + 1] === "*") { i = src.indexOf("*/", i) + 1; continue; }
    if (pairs[c]) stack.push(pairs[c]);
    else if (c === stack[stack.length - 1]) {
      stack.pop();
      if (!stack.length) return src.slice(open, i + 1);
    }
  }
  throw new Error(`unbalanced expression at ${open}`);
}
function skipString(src, i) {
  const q = src[i];
  for (i++; i < src.length; i++) {
    if (src[i] === "\\") { i++; continue; }
    if (q === "`" && src[i] === "$" && src[i + 1] === "{") { i = open(src, i + 1); continue; }
    if (src[i] === q) return i;
  }
  return i;
  function open(s, j) { return j + balanced(s, j).length - 1; }
}

// Question literals may hold arrow functions or templates that use page globals (d3, helpers).
// They are evaluated, never called; any unknown name resolves to a harmless stub.
const stub = new Proxy(function () {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => "" : stub), apply: () => stub });
function evaluate(code, extra = {}) {
  const ctx = new Proxy(extra, {
    has: () => true,
    get: (t, k) => (k === Symbol.unscopables ? undefined : k in t ? t[k] : k in globalThis ? globalThis[k] : stub),
  });
  return vm.runInNewContext(`with (ctx) { (${code}) }`, { ctx });
}

const text = (html) =>
  String(html)
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#8377;/g, "₹")
    .replace(/\s+/g, " ")
    .trim();

// ---------------------------------------------------------------- per format
function sectionChapters(html) {
  // <section class="mod" id="c1" data-nav="Where data engineering fits" data-n="1">
  const out = [];
  for (const m of html.matchAll(/<section class="mod" id="([^"]+)" data-nav="([^"]+)"/g)) {
    const [, id, title] = m;
    const kind = id === "start"
      ? "intro"
      : /quiz/i.test(title)
        ? "quiz"
        : /practice|solved|rule finder|capstone/i.test(title)
          ? "practice"
          : /summary/i.test(title)
            ? "summary"
            : "chapter";
    out.push({ id, title: text(title), kind, position: out.length + 1 });
  }
  return out;
}

function dvlm(html) {
  const at = html.indexOf("const CHAPTERS=[");
  const list = evaluate(balanced(html, html.indexOf("[", at)));
  const chapters = list.map((c, k) => ({
    id: c.id,
    title: c.t,
    kind: c.id === "practice" ? "practice" : c.id === "quiz" ? "quiz" : "chapter",
    position: k + 1,
  }));

  const questions = [];
  for (const m of html.matchAll(/quickCheck\(\$\('#qc\d+'\),'(c\d+)',/g)) {
    const chId = m[1];
    const qs = evaluate(balanced(html, html.indexOf("[", m.index)));
    qs.forEach((q, k) => questions.push(q4(`${chId}-${k + 1}`, chId, "quick_check", q.q, q.opts, [q.opts[0]], q.exp, "module")));
  }
  const quiz = evaluate(balanced(html, html.indexOf("[", html.indexOf("const QUIZ=["))));
  quiz.forEach((q, k) => questions.push(q4(`final-${k + 1}`, `c${q.ch}`, "final_quiz", q.q, q.opts, [q.opts[0]], q.exp, "module")));
  return { chapters, questions };
}

function addq(html, moduleId) {
  const questions = [];
  const addQ = (set, q) => {
    const final = set === "final";
    const proposed = PROPOSED_CHAPTERS[moduleId]?.[q.id];
    questions.push(
      q4(q.id, final ? proposed ?? null : set, final ? "final_quiz" : "quick_check", q.p, [q.correct, ...q.wrong], [q.correct], q.why, final ? (proposed ? "proposed" : null) : "module"),
    );
  };
  for (const m of html.matchAll(/^addQ\(/gm)) evaluate(balanced(html, m.index + 4).replace(/^\(/, "addQ("), { addQ });
  return { chapters: sectionChapters(html), questions };
}

function mba(html, moduleId) {
  const at = html.indexOf("const Q=[", html.indexOf("chapter 9: quiz"));
  const qs = evaluate(balanced(html, html.indexOf("[", at)));
  const questions = qs.map((q, k) => {
    const id = `final-${k + 1}`;
    const ch = PROPOSED_CHAPTERS[moduleId]?.[id] ?? null;
    return q4(id, ch, "final_quiz", q.p, q.o, [q.o[q.a]], q.w, ch ? "proposed" : null);
  });
  return { chapters: sectionChapters(html), questions };
}

function q4(id, chapter, kind, prompt, options, correct, explanation, chapterSource) {
  return {
    id,
    chapter,
    chapterSource,
    kind,
    type: "single",
    text: text(prompt),
    options: options.map(text),
    correct: correct.map(text),
    explanation: explanation ? text(explanation) : null,
  };
}

// ---------------------------------------------------------------- build
const modules = MODULES.map((m, position) => {
  const html = readFileSync(path.join(ROOT, "content", m.file), "utf8");
  const version = createHash("sha1").update(html).digest("hex").slice(0, 10);
  const parsed = m.format === "dvlm" ? dvlm(html) : m.format === "addq" ? addq(html, m.id) : m.format === "mba" ? mba(html, m.id) : { chapters: [], questions: [] };
  const known = new Set(parsed.chapters.map((c) => c.id));
  for (const q of parsed.questions) {
    if (q.chapter && !known.has(q.chapter)) throw new Error(`${m.id} ${q.id}: unknown chapter ${q.chapter}`);
    if (!q.correct.every((c) => q.options.includes(c))) throw new Error(`${m.id} ${q.id}: correct answer not among options`);
  }
  const ids = parsed.questions.map((q) => q.id);
  if (new Set(ids).size !== ids.length) throw new Error(`${m.id}: duplicate question ids`);
  return { id: m.id, type: m.type, position: position + 1, version, ...parsed };
});

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ institution: "vnit", modules }, null, 2) + "\n");
for (const m of modules) {
  const byKind = m.questions.reduce((a, q) => ((a[q.kind] = (a[q.kind] ?? 0) + 1), a), {});
  console.log(`${m.id.padEnd(28)} ${String(m.chapters.length).padStart(2)} chapters  ${JSON.stringify(byKind)}`);
}
console.log(`wrote ${path.relative(ROOT, OUT)}`);
