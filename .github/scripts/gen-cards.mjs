// 自托管版 GitHub 统计卡生成器：调 GitHub GraphQL/REST API 取数据，渲染三张 SVG
// （stats 卡 / top langs 卡 / trophies 成就条），输出到 dist/ 供 workflow 发布到 output 分支。
// 用自生成替代 github-readme-stats / github-profile-trophy 公共实例（长期 502）。
const USER = "HaoTang9878";
const OUT = process.argv[2] || "dist";
const TOKEN = process.env.GITHUB_TOKEN;
import fs from "node:fs";

const ACCENT = "#a371f7", BG = "#141321", TEXT = "#e6edf3", MUTED = "#8b949e", TRACK = "#21262d";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (n) => Number(n).toLocaleString("en-US");

const QUERY = `query($login:String!){
  user(login:$login){
    followers{totalCount}
    repositories(first:100, ownerAffiliations:OWNER, isFork:false){
      totalCount
      nodes{ stargazerCount forkCount languages(first:20){ edges{ size node{name} } } }
    }
    pullRequests{totalCount}
    issues{totalCount}
    contributionsCollection{ totalCommitContributions }
  }
}`;

async function fetchData() {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { login: USER } }),
  });
  if (!res.ok) throw new Error(`GraphQL ${res.status}`);
  const body = await res.json();
  if (body.errors) throw new Error(`GraphQL: ${body.errors[0].message}`);
  return body.data.user;
}

function writeSvg(name, svg) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(`${OUT}/${name}`, svg.trim());
  console.log(`wrote ${OUT}/${name}`);
}

function statsCard(d) {
  const repos = d.repositories.nodes;
  const stars = repos.reduce((a, r) => a + r.stargazerCount, 0);
  const forks = repos.reduce((a, r) => a + r.forkCount, 0);
  const commits = d.contributionsCollection.totalCommitContributions;
  const rows = [
    ["⭐", "Total Stars", stars],
    ["📝", "Total Commits (1y)", commits],
    ["🔀", "Total PRs", d.pullRequests.totalCount],
    ["🐛", "Total Issues", d.issues.totalCount],
    ["👥", "Followers", d.followers.totalCount],
    ["📦", "Own Repos", `${d.repositories.totalCount} (🍴 ${forks})`],
  ];
  const cell = ([icon, label, val], x, y) => `
  <text x="${x}" y="${y}" font-size="15">${icon}</text>
  <text x="${x + 24}" y="${y}" font-size="13" fill="${MUTED}">${esc(label)}</text>
  <text x="${x + 215}" y="${y}" font-size="14" fill="${TEXT}" text-anchor="end" font-weight="bold">${esc(val)}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="495" height="200" viewBox="0 0 495 200" role="img" aria-label="GitHub stats">
  <rect width="495" height="200" rx="12" fill="${BG}"/>
  <text x="25" y="38" font-size="19" font-weight="bold" fill="${ACCENT}" font-family="Segoe UI,Helvetica,Arial,sans-serif">${esc(USER)}'s GitHub Stats</text>
  <line x1="25" y1="52" x2="470" y2="52" stroke="${TRACK}" stroke-width="1"/>
  <g font-family="Segoe UI,Helvetica,Arial,sans-serif">
    ${rows.slice(0, 3).map((r, i) => cell(r, 30, 85 + i * 36)).join("")}
    ${rows.slice(3).map((r, i) => cell(r, 260, 85 + i * 36)).join("")}
  </g>
</svg>`;
  writeSvg("stats-card.svg", svg);
}

const LANG_COLORS = {
  TypeScript: "#3178c6", JavaScript: "#f1e05a", Python: "#3572A5", Shell: "#89e051",
  HTML: "#e34c26", CSS: "#563d7c", "Jupyter Notebook": "#DA5B0B", Go: "#00ADD8",
  Rust: "#dea584", Java: "#b07219", "C++": "#f34b7d", C: "#555555", Vue: "#41b883",
  Dockerfile: "#384d54", Makefile: "#427819", Lua: "#000080",
};

