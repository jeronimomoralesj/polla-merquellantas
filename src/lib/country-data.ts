import { countryByCode, type CountryInfo } from "./country-info";

const UA = "PollaMundialista/1.0 (info@tirepro.com.co)";

export type CountrySummary = {
  extract: string;
  thumbnail: string | null;
  url: string;
};

export type CountryFacts = {
  association: string | null;
  confederation: string | null;
  nickname: string | null;
  homeStadium: string | null;
  headCoach: string | null;
  captain: string | null;
  mostCaps: string | null;
  topScorer: string | null;
  fifaRanking: string | null;
  firstGame: string | null;
  largestWin: string | null;
  worstDefeat: string | null;
};

export type CountryWorldCup = {
  appearances: string | null;
  firstAppearance: string | null;
  bestResult: string | null;
  summary: string | null;
  url: string | null;
};

export type CountryPayload = {
  iso: string;
  fifa: string;
  es: string;
  en: string;
  flag: string;
  wikiUrl: string;
  summary: CountrySummary | null;
  facts: CountryFacts;
  worldCup: CountryWorldCup;
  recentSquad: string[];
};

type Infobox = Record<string, string>;

function flagUrl(iso: string): string {
  return `https://flagcdn.com/w320/${iso.toLowerCase()}.png`;
}

async function fetchSummary(page: string): Promise<CountrySummary | null> {
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page).replace(/%20/g, "_")}`;
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/json" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      extract?: string;
      thumbnail?: { source?: string };
      content_urls?: { desktop?: { page?: string } };
    };
    return {
      extract: data.extract ?? "",
      thumbnail: data.thumbnail?.source ?? null,
      url:
        data.content_urls?.desktop?.page ??
        `https://en.wikipedia.org/wiki/${page}`,
    };
  } catch {
    return null;
  }
}

async function fetchWikitext(page: string): Promise<string> {
  try {
    const url =
      "https://en.wikipedia.org/w/api.php?" +
      new URLSearchParams({
        action: "parse",
        page,
        format: "json",
        prop: "wikitext",
        formatversion: "2",
        redirects: "1",
      }).toString();
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/json" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return "";
    const json = (await res.json()) as { parse?: { wikitext: string } };
    return json.parse?.wikitext ?? "";
  } catch {
    return "";
  }
}

