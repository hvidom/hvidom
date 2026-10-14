#!/usr/bin/env bun
// Static artwork for the profile README: header, neofetch terminal, featured project,
// tech stack and footer. Re-run after editing text here:  bun scripts/art.mjs
// (stats and the space-shooter game are refreshed daily by .github/workflows/profile.yml)

import { writeFileSync } from "node:fs";
import * as si from "simple-icons";
import { C, esc, FONT, GREENS, onDark, r1, rng, sky, svg, textWidth } from "./lib.mjs";

const out = (name, body) => {
	writeFileSync(new URL(`../assets/${name}`, import.meta.url), body);
	console.log(`assets/${name}  ${(body.length / 1024).toFixed(1)} KB`);
};

const pct = (t, T) => `${((t / T) * 100).toFixed(2)}%`;

/* ───────────────────────────── header ───────────────────────────── */

/** Typewriter that cycles through phrases (SMIL, discrete steps — no fonts measured at runtime). */
function typewriter(phrases, { x, y, size, slot, color }) {
	const cw = size * 0.6;
	const T = phrases.length * slot;
	const tracks = phrases.map((p, i) => {
		const n = [...p].length;
		const t0 = i * slot;
		const typeStep = 0.05;
		const ev = t0 > 0 ? [[0, 0]] : [];
		for (let k = 0; k <= n; k++) ev.push([t0 + k * typeStep, k * cw]);
		const tDel = t0 + slot - 0.75;
		const steps = Math.ceil(n / 3);
		for (let k = 1; k <= steps; k++) ev.push([tDel + k * 0.03, Math.max(0, n - k * 3) * cw]);
		return ev;
	});
	const anim = (attr, ev, base = 0) => {
		const keyTimes = ev.map(([t]) => (t / T).toFixed(4)).join(";");
		const values = ev.map(([, v]) => r1(base + v)).join(";");
		return `<animate attributeName="${attr}" dur="${T}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${keyTimes}" values="${values}"/>`;
	};
	let defs = "";
	let body = "";
	phrases.forEach((p, i) => {
		const still = i === 0 ? r1([...p].length * cw + 2) : 0;
		defs += `<clipPath id="type${i}"><rect x="${x}" y="${y - size}" height="${size * 1.5}" width="${still}">${anim("width", tracks[i])}</rect></clipPath>`;
		body += `<text x="${x}" y="${y}" font-family="${FONT.mono}" font-size="${size}" fill="${color}" textLength="${r1([...p].length * cw)}" lengthAdjust="spacing" clip-path="url(#type${i})">${esc(p)}</text>`;
	});
	const cursorEv = tracks.flatMap((ev, i) => (i === 0 ? ev : ev.slice(1))).sort((a, b) => a[0] - b[0]);
	body += `<rect class="blink" x="${x}" y="${y - size + 3}" width="${r1(size * 0.55)}" height="${size + 3}" rx="2" fill="${color}">${anim("x", cursorEv, x)}</rect>`;
	return { defs, body };
}

/** Pixel sprite from an ASCII map. */
function sprite(map, palette, { x, y, px }) {
	let s = "";
	map.forEach((row, ry) => {
		[...row].forEach((ch, rx) => {
			if (palette[ch]) s += `<rect x="${x + rx * px}" y="${y + ry * px}" width="${px}" height="${px}" fill="${palette[ch]}"/>`;
		});
	});
	return s;
}

const SHIP = ["...X...", "..XXX..", "..XCX..", "X.XXX.X", "XXXXXXX", "X.X.X.X"];

