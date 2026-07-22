import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const adminRoot = path.resolve(scriptDir, "..");
const websiteRoot = path.resolve(adminRoot, "..", "MWU-Project");
const sourcePath = process.argv[2];

if (!sourcePath) {
  throw new Error("Usage: node scripts/import-president-profile.mjs <president-html-file>");
}

const scope = ".president-profile-page";
const marker = `/* ========================================\n   MWU President Profile\n======================================== */`;

const splitSelectorList = (value) => {
  const result = [];
  let start = 0;
  let depth = 0;
  let quote = "";
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === "(") depth += 1;
    else if (char === ")") depth = Math.max(0, depth - 1);
    else if (char === "," && depth === 0) {
      result.push(value.slice(start, index));
      start = index + 1;
    }
  }
  result.push(value.slice(start));
  return result;
};

const scopeSelector = (selector) => {
  const trimmed = selector.trim();
  if (!trimmed) return trimmed;
  if (trimmed === ":root" || trimmed === "html" || trimmed === "body") return scope;
  if (trimmed === "*") return `${scope}, ${scope} *`;
  if (/^body(?=[.#[:])/i.test(trimmed)) return trimmed.replace(/^body/i, scope);
  if (/^html(?=[.#[:])/i.test(trimmed)) return trimmed.replace(/^html/i, scope);
  if (trimmed.startsWith(scope)) return trimmed;
  return `${scope} ${trimmed}`;
};

const findBlockEnd = (css, openIndex) => {
  let depth = 1;
  let quote = "";
  let comment = false;
  for (let index = openIndex + 1; index < css.length; index += 1) {
    const char = css[index];
    const next = css[index + 1];
    if (comment) {
      if (char === "*" && next === "/") {
        comment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "/" && next === "*") {
      comment = true;
      index += 1;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) return index;
  }
  throw new Error("Unbalanced CSS block in supplied President page.");
};

const readPreludeEnd = (css, start) => {
  let quote = "";
  let comment = false;
  let parens = 0;
  for (let index = start; index < css.length; index += 1) {
    const char = css[index];
    const next = css[index + 1];
    if (comment) {
      if (char === "*" && next === "/") {
        comment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "/" && next === "*") {
      comment = true;
      index += 1;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "(") parens += 1;
    else if (char === ")") parens = Math.max(0, parens - 1);
    else if (parens === 0 && (char === "{" || char === ";")) return index;
  }
  return css.length;
};

const scopeRules = (css) => {
  let output = "";
  let cursor = 0;
  while (cursor < css.length) {
    const triviaMatch = css.slice(cursor).match(/^(?:\s+|\/\*[\s\S]*?\*\/)+/);
    if (triviaMatch) {
      output += triviaMatch[0];
      cursor += triviaMatch[0].length;
    }
    if (cursor >= css.length) break;
    const preludeEnd = readPreludeEnd(css, cursor);
    if (preludeEnd >= css.length) {
      output += css.slice(cursor);
      break;
    }
    const prelude = css.slice(cursor, preludeEnd).trim();
    const terminator = css[preludeEnd];
    if (terminator === ";") {
      output += `${prelude};`;
      cursor = preludeEnd + 1;
      continue;
    }
    const closeIndex = findBlockEnd(css, preludeEnd);
    const inner = css.slice(preludeEnd + 1, closeIndex);
    if (prelude.startsWith("@")) {
      const nested = /^@(media|supports|container|layer|document)\b/i.test(prelude);
      output += `${prelude}{${nested ? scopeRules(inner) : inner}}`;
    } else {
      const scopedPrelude = splitSelectorList(prelude).map(scopeSelector).join(", ");
      output += `${scopedPrelude}{${inner}}`;
    }
    cursor = closeIndex + 1;
  }
  return output;
};

const sourceHtml = await readFile(path.resolve(sourcePath), "utf8");
const styleMatch = sourceHtml.match(/<style\b[^>]*>([\s\S]*?)<\/style>/i);
const bodyMatch = sourceHtml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
if (!styleMatch || !bodyMatch) throw new Error("Supplied file must contain one <style> block and a <body>.");

const scopedCss = scopeRules(styleMatch[1].trim());
const bodyHtml = bodyMatch[1].trim();
const stylesheetLink = '  <link rel="stylesheet" href="assets/css/style.css">';
let importedHtml = sourceHtml.replace(styleMatch[0], stylesheetLink);
importedHtml = importedHtml.replace(/<body\b[^>]*>/i, '<body>\n  <div class="president-profile-page">');
importedHtml = importedHtml.replace(/<\/body>/i, '  </div>\n</body>');

const stylesheetPath = path.join(websiteRoot, "public", "assets", "css", "style.css");
const existingStyles = await readFile(stylesheetPath, "utf8");
const markerIndex = existingStyles.indexOf(marker);
const baseStyles = (markerIndex >= 0 ? existingStyles.slice(0, markerIndex) : `${existingStyles.trimEnd()}\n\n`).trimEnd();
const nextStyles = `${baseStyles}\n\n${marker}\n${scopedCss}\n`;

await Promise.all([
  writeFile(path.join(adminRoot, "public", "legacy", "president.html"), importedHtml, "utf8"),
  writeFile(path.join(websiteRoot, "public", "legacy", "president.html"), importedHtml, "utf8"),
  writeFile(stylesheetPath, nextStyles, "utf8")
]);

console.log(JSON.stringify({
  sourceBytes: sourceHtml.length,
  outputHtmlBytes: importedHtml.length,
  bodyBytes: bodyHtml.length,
  scopedCssBytes: scopedCss.length,
  stylesheetPath,
  inlineStylesRemoved: !/<style\b/i.test(importedHtml),
  exactPageWrapper: importedHtml.includes('class="president-profile-page"')
}, null, 2));