function stripWiki(input: string): string {
  let s = input;
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<ref[^>]*?\/>/gi, "");
  s = s.replace(/<ref[\s\S]*?<\/ref>/gi, "");
  // Country code helpers: {{fb|ARG}} {{fb-rt|BRA|1889}} {{fbu|...}} → leave just the country code
  s = s.replace(
    /\{\{\s*(?:fb|fb-rt|fbu|fbw|fbw-rt|fba|fb-big)\s*\|\s*([A-Z]{2,4})(?:\|[^}]*)?\}\}/gi,
    (_m, code) => String(code),
  );
  s = s.replace(/\{\{flagicon\|[^|}]+(?:\|[^}]+)?\}\}/gi, "");
  s = s.replace(/\{\{flagu?\|[^|}]+(?:\|[^}]+)?\}\}/gi, "");
  s = s.replace(/\{\{lang\|[^|}]+\|([^}]+)\}\}/gi, (_m, body) => String(body));
  s = s.replace(/\{\{nowrap\|([^}]+)\}\}/gi, "$1");
  s = s.replace(/\{\{sort\|[^|]+\|([^}]+)\}\}/gi, "$1");
  s = s.replace(/\{\{nts\|([^}]+)\}\}/gi, "$1");
  s = s.replace(/\{\{cnote\|[^}]+\}\}/gi, "");
  s = s.replace(/\{\{small\|([^}]+)\}\}/gi, "$1");
  s = s.replace(/\{\{ubl\|([^}]+)\}\}/gi, (_m, body: string) =>
    body
      .split("|")
      .map((x) => x.trim())
      .filter(Boolean)
      .join(", "),
  );
  // Strip remaining unknown templates ({{efn|...}}, {{Webarchive|...}}, etc.)
  for (let i = 0; i < 4; i++) {
    s = s.replace(/\{\{[^{}]*\}\}/g, "");
  }
  s = s.replace(/\[\[(?:File|Image):[^\]]+\]\]/gi, "");
  s = s.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, (_m, _l, label) => label);
  s = s.replace(/\[\[([^\]]+)\]\]/g, (_m, label) => label);
  s = s.replace(/'''([^']+)'''/g, "$1");
  s = s.replace(/''([^']+)''/g, "$1");
  s = s.replace(/&nbsp;/g, " ");
  s = s.replace(/&hairsp;/g, "");
  s = s.replace(/<br\s*\/?>/gi, " · ");
  s = s.replace(/<[^>]+>/g, "");
  s = s.replace(/\s+/g, " ").trim();
  // Trim trailing parenthetical fragments / dangling separators
  s = s.replace(/[·,;\s]+$/g, "").trim();
  return s;
}

function extractInfobox(wikitext: string): Infobox | null {
  const start = wikitext.search(/\{\{\s*Infobox\s+national\s+football\s+team/i);
  if (start < 0) return null;
  let i = start;
  let depth = 0;
  let end = -1;
  while (i < wikitext.length) {
    if (wikitext[i] === "{" && wikitext[i + 1] === "{") {
      depth++;
      i += 2;
    } else if (wikitext[i] === "}" && wikitext[i + 1] === "}") {
      depth--;
      i += 2;
      if (depth === 0) {
        end = i;
        break;
      }
    } else {
      i++;
    }
  }
  if (end < 0) return null;
  const body = wikitext.slice(start + 2, end - 2);
  const stripped = body.replace(
    /^\s*Infobox\s+national\s+football\s+team\s*\|?/i,
    "",
  );
  const args: Infobox = {};
  let depth2 = 0;
  let current = "";
  const tokens: string[] = [];
  let j = 0;
  while (j < stripped.length) {
    const c = stripped[j];
    const next = stripped[j + 1];
    if ((c === "{" && next === "{") || (c === "[" && next === "[")) {
      depth2++;
      current += c + next;
      j += 2;
      continue;
    }
    if ((c === "}" && next === "}") || (c === "]" && next === "]")) {
      depth2--;
      if (depth2 < 0) depth2 = 0;
      current += c + next;
      j += 2;
      continue;
    }
    if (c === "|" && depth2 === 0) {
      tokens.push(current);
      current = "";
      j += 1;
      continue;
    }
    current += c;
    j += 1;
  }
  tokens.push(current);
  for (const t of tokens) {
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t
      .slice(0, eq)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
    const value = t.slice(eq + 1).trim();
    if (key) args[key] = value;
  }
  return args;
}

function clean(field: string | undefined): string | null {
  if (!field) return null;
  const s = stripWiki(field);
  return s.length ? s : null;
}

function buildFifaRanking(infobox: Infobox): string | null {
  const current = clean(
    infobox.fifa_ranking ?? infobox.fifa_rank ?? infobox.fifa_max ?? "",
  );
  if (!current) return null;
  const min = clean(infobox.fifa_min);
  const max = clean(infobox.fifa_max);
  const parts = [current];
  if (max && max !== current) parts.push(`máx ${max}`);
  if (min) parts.push(`mín ${min}`);
  return parts.join(" · ");
}

function extractBalancedTemplates(
  text: string,
  namePattern: RegExp,
): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length - 1) {
    if (text[i] === "{" && text[i + 1] === "{") {
      const head = text.slice(i + 2, i + 80);
      if (!namePattern.test(head)) {
        i++;
        continue;
      }
      let depth = 1;
      let j = i + 2;
      while (j < text.length - 1 && depth > 0) {
        if (text[j] === "{" && text[j + 1] === "{") {
          depth++;
          j += 2;
        } else if (text[j] === "}" && text[j + 1] === "}") {
          depth--;
          j += 2;
        } else {
          j++;
        }
      }
      out.push(text.slice(i + 2, j - 2));
      i = j;
    } else {
      i++;
    }
  }
  return out;
}

function extractRecentSquad(wikitext: string, limit = 26): string[] {
  const startRe = /==+\s*(Current squad|Recent call-ups|Players|Squad)\s*==+/i;
  const m = startRe.exec(wikitext);
  if (!m) return [];
  let segment = wikitext.slice(m.index, m.index + 25000);
  // Resolve piped wikilinks so |name=[[Foo|Bar]]| becomes |name=Bar|
  segment = segment.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2");
  segment = segment.replace(/\[\[([^\]]+)\]\]/g, "$1");
  const bodies = extractBalancedTemplates(
    segment,
    /^\s*(?:nat\s*fs\s*g\s*player|football\s+squad\s+player|national\s+football\s+squad\s+player)\b/i,
  );
  const names: string[] = [];
  const seen = new Set<string>();
  for (const body of bodies) {
    if (names.length >= limit) break;
    const nameMatch =
      /\|\s*name\s*=\s*([^|}\n]+)/i.exec(body) ??
      /\|\s*player\s*=\s*([^|}\n]+)/i.exec(body);
    if (!nameMatch) continue;
    const name = stripWiki(nameMatch[1]);
    const key = name.toLowerCase();
    if (name && !seen.has(key)) {
      seen.add(key);
      names.push(name);
    }
  }
  return names;
}

