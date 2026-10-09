// Prints the WCAG contrast table for the design tokens.
// Run with: npm run contrast
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { checkPairs, parseTokens } from "../lib/contrast.ts";

const css = readFileSync(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8");
const results = checkPairs(parseTokens(css));

console.log("| Foreground | Background | Ratio | Needs | Result | Used for |");
console.log("|---|---|---|---|---|---|");
for (const r of results) {
  console.log(
    `| ${r.fg} \`${r.fgHex}\` | ${r.bg} \`${r.bgHex}\` | ${r.ratio.toFixed(2)}:1 | ${r.min}:1 | ${
      r.pass ? "pass" : "**FAIL**"
    } | ${r.use} |`
  );
}
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed} of ${results.length} pairs pass.`);
process.exitCode = failed ? 1 : 0;