/** A tiny looping space-shooter: a contribution grid, a ship, bolts and pops. */
function miniShooter({ ox, oy, cols, rows, cell, gap, shipY, seed }) {
	const r = rng(seed);
	const pitch = cell + gap;
	const T = 9;
	const shotCols = [1, 6, 3, 8, 4];
	const lvl = [];
	for (let c = 0; c < cols; c++) {
		lvl[c] = [];
		for (let k = 0; k < rows; k++) lvl[c][k] = r() < 0.24 ? 0 : 1 + Math.floor(r() * 4);
	}
	for (const c of shotCols) lvl[c][rows - 1] = Math.max(2, lvl[c][rows - 1]);
	const colX = (c) => ox + c * pitch + cell / 2;
	const shots = shotCols.map((col, k) => ({ col, row: rows - 1, t: 0.8 + k * 1.6 }));

	let css = "";
	let body = "";
	// grid
	for (let c = 0; c < cols; c++) {
		for (let k = 0; k < rows; k++) {
			const hit = shots.findIndex((s) => s.col === c && s.row === k);
			const cls = hit >= 0 ? ` class="cell${hit}"` : "";
			body += `<rect${cls} x="${ox + c * pitch}" y="${oy + k * pitch}" width="${cell}" height="${cell}" rx="4" fill="${GREENS[lvl[c][k]]}"/>`;
		}
	}
	// bolts, pops, cell flashes
	shots.forEach((s, k) => {
		const cx = colX(s.col);
		const targetY = oy + s.row * pitch + cell / 2;
		const start = shipY - 30;
		const dist = start - targetY;
		const hit = s.t + 0.42;
		const color = GREENS[lvl[s.col][s.row]];
		body += `<rect class="bolt${k}" x="${cx - 1.5}" y="${start}" width="3" height="12" rx="1.5" fill="${C.gold}" opacity="0"/>`;
		body += `<circle class="pop${k}" cx="${cx}" cy="${targetY}" r="4" stroke="${C.gold}" stroke-width="1.5" opacity="0"/>`;
		css += `.bolt${k}{animation:bolt${k} ${T}s linear infinite}
@keyframes bolt${k}{0%,${pct(s.t - 0.01, T)}{opacity:0;transform:translateY(0)}${pct(s.t, T)}{opacity:1;transform:translateY(0)}${pct(hit, T)}{opacity:1;transform:translateY(-${r1(dist)}px)}${pct(hit + 0.02, T)},100%{opacity:0;transform:translateY(-${r1(dist)}px)}}
.pop${k}{animation:pop${k} ${T}s ease-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes pop${k}{0%,${pct(hit - 0.01, T)}{opacity:0;transform:scale(1)}${pct(hit, T)}{opacity:1;transform:scale(1)}${pct(hit + 0.45, T)},100%{opacity:0;transform:scale(5)}}
.cell${k}{animation:cell${k} ${T}s linear infinite}
@keyframes cell${k}{0%,${pct(hit, T)}{opacity:1;fill:${color}}${pct(hit + 0.06, T)}{opacity:1;fill:#ffffff}${pct(hit + 0.3, T)},96%{opacity:0;fill:#ffffff}100%{opacity:1;fill:${color}}}
`;
	});
	// ship (drawn around x=0, moved with CSS)
	const stops = [[0, colX(shots[0].col)]];
	for (const s of shots) stops.push([s.t - 0.42, colX(s.col)], [s.t + 0.2, colX(s.col)]);
	stops.push([T, colX(shots[0].col)]);
	css += `.ship{animation:ship ${T}s ease-in-out infinite}
@keyframes ship{${stops.map(([t, x]) => `${pct(Math.max(0, t), T)}{transform:translateX(${r1(x)}px)}`).join("")}}
.flame{animation:flame .12s ease-in-out infinite alternate;transform-box:fill-box;transform-origin:50% 0}
@keyframes flame{to{transform:scaleY(.45)}}
`;
	const px = 4;
	const w = SHIP[0].length * px;
	const h = SHIP.length * px;
	body += `<g class="ship"><path class="flame" d="M-4 ${shipY + 1}h8l-4 9z" fill="${C.orange}"/>${sprite(SHIP, { X: C.blue, C: "#e0f2fe" }, { x: -w / 2, y: shipY - h, px })}</g>`;
	return { css, body };
}