function topLangsCard(d) {
  const bytes = {};
  for (const repo of d.repositories.nodes)
    for (const e of repo.languages.edges) bytes[e.node.name] = (bytes[e.node.name] || 0) + e.size;
  const total = Object.values(bytes).reduce((a, b) => a + b, 0) || 1;
  const langs = Object.entries(bytes).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, size]) => ({ name, pct: (size / total) * 100 }));
  const rows = langs.map((l, i) => {
    const y = 72 + i * 26;
    const color = LANG_COLORS[l.name] || MUTED;
    return `
  <text x="25" y="${y + 11}" font-size="12.5" fill="${TEXT}" font-family="Segoe UI,sans-serif">${esc(l.name)}</text>
  <rect x="160" y="${y}" width="260" height="12" rx="6" fill="${TRACK}"/>
  <rect x="160" y="${y}" width="${Math.max(4, 260 * l.pct / 100)}" height="12" rx="6" fill="${color}"/>
  <text x="470" y="${y + 11}" font-size="12.5" fill="${MUTED}" text-anchor="end" font-family="Segoe UI,sans-serif">${l.pct.toFixed(1)}%</text>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="495" height="200" viewBox="0 0 495 200" role="img" aria-label="Top languages">
  <rect width="495" height="200" rx="12" fill="${BG}"/>
  <text x="25" y="38" font-size="19" font-weight="bold" fill="${ACCENT}" font-family="Segoe UI,Helvetica,Arial,sans-serif">Most Used Languages</text>
  <line x1="25" y1="52" x2="470" y2="52" stroke="${TRACK}" stroke-width="1"/>
  ${rows.join("")}
</svg>`;
  writeSvg("top-langs.svg", svg);
}

function trophiesStrip(d) {
  const repos = d.repositories.nodes;
  const stars = repos.reduce((a, r) => a + r.stargazerCount, 0);
  const commits = d.contributionsCollection.totalCommitContributions;
  const all = [
    ["🌱", "First Commit", true],
    ["🐍", "Snake Tamer", true],
    ["📦", "Collection", d.repositories.totalCount >= 5],
    ["🚀", "50+ Commits", commits >= 50],
    ["🔀", "PR Maker", d.pullRequests.totalCount >= 1],
    ["⭐", "Star Giver", stars >= 1],
  ];
  const chips = all.map(([icon, label, got], i) => {
    const x = 20 + i * 118;
    const op = got ? 1 : 0.25;
    return `
  <g opacity="${op}">
    <rect x="${x}" y="28" width="108" height="52" rx="10" fill="${TRACK}"/>
    <text x="${x + 54}" y="52" font-size="18" text-anchor="middle">${icon}</text>
    <text x="${x + 54}" y="71" font-size="10.5" fill="${got ? ACCENT : MUTED}" text-anchor="middle" font-family="Segoe UI,sans-serif">${esc(label)}</text>
  </g>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="730" height="100" viewBox="0 0 730 100" role="img" aria-label="Achievements">
  <rect width="730" height="100" rx="12" fill="${BG}"/>
  ${chips.join("")}
</svg>`;
  writeSvg("trophies.svg", svg);
}

try {
  const d = await fetchData();
  statsCard(d);
  topLangsCard(d);
  trophiesStrip(d);
} catch (e) {
  console.error("data fetch failed, writing fallback cards:", e.message);
  const fallback = (w, h, label) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="12" fill="${BG}"/><text x="${w / 2}" y="${h / 2}" fill="${MUTED}" text-anchor="middle" font-family="sans-serif" font-size="14">⏳ ${esc(label)} — will refresh tomorrow</text></svg>`;
  writeSvg("stats-card.svg", fallback(495, 200, "stats"));
  writeSvg("top-langs.svg", fallback(495, 200, "top langs"));
  writeSvg("trophies.svg", fallback(730, 100, "trophies"));
  process.exit(1); // 让 workflow 显示失败但已发布占位图，明天定时重试
}
