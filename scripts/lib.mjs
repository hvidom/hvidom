// Shared building blocks for the profile artwork: palette, fonts, text metrics,
// seeded randomness and the starfield background every card sits on.

export const FONT = {
	sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif",
	mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
};

export const C = {
	ink: "#e6edf3",
	muted: "#9aa7bd",
	dim: "#5b6780",
	line: "rgba(255,255,255,0.09)",
	cyan: "#22d3ee",
	violet: "#a78bfa",
	pink: "#f472b6",
	green: "#39d353",
	gold: "#fbbf24",
	blue: "#60a5fa",
	orange: "#fb923c",
	bg0: "#060914",
	bg1: "#0b1130",
	tile: "#0c1230",
};

// GitHub contribution greens, level 0..4 (level 0 is drawn as a faint cell on our dark sky).
export const GREENS = ["rgba(255,255,255,0.06)", "#0e4429", "#006d32", "#26a641", "#39d353"];

export const esc = (s) =>
	String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const r1 = (n) => Math.round(n * 10) / 10;

export function rng(seed) {
	let s = seed | 0;
	return () => {
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// Helvetica advance widths (1/1000 em) — close enough to SF / Segoe / Noto to size pills,
// and every label also gets textLength so it never spills out of its box.
const HELV =
	" 278!278\"355#556$556%889&667'191(333)333*389+584,278-333.278/278:278;278<584=584>584?556@1015A667B667C722D722E667F611G778H722I278J500K667L556M833N722O778P667Q778R722S667T611U722V667W944X667Y667Z611[278\\278]278^469_556`333a556b556c500d556e556f278g556h556i222j222k500l222m833n556o556p556q556r333s500t278u556v500w722x500y500z500{334|260}334~584";
const WIDTH = new Map();
for (const m of HELV.matchAll(/(.)(\d+)/gs)) WIDTH.set(m[1], Number(m[2]));
for (const d of "0123456789") WIDTH.set(d, 556);

export function textWidth(s, size, { bold = false, mono = false } = {}) {
	if (mono) return [...s].length * size * 0.6;
	let w = 0;
	for (const ch of s) w += WIDTH.get(ch) ?? 600;
	return (w / 1000) * size * (bold ? 1.07 : 1) * 1.03;
}

const BASE_CSS = `
.tw{animation:tw 3s ease-in-out infinite}
@keyframes tw{0%,100%{opacity:1}50%{opacity:.18}}
.blink{animation:blink 1.06s steps(1) infinite}
@keyframes blink{50%{opacity:0}}
.pulse{animation:pulse 2.4s ease-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes pulse{0%{opacity:.7;transform:scale(1)}100%{opacity:0;transform:scale(3.2)}}
@media (prefers-reduced-motion: reduce){*{animation:none!important}}
`;

export function svg(w, h, body, { title, desc, css = "", defs = "" }) {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" role="img" aria-labelledby="title desc">
<title id="title">${esc(title)}</title>
<desc id="desc">${esc(desc)}</desc>
<style>${BASE_CSS}${css}</style>
<defs>${defs}</defs>
${body}
</svg>
`;
}

export function stars(w, h, n, seed, avoid = []) {
	const r = rng(seed);
	let out = "";
	const free = (x, y) => !avoid.some(([ax, ay, aw, ah]) => x > ax - 12 && x < ax + aw + 12 && y > ay - 12 && y < ay + ah + 12);
	for (let i = 0; i < n; i++) {
		const x = r() * w;
		const y = r() * h;
		const s = r();
		if (!free(x, y)) continue;
		const rad = s < 0.72 ? 0.45 + r() * 0.45 : s < 0.95 ? 0.9 + r() * 0.5 : 1.4 + r() * 0.5;
		const op = 0.3 + r() * 0.7;
		const twinkle = r() < 0.45;
		const anim = twinkle
			? ` class="tw" style="animation-duration:${(2 + r() * 4).toFixed(1)}s;animation-delay:-${(r() * 5).toFixed(1)}s"`
			: "";
		out += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(rad)}" fill="#fff" fill-opacity="${op.toFixed(2)}"${anim}/>`;
	}
	// A few bright four-point sparkles.
	const tints = [C.cyan, C.violet, "#ffffff", C.pink];
	for (let i = 0, tries = 0; i < Math.max(2, Math.round(n / 60)) && tries < 200; tries++) {
		const x = r1(r() * w);
		const y = r1(r() * h);
		if (!free(x, y)) continue;
		const k = 0.6 + r() * 0.7;
		i++;
		out += `<path class="tw" style="animation-duration:${(3 + r() * 3).toFixed(1)}s;animation-delay:-${(r() * 4).toFixed(1)}s" transform="translate(${x} ${y}) scale(${k.toFixed(2)})" d="M0-7L1.3-1.3 7 0 1.3 1.3 0 7-1.3 1.3-7 0-1.3-1.3Z" fill="${tints[i % tints.length]}"/>`;
	}
	return out;
}

/**
 * Rounded dark-sky panel: gradient, soft nebulae, stars and a hairline border.
 * Returns { defs, open, close } — draw your content between open and close.
 */
export function sky(w, h, seed, { radius = 24, nebulae = [], starCount = Math.round((w * h) / 4200), avoid = [] } = {}) {
	let defs = `<linearGradient id="sky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.bg1}"/><stop offset="1" stop-color="${C.bg0}"/></linearGradient>
<clipPath id="panel"><rect width="${w}" height="${h}" rx="${radius}"/></clipPath>`;
	let neb = "";
	nebulae.forEach(([cx, cy, rx, ry, color, op], i) => {
		defs += `<radialGradient id="neb${i}"><stop offset="0" stop-color="${color}" stop-opacity="${op}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
		neb += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#neb${i})"/>`;
	});
	const open = `<g clip-path="url(#panel)"><rect width="${w}" height="${h}" fill="url(#sky)"/>${neb}${stars(w, h, starCount, seed, avoid)}`;
	const close = `</g><rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="${radius - 0.5}" stroke="${C.line}"/>`;
	return { defs, open, close };
}

export function hexLum(hex) {
	const n = Number.parseInt(hex.replace("#", ""), 16);
	const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
		const c = v / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** Brand colours that disappear on a dark sky (black logos) are drawn in ink instead. */
export const onDark = (hex) => (hexLum(hex) < 0.06 ? C.ink : hex);