function header() {
	const w = 1200;
	const h = 420;
	const panel = sky(w, h, 7, {
		avoid: [[60, 56, 700, 320], [780, 60, 280, 160]],
		nebulae: [
			[930, 60, 420, 260, C.violet, 0.28],
			[150, 430, 460, 260, C.cyan, 0.16],
			[1150, 400, 260, 160, C.pink, 0.14],
		],
	});
	const phrases = [
		"shipping TypeScript from DB to UI",
		"building CRMs that actually sell",
		"teaching AI agents the night shift",
		"15+ years of code, servers & sales",
	];
	const tw = typewriter(phrases, { x: 144, y: 301, size: 24, slot: 4.6, color: C.cyan });
	const game = miniShooter({ ox: 792, oy: 74, cols: 10, rows: 5, cell: 20, gap: 6, shipY: 330, seed: 42 });

	const chips = ["TypeScript", "Bun", "Hono", "React", "Astro", "Postgres", "Cloudflare"];
	let cx = 72;
	let chipSvg = "";
	for (const c of chips) {
		const cw = textWidth(c, 15, { mono: true }) + 26;
		chipSvg += `<rect x="${r1(cx)}" y="336" width="${r1(cw)}" height="32" rx="16" fill="rgba(255,255,255,0.04)" stroke="${C.line}"/><text x="${r1(cx + 13)}" y="357" font-family="${FONT.mono}" font-size="15" fill="${C.muted}">${c}</text>`;
		cx += cw + 8;
	}

	const defs = `${panel.defs}
<linearGradient id="name" gradientUnits="userSpaceOnUse" x1="72" y1="0" x2="660" y2="0" spreadMethod="reflect">
<stop offset="0" stop-color="#e0f2fe"/><stop offset=".35" stop-color="${C.cyan}"/><stop offset=".7" stop-color="${C.violet}"/><stop offset="1" stop-color="${C.pink}"/>
<animateTransform attributeName="gradientTransform" type="translate" values="0 0;220 0;0 0" dur="9s" repeatCount="indefinite"/>
</linearGradient>
<radialGradient id="planetFill" cx=".5" cy="0" r=".9"><stop offset="0" stop-color="#1a2456"/><stop offset=".25" stop-color="#0b1130"/><stop offset="1" stop-color="${C.bg0}"/></radialGradient>
<linearGradient id="rim" x1="0" x2="1"><stop offset="0" stop-color="${C.cyan}" stop-opacity="0"/><stop offset=".5" stop-color="${C.cyan}" stop-opacity=".9"/><stop offset=".75" stop-color="${C.violet}" stop-opacity=".7"/><stop offset="1" stop-color="${C.violet}" stop-opacity="0"/></linearGradient>
<radialGradient id="moon" cx=".35" cy=".3"><stop offset="0" stop-color="#c4b5fd"/><stop offset=".55" stop-color="#6d28d9"/><stop offset="1" stop-color="#1e1b4b"/></radialGradient>
<linearGradient id="meteor" x1="1" x2="0"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
${tw.defs}`;

	const css = `${game.css}
.meteor{animation:meteor 7s linear infinite}
@keyframes meteor{0%{opacity:0;transform:translate(260px,-30px)}2%{opacity:1}11%{opacity:0;transform:translate(700px,110px)}100%{opacity:0;transform:translate(700px,110px)}}
`;

	const body = `${panel.open}
<circle cx="600" cy="1610" r="1240" fill="url(#planetFill)" stroke="url(#rim)" stroke-width="2"/>
<circle cx="600" cy="1610" r="1252" stroke="${C.cyan}" stroke-opacity=".08" stroke-width="18"/>
<g class="meteor"><line x1="0" y1="0" x2="-110" y2="-30" stroke="url(#meteor)" stroke-width="2" stroke-linecap="round"/></g>

<g transform="translate(1112 116)">
<ellipse rx="52" ry="12" transform="rotate(-18)" stroke="${C.violet}" stroke-opacity=".5" stroke-width="2"/>
<circle r="28" fill="url(#moon)"/>
<path d="M-52 0A52 12 0 0 0 52 0" transform="rotate(-18)" stroke="${C.violet}" stroke-opacity=".8" stroke-width="2" fill="none"/>
</g>

<rect x="72" y="62" width="340" height="36" rx="18" fill="rgba(57,211,83,0.10)" stroke="rgba(57,211,83,0.35)"/>
<circle cx="94" cy="80" r="4.5" fill="${C.green}"/><circle class="pulse" cx="94" cy="80" r="4.5" fill="${C.green}"/>
<text x="110" y="86" font-family="${FONT.mono}" font-size="15" letter-spacing="1.5" fill="#a7f3d0" textLength="250" lengthAdjust="spacing">BASED IN DUBLIN, IRELAND</text>
<g transform="translate(372 73)"><rect width="9" height="14" fill="#169b62"/><rect x="9" width="9" height="14" fill="#ffffff"/><rect x="18" width="9" height="14" fill="#ff883e"/></g>

<text x="68" y="184" font-family="${FONT.sans}" font-size="82" font-weight="800" letter-spacing="-2" fill="url(#name)">Hryhorii Ilin</text>
<text x="72" y="232" font-family="${FONT.sans}" font-size="25" fill="${C.muted}">Full-stack developer <tspan fill="${C.dim}">·</tspan> infrastructure tinkerer <tspan fill="${C.dim}">·</tspan> ex-sales director</text>

<rect x="60" y="268" width="620" height="48" rx="12" fill="rgba(255,255,255,0.035)" stroke="${C.line}"/>
<text x="78" y="301" font-family="${FONT.mono}" font-size="24"><tspan fill="${C.violet}">~</tspan><tspan fill="${C.green}"> $</tspan></text>
${tw.body}
${chipSvg}
${game.body}
${panel.close}`;
	return svg(w, h, body, {
		title: "Hryhorii Ilin — @hvidom",
		desc: "Full-stack developer, infrastructure tinkerer and ex-sales director based in Dublin, Ireland. A tiny spaceship shoots contribution squares on the right.",
		css,
		defs,
	});
}

/* ──────────────────────────── terminal ──────────────────────────── */

