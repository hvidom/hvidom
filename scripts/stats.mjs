#!/usr/bin/env node
// GitHub telemetry card (assets/generated/dashboard.svg): contributions, streaks, weekly activity
// and top languages. Zero dependencies — runs on the stock Node of GitHub Actions runners.
//   GITHUB_TOKEN=… node scripts/stats.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { C, esc, FONT, GREENS, r1, sky, svg } from "./lib.mjs";

const LOGIN = process.env.PROFILE_LOGIN ?? "hvidom";
const LEGACY = process.env.PROFILE_LEGACY ?? "Frikadellios";
const TOKEN = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
if (!TOKEN) {
	console.error("GITHUB_TOKEN (or GH_TOKEN) is required");
	process.exit(1);
}

const QUERY = `query($login: String!, $legacy: String!) {
  user(login: $login) {
    createdAt
    contributionsCollection {
      contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      restrictedContributionsCount
    }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) {
      totalCount
      nodes { stargazerCount languages(first: 10, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name color } } } }
    }
    all: repositories(ownerAffiliations: OWNER, privacy: PUBLIC) { totalCount }
  }
  legacy: user(login: $legacy) {
    createdAt
    repositories(ownerAffiliations: OWNER, privacy: PUBLIC) { totalCount }
    own: repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, orderBy: { field: STARGAZERS, direction: DESC }) {
      nodes { stargazerCount }
    }
  }
}`;

async function load() {
	const res = await fetch("https://api.github.com/graphql", {
		method: "POST",
		headers: { authorization: `bearer ${TOKEN}`, "content-type": "application/json", "user-agent": "hvidom-profile" },
		body: JSON.stringify({ query: QUERY, variables: { login: LOGIN, legacy: LEGACY } }),
	});
	const json = await res.json();
	if (!res.ok || json.errors) throw new Error(JSON.stringify(json.errors ?? json));
	return json.data;
}

function streaks(days) {
	let longest = 0;
	let run = 0;
	for (const d of days) {
		run = d.contributionCount > 0 ? run + 1 : 0;
		longest = Math.max(longest, run);
	}
	let current = 0;
	let i = days.length - 1;
	if (i >= 0 && days[i].contributionCount === 0) i--; // today isn't over yet
	for (; i >= 0 && days[i].contributionCount > 0; i--) current++;
	return { current, longest };
}

function languages(repos) {
	const total = new Map();
	for (const r of repos) {
		for (const e of r.languages.edges) {
			const cur = total.get(e.node.name) ?? { size: 0, color: e.node.color ?? C.dim };
			cur.size += e.size;
			total.set(e.node.name, cur);
		}
	}
	const sum = [...total.values()].reduce((a, b) => a + b.size, 0) || 1;
	const list = [...total.entries()].map(([name, v]) => ({ name, color: v.color, share: v.size / sum })).sort((a, b) => b.share - a.share);
	const top = list.slice(0, 6);
	const rest = list.slice(6).reduce((a, b) => a + b.share, 0);
	if (rest > 0.005) top.push({ name: "Other", color: C.dim, share: rest });
	return top;
}