export async function buildCountryPayload(
  info: CountryInfo,
): Promise<CountryPayload> {
  const [summary, teamWiki, wcSummary] = await Promise.all([
    fetchSummary(info.wikiTeam),
    fetchWikitext(info.wikiTeam),
    fetchSummary(info.wikiWorldCup),
  ]);
  const infobox = teamWiki ? extractInfobox(teamWiki) ?? {} : {};
  return {
    iso: info.iso,
    fifa: info.fifa,
    es: info.es,
    en: info.en,
    flag: flagUrl(info.iso),
    wikiUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(info.wikiTeam).replace(/%20/g, "_")}`,
    summary,
    facts: {
      association: clean(infobox.association),
      confederation: clean(infobox.confederation),
      nickname:
        clean(infobox.nickname) ??
        clean(infobox.nicknames) ??
        clean(infobox.alt_name),
      homeStadium:
        clean(infobox.home_stadium) ?? clean(infobox.stadium),
      headCoach:
        clean(infobox.coach) ??
        clean(infobox.manager) ??
        clean(infobox.head_coach),
      captain: clean(infobox.captain),
      mostCaps:
        clean(infobox.most_caps) ?? clean(infobox.most_capped_player),
      topScorer:
        clean(infobox.top_scorer) ?? clean(infobox.leading_scorer),
      fifaRanking: buildFifaRanking(infobox),
      firstGame:
        clean(infobox.first_game) ?? clean(infobox.first_international),
      largestWin: clean(infobox.largest_win),
      worstDefeat:
        clean(infobox.largest_loss) ?? clean(infobox.worst_defeat),
    },
    worldCup: {
      appearances:
        clean(infobox.world_cup_apps) ?? clean(infobox.regional_cup_apps),
      firstAppearance:
        clean(infobox.world_cup_first) ?? clean(infobox.regional_cup_first),
      bestResult:
        clean(infobox.world_cup_best) ?? clean(infobox.regional_cup_best),
      summary: wcSummary?.extract ?? null,
      url: wcSummary?.url ?? null,
    },
    recentSquad: teamWiki ? extractRecentSquad(teamWiki) : [],
  };
}

export async function loadCountry(
  code: string,
): Promise<CountryPayload | null> {
  const info = countryByCode(decodeURIComponent(code));
  if (!info) return null;
  return buildCountryPayload(info);
}