const ASTRONAUT = [
	".....OOOOOO.....",
	"...OOWWWWWWOO...",
	"..OWWWWWWWWWWO..",
	".OWWWWWWWWWWWWO.",
	".OWWVVVVVVVVWWO.",
	"OWWVVVVVVVVVVWWO",
	"OWWVCCVVVVVVVWWO",
	"OWWVCVVVVVVVVWWO",
	"OWWVVVVVVVVPVWWO",
	"OWWVVVVVVVVVVWWO",
	".OWWVVVVVVVVWWO.",
	".OWWWWWWWWWWWWO.",
	"..OGWWWWWWWWGO..",
	"...OGGGGGGGGO...",
	"..OWWWWWWWWWWO..",
	".OWWWRRWWBBWWWO.",
	".OWWWWWWWWWWWWO.",
]

function terminal() {
	const w = 1200;
	const lh = 31;
	const size = 19;
	const x0 = 40;
	const cw = size * 0.6;
	let y = 44 + 40;
	let t = 0.4;
	let body = "";
	let defs = "";
	let clip = 0;

	const prompt = (yy) =>
		`<tspan fill="${C.cyan}">hvidom</tspan><tspan fill="${C.dim}">@</tspan><tspan fill="${C.violet}">dublin</tspan><tspan fill="${C.dim}"> ~ </tspan><tspan fill="${C.green}">$ </tspan>`;
	const promptLen = "hvidom@dublin ~ $ ".length;

	// A typed command: prompt appears, command types itself, then output follows.
	const command = (cmd) => {
		const id = `cmd${clip++}`;
		const n = cmd.length;
		const cx = x0 + promptLen * cw;
		body += `<g class="r" style="animation-delay:${t.toFixed(2)}s"><text x="${x0}" y="${y}" font-family="${FONT.mono}" font-size="${size}">${prompt(y)}</text></g>`;
		const step = 0.06;
		// Width animates from t=0 (held at 0 until typing starts); without SMIL the full command stays visible.
		const start = t + 0.35;
		const end = start + n * step;
		const keyTimes = ["0", ...Array.from({ length: n + 1 }, (_, k) => ((start + k * step) / end).toFixed(4))];
		const values = ["0", ...Array.from({ length: n + 1 }, (_, k) => r1(k * cw))];
		defs += `<clipPath id="${id}"><rect x="${cx}" y="${y - size}" height="${size * 1.5}" width="${r1(n * cw + 2)}"><animate attributeName="width" dur="${end.toFixed(2)}s" calcMode="discrete" keyTimes="${keyTimes.join(";")}" values="${values.join(";")}" fill="freeze"/></rect></clipPath>`;
		body += `<text x="${cx}" y="${y}" font-family="${FONT.mono}" font-size="${size}" fill="${C.ink}" clip-path="url(#${id})" textLength="${r1(n * cw)}" lengthAdjust="spacing">${esc(cmd)}</text>`;
		t += 0.35 + n * step + 0.35;
		y += lh;
	};
	const reveal = (inner) => {
		body += `<g class="r" style="animation-delay:${t.toFixed(2)}s">${inner}</g>`;
		t += 0.07;
	};

	// ── neofetch
	command("neofetch");
	const artTop = y - 10;
	const px = 14;
	const artX = x0 + 8;
	const infoX = artX + ASTRONAUT[0].length * px + 56;
	reveal(
		sprite(
			ASTRONAUT,
			{ O: "#3b4664", W: "#e6edf3", G: "#9aa7bd", V: "#0b1130", C: C.cyan, P: C.violet, R: "#ef4444", B: C.blue },
			{ x: artX, y: artTop + 6, px },
		),
	);
	const keyW = 11 * cw;
	const info = [
		["Name", "Hryhorii Ilin · @hvidom"],
		["Role", "Full-stack developer · ex-sales director"],
		["Location", "Dublin, Ireland · originally from Ukraine"],
		["Uptime", "15+ years in tech — code, servers, sales"],
		["Stack", "TypeScript · Bun · Hono · React · Astro · Postgres"],
		["Infra", "Cloudflare · Docker · Coolify · Oracle · Hetzner"],
		["AI", "Claude · Vercel AI SDK · MCP · agents & skills"],
		["Editor", "VS Code + Claude Code"],
		["Learning", "Software Development course — Python, C#"],
		["Into", "open source · startups · psychology of sales"],
		["Motto", "“Ship it to production. Then sell it.”"],
	];
	let iy = y;
	reveal(
		`<text x="${infoX}" y="${iy}" font-family="${FONT.mono}" font-size="${size}" font-weight="700"><tspan fill="${C.cyan}">hvidom</tspan><tspan fill="${C.ink}">@</tspan><tspan fill="${C.violet}">dublin</tspan></text>`,
	);
	iy += lh;
	reveal(`<rect x="${infoX}" y="${iy - 12}" width="${r1(13 * cw)}" height="2" fill="${C.dim}"/>`);
	iy += lh - 6;
	const keyColors = [C.cyan, C.cyan, C.cyan, C.violet, C.violet, C.violet, C.pink, C.pink, C.green, C.green, C.gold];
	info.forEach(([k, v], i) => {
		reveal(
			`<text x="${infoX}" y="${iy}" font-family="${FONT.mono}" font-size="${size}"><tspan fill="${keyColors[i]}" font-weight="700">${esc(k)}</tspan></text><text x="${r1(infoX + keyW)}" y="${iy}" font-family="${FONT.mono}" font-size="${size}" fill="${C.ink}">${esc(v)}</text>`,
		);
		iy += lh;
	});
	// colour blocks
	const blocks = ["#1f2937", "#ef4444", C.green, C.gold, C.blue, C.violet, C.cyan, C.ink];
	reveal(
		blocks
			.map((c, i) => `<rect x="${r1(infoX + i * 36)}" y="${iy - 10}" width="36" height="20" fill="${c}"/>`)
			.join(""),
	);
	iy += lh;
	y = Math.max(iy, artTop + ASTRONAUT.length * px + 20) + 14;

	// ── journey
	command("cat ~/journey.log");
	const journey = [
		["2011", "Linux & infrastructure", "hardened servers · firewalls · Docker · Cloudflare", C.green],
		["2015", "Full-stack developer", "React · Vue · Next.js · Node · PostgreSQL · CI/CD", C.cyan],
		["2020", "Sales director", "CRM automation · coached 30+ sales agents", C.violet],
		["2026", "All three at once", "Content Factory — CRM, inbox, CMS & AI in one platform", C.pink],
	];
	for (const [yr, role, what, color] of journey) {
		reveal(
			`<text y="${y}" font-family="${FONT.mono}" font-size="${size}"><tspan x="${x0}" fill="${color}" font-weight="700">${yr}</tspan><tspan x="${r1(x0 + 6 * cw)}" fill="${C.dim}">→</tspan><tspan x="${r1(x0 + 9 * cw)}" fill="${C.ink}">${esc(role)}</tspan><tspan x="${r1(x0 + 33 * cw)}" fill="${C.muted}">${esc(what)}</tspan></text>`,
		);
		t += 0.12;
		y += lh;
	}
	y += 8;
	// idle prompt with blinking cursor
	reveal(
		`<text x="${x0}" y="${y}" font-family="${FONT.mono}" font-size="${size}">${prompt(y)}</text><rect class="blink" x="${r1(x0 + promptLen * cw)}" y="${y - size + 2}" width="${r1(cw)}" height="${size + 3}" fill="${C.ink}"/>`,
	);
	const h = y + 30;

	const css = `.r{animation:reveal .01s linear backwards}
@keyframes reveal{from{opacity:0}to{opacity:1}}`;
	const panel = sky(w, h, 11, {
		radius: 16,
		avoid: [[0, 0, w, 50], [30, 60, 900, h - 60]],
		starCount: 70,
		nebulae: [
			[1050, 120, 380, 220, C.violet, 0.16],
			[1100, h, 320, 200, C.cyan, 0.1],
		],
	});
	const chrome = `<rect width="${w}" height="44" fill="rgba(255,255,255,0.03)"/><rect y="44" width="${w}" height="1" fill="${C.line}"/>
<circle cx="26" cy="22" r="6.5" fill="#ff5f57"/><circle cx="48" cy="22" r="6.5" fill="#febc2e"/><circle cx="70" cy="22" r="6.5" fill="#28c840"/>
<text x="${w / 2}" y="28" text-anchor="middle" font-family="${FONT.mono}" font-size="15" fill="${C.dim}">hvidom@dublin: ~ — zsh — 120×${Math.round(h / lh)}</text>`;
	return svg(w, h, `${panel.open}${chrome}${body}${panel.close}`, {
		title: "hvidom@dublin — neofetch",
		desc: "Terminal: Hryhorii Ilin, full-stack developer and ex-sales director in Dublin. Stack: TypeScript, Bun, Hono, React, Astro, Postgres, Cloudflare. Journey: 2011 Linux and infrastructure, 2015 full-stack developer, 2020 sales director, 2026 building Content Factory.",
		defs: `${panel.defs}${defs}`,
		css,
	});
}

