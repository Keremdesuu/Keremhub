import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Logo ve site ikonlarını üretir: src/app/icon.svg, apple-icon.png, public/icons/*.png
const mark = (pad = 0) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#0c1022"/>
  <g transform="translate(${pad} ${pad}) scale(${(64 - pad * 2) / 64})">
    <rect x="1" y="1" width="62" height="62" rx="16" fill="#141A33" stroke="#28305A" stroke-width="2"/>
    <rect x="14" y="14" width="9" height="36" rx="2.5" fill="#7A8CFF"/>
    <rect x="26" y="19" width="9" height="31" rx="2.5" fill="#B7C0FF"/>
    <rect x="38.2" y="16" width="9" height="34" rx="2.5" transform="rotate(14 42.7 33)" fill="#FFB547"/>
    <circle cx="51" cy="13" r="3" fill="#FFB547"/>
  </g>
</svg>`;

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect x="1" y="1" width="62" height="62" rx="16" fill="#141A33" stroke="#28305A" stroke-width="2"/>
  <rect x="14" y="14" width="9" height="36" rx="2.5" fill="#7A8CFF"/>
  <rect x="26" y="19" width="9" height="31" rx="2.5" fill="#B7C0FF"/>
  <rect x="38.2" y="16" width="9" height="34" rx="2.5" transform="rotate(14 42.7 33)" fill="#FFB547"/>
  <circle cx="51" cy="13" r="3" fill="#FFB547"/>
</svg>
`;

async function main() {
  const root = path.resolve(__dirname, "..");
  await fs.mkdir(path.join(root, "public/icons"), { recursive: true });
  await fs.writeFile(path.join(root, "src/app/icon.svg"), favicon);

  const png = (svg: string, size: number, out: string) =>
    sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png().toFile(out);

  await png(mark(6), 180, path.join(root, "src/app/apple-icon.png"));
  await png(mark(4), 192, path.join(root, "public/icons/icon-192.png"));
  await png(mark(4), 512, path.join(root, "public/icons/icon-512.png"));
  // Maskable: güvenli alan için daha geniş boşluk
  await png(mark(12), 512, path.join(root, "public/icons/icon-maskable-512.png"));
  console.log("İkonlar üretildi");
}

main();
