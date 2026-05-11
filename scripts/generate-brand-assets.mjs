import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const outDir = path.resolve("assets/brand");

const markPath =
  "M 128.005 191.173 C 128.448 156.208 156.93 128 192 128 L 192 64 L 128 64 C 128 99.346 99.346 128 64 128 L 64 192 L 128 192 Z M 192 256 L 64 256 C 28.654 256 0 227.346 0 192 L 0 64 L 64 64 L 64 0 L 192 0 C 227.346 0 256 28.654 256 64 L 256 192 L 192 192 Z";

function logoSvg({ width, height, variant = "card", includeWordmark = true }) {
  const isCover = width > height * 2;
  const markSize = isCover ? 156 : includeWordmark ? 210 : 410;
  const markX = isCover ? 94 : includeWordmark ? 92 : (width - markSize) / 2;
  const markY = isCover ? (height - markSize) / 2 : includeWordmark ? 140 : (height - markSize) / 2;
  const wordX = isCover ? 292 : 332;
  const wordY = isCover ? height / 2 - 18 : 260;
  const subtitleY = isCover ? height / 2 + 42 : 330;
  const chipY = isCover ? height - 78 : height - 128;
  const bg = variant === "avatar" ? "#080b0f" : "#f6f2e8";
  const fg = variant === "avatar" ? "#f8f4e9" : "#0b0f14";
  const muted = variant === "avatar" ? "#a9b7c0" : "#53606a";
  const accent = "#d97706";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${width}" y2="${height}" gradientUnits="userSpaceOnUse">
      <stop stop-color="${bg}"/>
      <stop offset="0.52" stop-color="${variant === "avatar" ? "#101820" : "#fffaf0"}"/>
      <stop offset="1" stop-color="${variant === "avatar" ? "#17231c" : "#e9f5ea"}"/>
    </linearGradient>
    <linearGradient id="mark" x1="${markX}" y1="${markY}" x2="${markX + markSize}" y2="${markY + markSize}" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0b0f14"/>
      <stop offset="0.48" stop-color="#12201b"/>
      <stop offset="1" stop-color="${accent}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${width * 0.78} ${height * 0.18}) rotate(134) scale(${width * 0.42} ${height * 0.85})">
      <stop stop-color="#f59e0b" stop-opacity="0.38"/>
      <stop offset="1" stop-color="#f59e0b" stop-opacity="0"/>
    </radialGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#0b0f14" flood-opacity="${variant === "avatar" ? "0.45" : "0.16"}"/>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" rx="${Math.min(44, width * 0.05)}" fill="url(#bg)"/>
  <rect width="${width}" height="${height}" fill="url(#glow)"/>
  <path d="M ${width * 0.64} -40 C ${width * 0.82} ${height * 0.16} ${width * 0.62} ${height * 0.42} ${width + 60} ${height * 0.54}" stroke="${variant === "avatar" ? "#f8f4e9" : "#0b0f14"}" stroke-opacity="0.08" stroke-width="56" stroke-linecap="round"/>
  <path d="M ${width * 0.06} ${height * 0.86} C ${width * 0.28} ${height * 0.65} ${width * 0.44} ${height * 1.04} ${width * 0.78} ${height * 0.77}" stroke="${accent}" stroke-opacity="0.20" stroke-width="18" stroke-linecap="round"/>
  <g filter="url(#softShadow)">
    <rect x="${markX - 22}" y="${markY - 22}" width="${markSize + 44}" height="${markSize + 44}" rx="${markSize * 0.18}" fill="${variant === "avatar" ? "#f6f2e8" : "#ffffff"}" fill-opacity="${variant === "avatar" ? "0.08" : "0.72"}"/>
    <svg x="${markX}" y="${markY}" width="${markSize}" height="${markSize}" viewBox="0 0 256 256">
      <path d="${markPath}" fill="url(#mark)"/>
    </svg>
  </g>
  ${
    includeWordmark
      ? `<text x="${wordX}" y="${wordY}" font-family="Inter, Avenir, Helvetica, Arial, sans-serif" font-size="${isCover ? 88 : 112}" font-weight="800" letter-spacing="-0.075em" fill="${fg}">ArcPay</text>
  <text x="${wordX + 4}" y="${subtitleY}" font-family="Inter, Avenir, Helvetica, Arial, sans-serif" font-size="${isCover ? 27 : 34}" font-weight="600" letter-spacing="-0.02em" fill="${muted}">Policy-first payments for AI agents on Solana</text>
  <g transform="translate(${wordX + 4} ${chipY})">
    <rect width="${isCover ? 438 : 548}" height="48" rx="24" fill="${variant === "avatar" ? "#f8f4e9" : "#0b0f14"}"/>
    <text x="24" y="32" font-family="Inter, Avenir, Helvetica, Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="0.08em" fill="${variant === "avatar" ? "#0b0f14" : "#ffffff"}">PRIVATE TREASURY • X402 • DEFI</text>
  </g>`
      : ""
  }
</svg>`;
}

async function renderPng(name, svg) {
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(path.join(outDir, name));
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const assets = [
    ["arcpay-logo.svg", logoSvg({ width: 1024, height: 1024, variant: "card", includeWordmark: false })],
    ["arcpay-project-card.svg", logoSvg({ width: 1200, height: 630, variant: "card", includeWordmark: true })],
    ["arcpay-avatar.svg", logoSvg({ width: 800, height: 800, variant: "avatar", includeWordmark: false })],
    ["arcpay-x-cover.svg", logoSvg({ width: 1500, height: 500, variant: "cover", includeWordmark: true })],
    ["arcpay-linkedin-cover.svg", logoSvg({ width: 1584, height: 396, variant: "cover", includeWordmark: true })],
  ];

  for (const [name, svg] of assets) {
    await writeFile(path.join(outDir, name), svg);
    await renderPng(name.replace(/\.svg$/, ".png"), svg);
  }
}

await main();