/* ──────────────────────── featured project ──────────────────────── */

const GLYPH = {
	funnel: "M3 4h18l-7 8.2V18l-4 2.2v-8z",
	box: "M12 2 3 6.5v11L12 22l9-4.5v-11zm0 2.3 6.3 3.2L12 10.7 5.7 7.5zM5 9.1l6 3v7.5l-6-3zm8 10.6v-7.5l6-3v7.5z",
	oracle:
		"M7.2 5.5h9.6a6.5 6.5 0 0 1 0 13H7.2a6.5 6.5 0 0 1 0-13zm.1 2.6a3.9 3.9 0 0 0 0 7.8h9.4a3.9 3.9 0 0 0 0-7.8z",
	playwright: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-2 6 6 4-6 4z",
	shield: "M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5zm-1 13.6-3.6-3.6 1.4-1.4 2.2 2.2 4.8-4.8 1.4 1.4z",
};

const icon = (key) => {
	if (GLYPH[key]) return { path: GLYPH[key], hex: null };
	const s = si[key];
	if (!s) throw new Error(`simple-icons: ${key} not found`);
	return { path: s.path, hex: `#${s.hex}`, title: s.title };
};

function iconAt(key, x, y, size, color) {
	const ic = icon(key);
	const fill = color ?? onDark(ic.hex ?? C.ink);
	return `<g transform="translate(${r1(x)} ${r1(y)}) scale(${(size / 24).toFixed(4)})"><path fill="${fill}" fill-rule="evenodd" d="${ic.path}"/></g>`;
}

