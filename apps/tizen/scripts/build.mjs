import { build } from "esbuild";
import {
  copyFileSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
} from "node:fs";
await build({
  entryPoints: ["src/main.tsx"],
  bundle: true,
  minify: true,
  target: ["chrome79"],
  format: "iife",
  outfile: "app/app.js",
  define: { "process.env.NODE_ENV": '"production"' },
  legalComments: "none",
});
console.log("Tizen bundle built for Chrome 79+");
const fontDir = "node_modules/@fontsource/bebas-neue";
mkdirSync("app/fonts", { recursive: true });
for (const file of readdirSync(fontDir + "/files"))
  if (/\.(woff2?|woff)$/.test(file))
    copyFileSync(fontDir + "/files/" + file, "app/fonts/" + file);
copyFileSync(fontDir + "/LICENSE", "app/fonts/OFL.txt");
const fontCSS = readFileSync(fontDir + "/400.css", "utf8").replaceAll(
  "./files/",
  "fonts/",
);
const interDir = "node_modules/@fontsource/inter";
let interCSS = "";
for (const weight of [400, 500, 700]) {
  const faces =
    readFileSync(interDir + "/" + weight + ".css", "utf8").match(
      /\/\* inter-latin(?:-ext)?-[\s\S]*?\}/g,
    ) || [];
  interCSS += faces.join("\n").replaceAll("./files/", "fonts/") + "\n";
}
for (const file of readdirSync(interDir + "/files"))
  if (/^inter-latin(?:-ext)?-(400|500|700)-normal\.woff2?$/.test(file))
    copyFileSync(interDir + "/files/" + file, "app/fonts/" + file);
copyFileSync(interDir + "/LICENSE", "app/fonts/Inter-OFL.txt");
const scale = JSON.parse(readFileSync("src/typography.json", "utf8"));
const variables = [],
  utilities = [];
for (const [group, styles] of Object.entries(scale))
  for (const [name, [size, tracking]] of Object.entries(styles)) {
    const id = group + "-" + name,
      weight = { regular: 400, medium: 500, bold: 700 }[group],
      line = name.includes("title")
        ? 1.2
        : name.includes("headline")
          ? 1.35
          : 1.5;
    variables.push(
      `--type-${id}:${weight} ${size}px/${line} "Inter",sans-serif;--tracking-${id}:${tracking}px;`,
    );
    utilities.push(
      `.type-${id}{font:var(--type-${id});letter-spacing:var(--tracking-${id});}`,
    );
  }
writeFileSync(
  "app/style.css",
  fontCSS +
    "\n" +
    interCSS +
    "\n:root{" +
    variables.join("") +
    "}\n" +
    utilities.join("\n") +
    "\n" +
    readFileSync("src/styles.css", "utf8") +
    "\n" +
    readFileSync("src/typography.css", "utf8") +
    "\n" +
    readFileSync("src/interactions.css", "utf8"),
);