const fmt = (n) => n.toLocaleString("en-IE");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function render(d) {
	const u = d.user;
	const cal = u.contributionsCollection.contributionCalendar;
	const days = cal.weeks.flatMap((w) => w.contributionDays);
	const { current, longest } = streaks(days);
	const legacyStars = d.legacy?.own.nodes.reduce((a, r) => a + r.stargazerCount, 0) ?? 0;
	const stars = u.repositories.nodes.reduce((a, r) => a + r.stargazerCount, 0) + legacyStars;
	const repoCount = u.all.totalCount + (d.legacy?.repositories.totalCount ?? 0);
	const since = new Date(d.legacy?.createdAt ?? u.createdAt).getUTCFullYear();
	const langs = languages(u.repositories.nodes);

	const w = 1200;
	const h = 488;
	const panel = sky(w, h, 97, {
		starCount: 60,
		nebulae: [
			[1150, 0, 380, 200, C.violet, 0.16],
			[0, h, 420, 220, C.green, 0.08],
		],
		avoid: [[30, 30, 1140, h - 50]],
	});
	let body = panel.open;
	const today = new Date().toISOString().slice(0, 10);
	body += `<text x="48" y="54" font-family="${FONT.mono}" font-size="16" fill="${C.dim}">// @${esc(LOGIN)} · last 12 months · updated ${today}</text>`;

	// metric tiles
	const tiles = [
		[fmt(cal.totalContributions), "contributions", C.green],
		u.contributionsCollection.restrictedContributionsCount > 0
			? [fmt(u.contributionsCollection.restrictedContributionsCount), "in private repos", C.cyan]
			: [fmt(u.contributionsCollection.totalCommitContributions), "commits", C.cyan],
		current > 0
			? [`${current}`, current === 1 ? "day current streak" : "days current streak", C.gold]
			: [`${days.filter((x) => x.contributionCount > 0).length}`, "active days", C.gold],
		[`${longest}`, "longest streak", C.orange],
		[fmt(repoCount), "repos incl. legacy", C.violet],
		[`${since}`, `on GitHub · ★ ${fmt(stars)}`, C.pink],
	];
	const tw = (w - 96 - 5 * 12) / 6;
	tiles.forEach(([v, label, color], i) => {
		const x = 48 + i * (tw + 12);
		body += `<rect x="${r1(x)}" y="80" width="${r1(tw)}" height="100" rx="16" fill="${C.tile}" fill-opacity=".92" stroke="${C.line}"/>`;
		body += `<rect x="${r1(x)}" y="98" width="4" height="64" rx="2" fill="${color}"/>`;
		body += `<text x="${r1(x + 20)}" y="130" font-family="${FONT.sans}" font-size="38" font-weight="800" fill="${color}">${esc(v)}</text>`;
		body += `<text x="${r1(x + 20)}" y="160" font-family="${FONT.sans}" font-size="16" fill="${C.muted}">${esc(label)}</text>`;
	});

	// weekly bars
	const weeks = cal.weeks.map((wk) => ({
		total: wk.contributionDays.reduce((a, x) => a + x.contributionCount, 0),
		first: wk.contributionDays[0].date,
	}));
	const cx0 = 48;
	const cw = 720;
	const top = 232;
	const base = 412;
	body += `<rect x="${cx0}" y="200" width="${cw}" height="252" rx="16" fill="${C.tile}" fill-opacity=".92" stroke="${C.line}"/>`;
	body += `<text x="${cx0 + 20}" y="${top}" font-family="${FONT.mono}" font-size="15" letter-spacing="1.2" fill="${C.green}" font-weight="700">CONTRIBUTIONS PER WEEK</text>`;
	const max = Math.max(1, ...weeks.map((x) => x.total));
	const innerX = cx0 + 20;
	const innerW = cw - 40;
	const step = innerW / weeks.length;
	const bw = Math.max(4, step - 3);
	const chartTop = top + 34;
	const chartH = base - chartTop;
	// gridlines
	for (const f of [0.5, 1]) {
		const gy = base - chartH * f;
		body += `<line x1="${innerX}" x2="${innerX + innerW}" y1="${r1(gy)}" y2="${r1(gy)}" stroke="#ffffff" stroke-opacity=".06" stroke-dasharray="3 5"/>`;
		body += `<text x="${innerX}" y="${r1(gy - 5)}" font-family="${FONT.mono}" font-size="14" fill="${C.dim}">${Math.round(max * f)}</text>`;
	}
	body += `<line x1="${innerX}" x2="${innerX + innerW}" y1="${base}" y2="${base}" stroke="#ffffff" stroke-opacity=".12"/>`;
	let best = 0;
	weeks.forEach((wk, i) => {
		if (wk.total > weeks[best].total) best = i;
	});
	weeks.forEach((wk, i) => {
		const x = innerX + i * step + (step - bw) / 2;
		const bh = wk.total ? Math.max(3, (wk.total / max) * chartH) : 2;
		const level = wk.total === 0 ? 0 : Math.min(4, 1 + Math.floor((wk.total / max) * 4));
		const fill = wk.total === 0 ? "rgba(255,255,255,0.08)" : GREENS[level];
		body += `<rect class="bar" style="animation-delay:${(i * 0.012).toFixed(3)}s" x="${r1(x)}" y="${r1(base - bh)}" width="${r1(bw)}" height="${r1(bh)}" rx="${Math.min(3, bw / 2)}" fill="${fill}"><title>Week of ${wk.first}: ${wk.total}</title></rect>`;
		const m = Number(wk.first.slice(5, 7)) - 1;
		const prev = i > 0 ? Number(weeks[i - 1].first.slice(5, 7)) - 1 : -1;
		if (m !== prev && i > 0 && i < weeks.length - 2) {
			body += `<text x="${r1(x)}" y="${base + 26}" font-family="${FONT.mono}" font-size="14" fill="${C.dim}">${MONTHS[m]}</text>`;
		}
	});
	if (weeks[best].total > 0) {
		const bx = innerX + best * step + step / 2;
		const by = base - (weeks[best].total / max) * chartH;
		const label = `best week · ${weeks[best].total}`;
		const right = bx > innerX + innerW - 170;
		body += `<circle cx="${r1(bx)}" cy="${r1(by - 8)}" r="3" fill="${C.gold}"/>`;
		body += `<text x="${r1(right ? bx - 8 : bx + 8)}" y="${r1(by - 4)}" text-anchor="${right ? "end" : "start"}" font-family="${FONT.mono}" font-size="15" fill="${C.gold}">${esc(label)}</text>`;
	}

	// languages
	const lx = cx0 + cw + 12;
	const lw = w - 48 - lx;
	body += `<rect x="${lx}" y="200" width="${lw}" height="252" rx="16" fill="${C.tile}" fill-opacity=".92" stroke="${C.line}"/>`;
	body += `<text x="${lx + 20}" y="${top}" font-family="${FONT.mono}" font-size="15" letter-spacing="1.2" fill="${C.violet}" font-weight="700">LANGUAGES</text>`;
	const barW = lw - 40;
	let bx = lx + 20;
	body += `<clipPath id="langbar"><rect x="${lx + 20}" y="252" width="${barW}" height="12" rx="6"/></clipPath><g clip-path="url(#langbar)">`;
	for (const l of langs) {
		const seg = l.share * barW;
		body += `<rect x="${r1(bx)}" y="252" width="${r1(seg + 0.5)}" height="12" fill="${l.color}"/>`;
		bx += seg;
	}
	body += "</g>";
	langs.forEach((l, i) => {
		const col = i % 2;
		const row = Math.floor(i / 2);
		const x = lx + 20 + col * (barW / 2 + 8);
		const y = 304 + row * 36;
		body += `<circle cx="${r1(x + 6)}" cy="${y - 6}" r="6" fill="${l.color}"/>`;
		body += `<text x="${r1(x + 20)}" y="${y}" font-family="${FONT.sans}" font-size="17" fill="${C.ink}">${esc(l.name)}</text>`;
		body += `<text x="${r1(x + barW / 2 - 16)}" y="${y}" text-anchor="end" font-family="${FONT.mono}" font-size="15" fill="${C.muted}">${Math.round(l.share * 100)}%</text>`;
	});
	body += panel.close;

	const css = `.bar{animation:grow .7s cubic-bezier(.2,.8,.2,1) both;transform-box:fill-box;transform-origin:50% 100%}
@keyframes grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}`;
	return svg(w, h, body, {
		title: `GitHub telemetry for @${LOGIN}`,
		desc: `${cal.totalContributions} contributions in the last 12 months (${u.contributionsCollection.restrictedContributionsCount} of them in private repositories), ${u.contributionsCollection.totalCommitContributions} public commits, current streak ${current} days, longest streak ${longest} days, ${repoCount} repositories including the legacy @${LEGACY} account, on GitHub since ${since}. Top languages: ${langs.map((l) => `${l.name} ${(l.share * 100).toFixed(1)}%`).join(", ")}.`,
		defs: panel.defs,
		css,
	});
}

const data = await load();
const dir = new URL("../assets/generated/", import.meta.url);
mkdirSync(dir, { recursive: true });
const out = render(data);
writeFileSync(new URL("dashboard.svg", dir), out);
console.log(`assets/generated/dashboard.svg  ${(out.length / 1024).toFixed(1)} KB`);