function project() {
	const w = 1200;
	const h = 830;
	const panel = sky(w, h, 23, {
		nebulae: [
			[1060, 0, 520, 280, C.violet, 0.22],
			[0, h, 520, 300, C.cyan, 0.12],
		],
		starCount: 120,
		avoid: [[40, 30, 1000, 160], [40, 196, 1120, 560], [40, 740, 1120, 70]],
	});
	let body = panel.open;
	body += `<rect width="${w}" height="${h}" fill="url(#grid)"/>`;

	const pill = (x, y, label, color, dot = false) => {
		const tw = textWidth(label, 14, { mono: true });
		const pw = tw + 28 + (dot ? 18 : 0);
		let s = `<rect x="${x}" y="${y}" width="${r1(pw)}" height="32" rx="16" fill="${color}" fill-opacity=".1" stroke="${color}" stroke-opacity=".4"/>`;
		if (dot)
			s += `<circle cx="${x + 18}" cy="${y + 16}" r="4" fill="${color}"/><circle class="pulse" cx="${x + 18}" cy="${y + 16}" r="4" fill="${color}"/>`;
		s += `<text x="${r1(x + 14 + (dot ? 18 : 0))}" y="${y + 21}" font-family="${FONT.mono}" font-size="14" letter-spacing="1" fill="${color}" textLength="${r1(tw)}" lengthAdjust="spacing">${esc(label)}</text>`;
		return { s, w: pw };
	};
	const p1 = pill(48, 44, "FEATURED PROJECT", C.cyan);
	const p2 = pill(48 + p1.w + 10, 44, "PRIVATE · LIVE IN PRODUCTION", C.green, true);
	body += p1.s + p2.s;

	body += `<text x="45" y="134" font-family="${FONT.sans}" font-size="58" font-weight="800" letter-spacing="-1.5" fill="url(#cfTitle)">Content Factory</text>`;
	body += `<text x="48" y="174" font-family="${FONT.sans}" font-size="23" fill="${C.muted}">The operating system of a car-electronics business in Dublin, in one Bun + TypeScript monorepo.</text>`;

	const metrics = [
		["340k+", "lines of TypeScript"],
		["131", "DB migrations"],
		["230", "test suites"],
		["80", "API route modules"],
		["35", "background jobs"],
	];
	const mw = (w - 96 - 4 * 12) / 5;
	metrics.forEach(([v, l], i) => {
		const x = 48 + i * (mw + 12);
		body += `<rect x="${r1(x)}" y="202" width="${r1(mw)}" height="100" rx="16" fill="${C.tile}" fill-opacity=".92" stroke="${C.line}"/>`;
		body += `<text x="${r1(x + 22)}" y="252" font-family="${FONT.sans}" font-size="40" font-weight="800" fill="${i % 2 ? C.violet : C.cyan}">${v}</text>`;
		body += `<text x="${r1(x + 22)}" y="281" font-family="${FONT.sans}" font-size="17" fill="${C.muted}">${l}</text>`;
	});

	const modules = [
		["siWhatsapp", "Omnichannel inbox", "WhatsApp, Messenger, Instagram, email, web chat"],
		["funnel", "CRM & sales", "Leads → deals → jobs, price calculator, quotes", C.cyan],
		["siClaude", "AI agent “Merlin”", "Night-shift replies, n8n-style skills, MCP"],
		["siAstro", "Website CMS on Git", "Edits radioking.ie, deploys to Cloudflare"],
		["box", "Warehouse & supply", "Kits, stock moves, purchasing, returns, fleet", C.gold],
		["siStripe", "Payments & documents", "Stripe, deposits, reminders, quotes, invoices"],
		["siGoogleanalytics", "Marketing analytics", "GA4, Search Console, Google Ads, DataForSEO"],
		["siOpentelemetry", "Ops & security", "OpenTelemetry → Grafana, RBAC, 2FA, audit, backups", C.violet],
	];
	const gw = (w - 96 - 12) / 2;
	const gh = 96;
	modules.forEach(([ic, title, line, color], i) => {
		const x = 48 + (i % 2) * (gw + 12);
		const y = 322 + Math.floor(i / 2) * (gh + 12);
		const accent = color ?? onDark(icon(ic).hex ?? C.ink);
		body += `<rect x="${r1(x)}" y="${y}" width="${r1(gw)}" height="${gh}" rx="16" fill="${C.tile}" fill-opacity=".92" stroke="${C.line}"/>`;
		body += `<rect x="${r1(x + 22)}" y="${y + 24}" width="48" height="48" rx="13" fill="${accent}" fill-opacity=".12" stroke="${accent}" stroke-opacity=".35"/>`;
		body += iconAt(ic, x + 32, y + 34, 28, accent);
		body += `<text x="${r1(x + 90)}" y="${y + 43}" font-family="${FONT.sans}" font-size="21" font-weight="700" fill="${C.ink}">${esc(title)}</text>`;
		body += `<text x="${r1(x + 90)}" y="${y + 71}" font-family="${FONT.sans}" font-size="17" fill="${C.muted}">${esc(line)}</text>`;
	});

	const stack = [
		"Bun · Hono · React 19 · TanStack Router & Query · Tailwind v4 · shadcn/ui · Drizzle",
		"PostgreSQL 18 · Plate · Excalidraw · Vercel AI SDK · OpenTelemetry · Docker on Coolify",
	];
	body += `<rect x="48" y="${h - 92}" width="${w - 96}" height="1" fill="${C.line}"/>`;
	stack.forEach((ln, i) => {
		body += `<text x="48" y="${h - 58 + i * 28}" font-family="${FONT.mono}" font-size="16" fill="${C.dim}">${esc(ln)}</text>`;
	});
	body += panel.close;

	const defs = `${panel.defs}
<pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0v40" stroke="#ffffff" stroke-opacity=".035"/></pattern>
<linearGradient id="cfTitle" gradientUnits="userSpaceOnUse" x1="48" x2="520" y1="0" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="${C.cyan}"/><stop offset="1" stop-color="${C.violet}"/></linearGradient>`;
	return svg(w, h, body, {
		title: "Content Factory — featured project",
		desc: "Private TypeScript platform in production: omnichannel inbox, CRM and sales, AI agent Merlin, Git-backed website CMS, warehouse, payments, marketing analytics, ops and security. 340k+ lines of TypeScript, 131 database migrations, 230 test suites, 80 API route modules, 35 background jobs.",
		defs,
	});
}

