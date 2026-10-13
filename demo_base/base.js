/* Shared by every week's demo.js; scripts/build_demo.py puts this in front of it. */

// TXT("key", {n: 12}) — a text chunk from demo/text/*.md with its {n} placeholders filled; see scripts/demo_text.py
function TXT(key, vars) {
  const t = document.querySelector(`template[data-text="${key}"]`);
  if (!t) throw new Error("no text chunk '" + key + "' — add it to demo/text/");
  let s = t.innerHTML;
  if (vars) for (const k in vars) s = s.split("{" + k + "}").join(vars[k]);
  return s;
}

// reference lists (demo/text, `## end-refs`): external links open in a new tab
document.querySelectorAll('.prose.footnote a[href^="http"]').forEach(a => { a.target = "_blank"; a.rel = "noopener"; });
