import path from "path";
import { fileURLToPath } from "url";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { getSettings } from "../storage/serverSettings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.join(__dirname, "..", "..", "assets", "fonts");
// Bundled so text renders on servers with no system fonts installed.
GlobalFonts.registerFromPath(path.join(FONT_DIR, "Poppins-Bold.ttf"), "PoppinsBold");
GlobalFonts.registerFromPath(path.join(FONT_DIR, "Poppins-Regular.ttf"), "Poppins");

const W = 1024;
const H = 400;

async function fetchImage(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return loadImage(Buffer.from(await res.arrayBuffer()));
}

function fitText(ctx, text, maxWidth, size, font) {
  let s = size;
  do { ctx.font = `${s}px ${font}`; s -= 2; } while (ctx.measureText(text).width > maxWidth && s > 16);
}

// Returns a PNG Buffer. Customise with settings: welcome_card_title, welcome_card_background (image URL), welcome_card_color (hex).
export async function renderWelcomeCard(member) {
  const settings = getSettings(member.guild.id);
  const title = (settings.welcome_card_title || "Welcome to {server}!").replace(/{server}/g, member.guild.name);
  const accent = /^#?[0-9a-f]{6}$/i.test(settings.welcome_card_color || "") ? `#${settings.welcome_card_color.replace("#", "")}` : "#7c5cff";

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Background: custom image if set, else a dark gradient
  let bgDrawn = false;
  if (settings.welcome_card_background) {
    try {
      const bg = await fetchImage(settings.welcome_card_background);
      const scale = Math.max(W / bg.width, H / bg.height);
      ctx.drawImage(bg, (W - bg.width * scale) / 2, (H - bg.height * scale) / 2, bg.width * scale, bg.height * scale);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, W, H);
      bgDrawn = true;
    } catch {}
  }
  if (!bgDrawn) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#0f1020");
    g.addColorStop(1, "#1d1840");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.15;
    ctx.beginPath(); ctx.arc(W - 80, 60, 220, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Accent border
  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  ctx.strokeRect(12, 12, W - 24, H - 24);

  // Avatar
  const cx = 200, cy = H / 2, r = 120;
  try {
    const avatar = await fetchImage(member.user.displayAvatarURL({ extension: "png", size: 256 }));
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
    ctx.drawImage(avatar, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  } catch {}
  ctx.strokeStyle = accent;
  ctx.lineWidth = 8;
  ctx.beginPath(); ctx.arc(cx, cy, r + 4, 0, Math.PI * 2); ctx.stroke();

  // Text
  const tx = 370, maxW = W - tx - 50;
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "alphabetic";
  fitText(ctx, title, maxW, 44, "PoppinsBold");
  ctx.fillText(title, tx, 165);

  ctx.fillStyle = accent;
  const name = member.displayName || member.user.username;
  fitText(ctx, name, maxW, 52, "PoppinsBold");
  ctx.fillText(name, tx, 235);

  ctx.fillStyle = "#c9c9d6";
  ctx.font = "28px Poppins";
  const sub = (settings.welcome_card_subtitle || "Member #{count} of {server}").replace(/{count}/g, member.guild.memberCount.toLocaleString()).replace(/{server}/g, member.guild.name);
  ctx.fillText(sub.slice(0, 60), tx, 290);

  return canvas.toBuffer("image/png");
}