/* ─────────────────────────── tech stack ─────────────────────────── */

const STACK = [
	["Languages", C.cyan, ["siTypescript", "siJavascript", "siPython", "siGnubash", "siHtml5", "siCss"]],
	[
		"Frontend",
		C.violet,
		["siReact", "siVuedotjs", "siSvelte", "siAstro", "siNextdotjs", "siNuxt", "siTailwindcss", "siShadcnui", "siTanstack", "siVite"],
	],
	[
		"Backend & data",
		C.green,
		["siBun", "siNodedotjs", "siHono", "siExpress", "siPostgresql", "siDrizzle", "siRedis", "siMongodb", "siSqlite"],
	],
	[
		"Cloud & DevOps",
		C.gold,
		[
			"siCloudflare",
			"siCloudflareworkers",
			"siDocker",
			"siCoolify",
			"siLinux",
			"siUbuntu",
			["oracle", "Oracle Cloud", "#F80000"],
			"siHetzner",
			"siVercel",
			"siGithubactions",
			"siGrafana",
			"siOpentelemetry",
		],
	],
	[
		"AI & APIs",
		C.pink,
		["siClaude", "siStripe", "siWhatsapp", "siMeta", "siGoogleanalytics", "siGoogleads", "siGooglesearchconsole", "siBrevo"],
	],
	[
		"Tooling",
		C.blue,
		["siGit", "siGithub", "siBiome", "siVitest", ["playwright", "Playwright", "#2EAD33"], "siTurborepo", "siExcalidraw"],
	],
];

function stack() {
	const w = 1200;
	const x0 = 48;
	const maxX = w - 48;
	const ph = 50;
	const gap = 12;
	let y = 84;
	let body = "";
	let n = 0;
	for (const [label, color, items] of STACK) {
		body += `<rect x="${x0}" y="${y}" width="4" height="20" rx="2" fill="${color}"/>`;
		body += `<text x="${x0 + 16}" y="${y + 16}" font-family="${FONT.mono}" font-size="16" letter-spacing="1.5" fill="${color}" font-weight="700">${esc(label.toUpperCase())}</text>`;
		y += 34;
		let x = x0;
		for (const it of items) {
			const [key, title, hex] = Array.isArray(it) ? it : [it, icon(it).title, icon(it).hex];
			const tw = textWidth(title, 19);
			const pw = 18 + 26 + 12 + tw + 22;
			if (x + pw > maxX) {
				x = x0;
				y += ph + gap;
			}
			const brand = onDark(hex);
			body += `<g class="pill" style="animation-delay:${(0.1 + n * 0.03).toFixed(2)}s">`;
			body += `<rect x="${r1(x)}" y="${y}" width="${r1(pw)}" height="${ph}" rx="${ph / 2}" fill="${C.tile}" fill-opacity=".9" stroke="${brand}" stroke-opacity=".3"/>`;
			body += iconAt(key, x + 18, y + 12, 26, brand);
			body += `<text x="${r1(x + 56)}" y="${y + 32}" font-family="${FONT.sans}" font-size="19" fill="${C.ink}">${esc(title)}</text></g>`;
			x += pw + gap;
			n++;
		}
		y += ph + 30;
	}
	const h = y;
	const css = `.pill{animation:rise .5s ease-out backwards}
@keyframes rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`;
	const panel = sky(w, h, 31, {
		starCount: 90,
		avoid: [[40, 30, 1120, 40], [40, 76, 1120, h - 90]],
		nebulae: [
			[1100, 0, 420, 200, C.violet, 0.16],
			[0, h, 420, 240, C.cyan, 0.1],
		],
	});
	const title = `<text x="48" y="54" font-family="${FONT.mono}" font-size="16" fill="${C.dim}">// used in production, not just in tutorials</text>`;
	return svg(w, h, `${panel.open}${title}${body}${panel.close}`, {
		title: "Tech stack",
		desc: `Languages, frontend, backend and data, cloud and DevOps, AI and APIs, tooling: ${STACK.flatMap(([, , items]) => items.map((it) => (Array.isArray(it) ? it[1] : icon(it).title))).join(", ")}.`,
		defs: panel.defs,
		css,
	});
}

/* ───────────────────────────── footer ───────────────────────────── */

function footer() {
	const w = 1200;
	const h = 200;
	const panel = sky(w, h, 53, {
		avoid: [[240, 36, 720, 90]],
		nebulae: [
			[600, 260, 520, 170, C.violet, 0.3],
			[200, 0, 300, 120, C.cyan, 0.12],
		],
		starCount: 70,
	});
	const px = 3;
	const shipW = SHIP[0].length * px;
	const css = `.fly{animation:fly 11s linear infinite}
@keyframes fly{from{transform:translate(-80px,0)}to{transform:translate(${w + 80}px,0)}}`;
	const body = `${panel.open}
<circle cx="600" cy="1365" r="1200" fill="url(#planet2)" stroke="url(#rim2)" stroke-width="2"/>
<text x="600" y="76" text-anchor="middle" font-family="${FONT.sans}" font-size="36" font-weight="800" fill="url(#bye)">Thanks for flying by</text>
<text x="600" y="110" text-anchor="middle" font-family="${FONT.mono}" font-size="17" fill="${C.muted}">built in Dublin · refreshed daily by GitHub Actions · see you in the commits</text>
<g class="fly"><g transform="rotate(90 0 146)"><path d="M-3 147h6l-3 7z" fill="${C.orange}" opacity=".9"/>${sprite(SHIP, { X: C.blue, C: "#e0f2fe" }, { x: -shipW / 2, y: 146 - SHIP.length * px, px })}</g><line x1="-12" y1="146" x2="-70" y2="146" stroke="url(#trail)" stroke-width="2"/></g>
${panel.close}`;
	const defs = `${panel.defs}
<radialGradient id="planet2" cx=".5" cy="0" r=".9"><stop offset="0" stop-color="#1c2560"/><stop offset=".2" stop-color="#0b1130"/><stop offset="1" stop-color="${C.bg0}"/></radialGradient>
<linearGradient id="rim2" x1="0" x2="1"><stop offset="0" stop-color="${C.violet}" stop-opacity="0"/><stop offset=".5" stop-color="${C.cyan}" stop-opacity=".9"/><stop offset="1" stop-color="${C.violet}" stop-opacity="0"/></linearGradient>
<linearGradient id="bye" gradientUnits="userSpaceOnUse" x1="440" x2="760"><stop offset="0" stop-color="${C.cyan}"/><stop offset=".5" stop-color="${C.violet}"/><stop offset="1" stop-color="${C.pink}"/></linearGradient>
<linearGradient id="trail" x1="0" x2="1"><stop offset="0" stop-color="${C.cyan}" stop-opacity=".8"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/></linearGradient>`;
	return svg(w, h, body, {
		title: "Thanks for flying by",
		desc: "Footer: a small spaceship flies across a planet horizon.",
		defs,
		css,
	});
}

out("header.svg", header());
out("terminal.svg", terminal());
out("content-factory.svg", project());
out("stack.svg", stack());
out("footer.svg", footer());
