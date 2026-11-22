import type {
  AlbumDetail,
  ArtistSummary,
  ReleaseGroup,
  ReleasePage,
  ReleaseSummary,
} from '../../shared/types';
import { ProviderError, type MusicProvider } from './types';

/**
 * Erfundene Musikwelt zum Testen ohne Spotify-Keys.
 * Alle Namen sind ausgedacht. Cover werden als SVG generiert (siehe demoSvg).
 */

const ARTISTS: Record<string, { name: string; genres: string[] }> = {
  nova: { name: 'Nova Lane', genres: ['pop', 'synthpop'] },
  kaito: { name: 'Kaito Rivers', genres: ['hip-hop'] },
  mila: { name: 'Mila Sørensen', genres: ['indie pop'] },
  moe: { name: 'Big Moe Static', genres: ['rap', 'trap'] },
  luna: { name: 'Luna Park Club', genres: ['electronic', 'house'] },
  jaylen: { name: 'Jaylen Frost', genres: ['r&b'] },
  sora: { name: 'Sora Vale', genres: ['k-pop'] },
  velvet: { name: 'The Velvet Arcade', genres: ['indie rock'] },
  kompass: { name: 'DJ Kompass', genres: ['dance', 'edm'] },
  ella: { name: 'Ella Brightwater', genres: ['singer-songwriter'] },
  rico: { name: 'Rico Santana Jr.', genres: ['reggaeton'] },
  marlon: { name: 'Marlon Dupree', genres: ['jazz'] },
  cassidy: { name: 'Cassidy Moon', genres: ['country'] },
  juno: { name: 'Juno & The Tides', genres: ['folk'] },
  zeno: { name: 'Zeno Black', genres: ['techno'] },
  pia: { name: 'Pia Kosmos', genres: ['deutschpop'] },
  various: { name: 'Various Artists', genres: [] },
};

type DemoTrack = [name: string, artists: string[], seconds?: number];
interface DemoRelease {
  id: string;
  name: string;
  type: 'album' | 'single' | 'compilation';
  year: string;
  artists: string[];
  tracks: DemoTrack[];
}

const midnight: DemoTrack[] = [
  ['Neon Heart', ['nova'], 201],
  ['Satellite Love', ['nova', 'kaito'], 188],
  ['Paper Planes Tonight', ['nova'], 214],
  ['Glasshouse', ['nova', 'mila'], 197],
  ['Afterglow', ['nova'], 230],
  ['Static Dreams', ['nova'], 176],
  ['Last Train Home', ['nova', 'ella'], 243],
];

const RELEASES: DemoRelease[] = [
  { id: 'r1', name: 'Midnight Signals', type: 'album', year: '2023', artists: ['nova'], tracks: midnight },
  {
    id: 'r1d', name: 'Midnight Signals (Deluxe Edition)', type: 'album', year: '2024', artists: ['nova'],
    tracks: [...midnight, ['Satellite Love - Kompass Remix', ['nova', 'kaito', 'kompass'], 205], ['Neon Heart - Acoustic', ['nova'], 190]],
  },
  { id: 'r3', name: 'Firstlight', type: 'album', year: '2020', artists: ['nova'], tracks: [['Firstlight', ['nova']], ['Runaway Summer', ['nova']], ['Hold the Line', ['nova', 'velvet']], ['Echoes', ['nova']]] },
  { id: 'r2', name: 'Golden Hour Club', type: 'single', year: '2022', artists: ['nova', 'jaylen'], tracks: [['Golden Hour Club', ['nova', 'jaylen']]] },
  { id: 'r20', name: 'Neon Heart', type: 'single', year: '2023', artists: ['nova'], tracks: [['Neon Heart', ['nova']], ['Neon Heart - Instrumental', ['nova']]] },
  {
    id: 'r4', name: 'Riverside Tapes', type: 'album', year: '2023', artists: ['kaito'],
    tracks: [['Intro (Riverside)', ['kaito'], 95], ['Concrete Garden', ['kaito', 'moe']], ['No Ceilings', ['kaito']], ['Late Checkout', ['kaito', 'jaylen']], ['Blue Lights', ['kaito', 'sora']], ['Outro', ['kaito'], 110]],
  },
  { id: 'r21', name: 'Late Checkout', type: 'single', year: '2023', artists: ['kaito', 'jaylen'], tracks: [['Late Checkout', ['kaito', 'jaylen']]] },
  { id: 'r24', name: 'Kaito Rivers: The Collection', type: 'compilation', year: '2024', artists: ['kaito'], tracks: [['Blue Lights', ['kaito', 'sora']], ['Concrete Garden', ['kaito', 'moe']], ['No Ceilings', ['kaito']]] },
  {
    id: 'r5', name: 'Cold Cash Season', type: 'album', year: '2021', artists: ['moe'],
    tracks: [['Cold Cash', ['moe']], ['Block Party', ['moe', 'kaito']], ['Ghost Mode', ['moe']], ['Bassline Bandit', ['moe', 'kompass']], ['Ride Out', ['moe', 'rico']]],
  },
  {
    id: 'r6', name: 'Kompass Sommer Hits 2024', type: 'compilation', year: '2024', artists: ['various'],
    tracks: [['Bassline Bandit - Club Edit', ['kompass', 'moe']], ['Sonnendeck', ['pia']], ['Tropical Rain', ['rico']], ['Ocean Drive Nights', ['luna']], ['Waves', ['juno']]],
  },
  {
    id: 'r7', name: 'Nordlicht', type: 'album', year: '2022', artists: ['kompass'],
    tracks: [['Nordlicht', ['kompass']], ['Kompass', ['kompass']], ['Tanz mit mir', ['kompass', 'pia']], ['Bunker 3AM', ['kompass', 'zeno']]],
  },
  {
    id: 'r8', name: 'Herzschlag', type: 'album', year: '2023', artists: ['pia'],
    tracks: [['Herzschlag', ['pia']], ['Großstadtlichter', ['pia']], ['Tanz mit mir', ['pia', 'kompass']], ['Sommer in Berlin', ['pia', 'ella']], ['Wenn du gehst', ['pia']]],
  },
  {
    id: 'r9', name: 'Wildflower Letters', type: 'album', year: '2021', artists: ['ella'],
    tracks: [['Wildflower', ['ella']], ['Letters', ['ella']], ['Porch Light', ['ella', 'cassidy']], ["Last Train Home (Ella's Version)", ['ella', 'nova']], ['Harbor', ['ella', 'juno']]],
  },
  {
    id: 'r10', name: 'Dust & Diamonds', type: 'album', year: '2022', artists: ['cassidy'],
    tracks: [['Dust & Diamonds', ['cassidy']], ['Highway 9', ['cassidy']], ['Porch Light', ['cassidy', 'ella']], ['Moonshine Waltz', ['cassidy', 'marlon']], ['Tumbleweed Heart', ['cassidy', 'juno']]],
  },
  {
    id: 'r11', name: 'Blue Note Avenue', type: 'album', year: '2019', artists: ['marlon'],
    tracks: [['Avenue', ['marlon'], 312], ['Smoke Rings', ['marlon', 'jaylen'], 268], ['Moonshine Waltz', ['marlon', 'cassidy'], 255], ['Midnight Trane', ['marlon'], 401]],
  },
  { id: 'r22', name: 'Smoke Rings EP', type: 'single', year: '2019', artists: ['marlon'], tracks: [['Smoke Rings', ['marlon', 'jaylen']], ['Ash', ['marlon']], ['Ember', ['marlon']], ['Ember - Live', ['marlon']]] },
  {
    id: 'r12', name: 'Velvet Nights', type: 'album', year: '2021', artists: ['jaylen'],
    tracks: [['Velvet', ['jaylen']], ['Late Checkout', ['jaylen', 'kaito']], ['Silk Road', ['jaylen', 'sora']], ['Golden Hour Club', ['jaylen', 'nova']], ['Smoke Rings (Reprise)', ['jaylen', 'marlon']]],
  },
  {
    id: 'r13', name: 'Prism', type: 'album', year: '2024', artists: ['sora'],
    tracks: [['Prism', ['sora']], ['Blue Lights', ['sora', 'kaito']], ['Silk Road', ['sora', 'jaylen']], ['Starlight Parade', ['sora', 'luna']]],
  },
  {
    id: 'r14', name: 'Ocean Drive', type: 'album', year: '2023', artists: ['luna'],
    tracks: [['Ocean Drive Nights', ['luna']], ['Starlight Parade - Club Mix', ['luna', 'sora']], ['Pulse', ['luna', 'zeno']], ['Weekend Forever', ['luna', 'rico']]],
  },
  {
    id: 'r15', name: 'Calor', type: 'album', year: '2023', artists: ['rico'],
    tracks: [['Calor', ['rico']], ['Ride Out', ['rico', 'moe']], ['Weekend Forever', ['rico', 'luna']], ['Bailando Sola', ['rico', 'mila']]],
  },
  {
    id: 'r16', name: 'Paper Moon', type: 'album', year: '2020', artists: ['mila'],
    tracks: [['Paper Moon', ['mila']], ['Glasshouse', ['mila', 'nova']], ['Bailando Sola', ['mila', 'rico']], ['Northern Lines', ['mila', 'velvet']]],
  },
  {
    id: 'r17', name: 'Arcade Fever', type: 'album', year: '2018', artists: ['velvet'],
    tracks: [['Arcade Fever', ['velvet']], ['Hold the Line', ['velvet', 'nova']], ['Northern Lines', ['velvet', 'mila']], ['Gasoline', ['velvet']]],
  },
  {
    id: 'r18', name: 'Tide Pools', type: 'album', year: '2022', artists: ['juno'],
    tracks: [['Tide Pools', ['juno']], ['Harbor', ['juno', 'ella']], ['Tumbleweed Heart', ['juno', 'cassidy']], ['Waves', ['juno']]],
  },
  { id: 'r19', name: 'Bunker', type: 'album', year: '2024', artists: ['zeno'], tracks: [['Bunker 3AM', ['zeno', 'kompass']], ['Pulse', ['zeno', 'luna']], ['Concrete', ['zeno']]] },
  {
    id: 'r23', name: 'Best of Summer Vibes', type: 'compilation', year: '2021', artists: ['various'],
    tracks: [['Runaway Summer', ['nova']], ['Calor', ['rico']], ['Paper Moon', ['mila']], ['Ocean Drive Nights', ['luna']], ['Highway 9', ['cassidy']]],
  },
];

const RELEASE_BY_ID = new Map(RELEASES.map((r) => [r.id, r]));

function artistSummary(id: string): ArtistSummary {
  const a = ARTISTS[id];
  if (!a) throw new ProviderError(404, 'Artist nicht gefunden');
  return { id, name: a.name, image: `/demo/artist/${id}.svg`, imageSmall: `/demo/artist/${id}.svg`, genres: a.genres, url: null };
}

const ref = (id: string) => ({ id, name: ARTISTS[id]?.name ?? id });

function releaseSummary(r: DemoRelease): ReleaseSummary {
  return {
    id: r.id,
    name: r.name,
    cover: `/demo/cover/${r.id}.svg`,
    coverSmall: `/demo/cover/${r.id}.svg`,
    year: r.year,
    type: r.type,
    totalTracks: r.tracks.length,
    artists: r.artists.map(ref),
  };
}

function groupOf(r: DemoRelease, artistId: string): ReleaseGroup | null {
  if (r.artists.includes(artistId)) return r.type;
  if (r.tracks.some(([, artists]) => artists.includes(artistId))) return 'appears_on';
  return null;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class DemoProvider implements MusicProvider {
  readonly name = 'demo';

  async searchArtists(query: string): Promise<ArtistSummary[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return Object.keys(ARTISTS)
      .filter((id) => id !== 'various' && ARTISTS[id].name.toLowerCase().includes(q))
      .slice(0, 10)
      .map(artistSummary);
  }

  async getArtist(id: string): Promise<ArtistSummary> {
    await wait(80);
    return artistSummary(id);
  }

  async getReleases(artistId: string, group: ReleaseGroup, offset: number, count: number): Promise<ReleasePage> {
    await wait(120);
    if (!ARTISTS[artistId]) throw new ProviderError(404, 'Artist nicht gefunden');
    const all = RELEASES.filter((r) => groupOf(r, artistId) === group).sort((a, b) => b.year.localeCompare(a.year));
    const items = all.slice(offset, offset + count).map(releaseSummary);
    const end = offset + items.length;
    return { group, items, total: all.length, offset, next: end < all.length ? end : null };
  }

  async getAlbum(id: string): Promise<AlbumDetail> {
    await wait(100);
    const r = RELEASE_BY_ID.get(id);
    if (!r) throw new ProviderError(404, 'Album nicht gefunden');
    return {
      id: r.id,
      name: r.name,
      cover: `/demo/cover/${r.id}.svg`,
      coverSmall: `/demo/cover/${r.id}.svg`,
      type: r.type,
      year: r.year,
      totalTracks: r.tracks.length,
      artists: r.artists.map(ref),
      tracks: r.tracks.map(([name, artists, seconds], i) => ({
        id: `${r.id}-t${i + 1}`,
        name,
        number: i + 1,
        disc: 1,
        durationMs: (seconds ?? 150 + ((name.length * 37) % 90)) * 1000,
        explicit: artists.includes('moe'),
        artists: artists.map(ref),
      })),
      url: null,
    };
  }

  async popularArtists(): Promise<ArtistSummary[]> {
    return ['nova', 'kaito', 'kompass', 'pia', 'jaylen', 'sora', 'rico', 'mila'].map(artistSummary);
  }

  async randomArtist(excludeIds: string[]): Promise<ArtistSummary> {
    const ids = Object.keys(ARTISTS).filter((id) => id !== 'various' && !excludeIds.includes(id));
    return artistSummary(ids[Math.floor(Math.random() * ids.length)]);
  }
}

// ---------- SVG-Bilder für die Demo ----------

function hash(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function wrapTitle(title: string, max = 14): string[] {
  const words = title.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > max && line) {
      lines.push(line);
      line = w;
    } else {
      line = (line + ' ' + w).trim();
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

export function demoSvg(kind: 'cover' | 'artist', id: string): string | null {
  if (kind === 'artist') {
    const a = ARTISTS[id];
    if (!a) return null;
    const h = hash(id);
    const hue = h % 360;
    const initials = a.name
      .replace(/[^\p{L}\s]/gu, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="640" height="640">
<defs><radialGradient id="g" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="hsl(${hue} 70% 62%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360} 60% 22%)"/></radialGradient></defs>
<rect width="640" height="640" fill="url(#g)"/>
<circle cx="${200 + (h % 240)}" cy="${180 + ((h >> 8) % 260)}" r="${120 + ((h >> 4) % 80)}" fill="hsl(${(hue + 180) % 360} 70% 60%)" opacity="0.25"/>
<text x="320" y="370" text-anchor="middle" font-family="Figtree, Arial, sans-serif" font-size="190" font-weight="800" fill="#fff" opacity="0.92">${esc(initials)}</text>
</svg>`;
  }
  const r = RELEASE_BY_ID.get(id);
  if (!r) return null;
  const h = hash(r.id + r.name);
  const hue = h % 360;
  const hue2 = (hue + 60 + (h % 120)) % 360;
  const lines = wrapTitle(r.name);
  const artistName = r.artists.map((a) => ARTISTS[a]?.name ?? a).join(', ');
  const shapes = Array.from({ length: 4 }, (_, i) => {
    const s = hash(r.id + i);
    return `<circle cx="${s % 640}" cy="${(s >> 10) % 640}" r="${60 + (s % 160)}" fill="hsl(${(hue + i * 50) % 360} 80% 65%)" opacity="0.22"/>`;
  }).join('');
  const text = lines
    .map((l, i) => `<text x="44" y="${470 + i * 62 - (lines.length - 1) * 62}" font-family="Figtree, Arial, sans-serif" font-size="58" font-weight="800" fill="#fff">${esc(l)}</text>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="640" height="640">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 70% 45%)"/><stop offset="1" stop-color="hsl(${hue2} 65% 18%)"/></linearGradient></defs>
<rect width="640" height="640" fill="url(#g)"/>${shapes}
${text}
<text x="44" y="580" font-family="Figtree, Arial, sans-serif" font-size="30" font-weight="600" fill="#fff" opacity="0.8">${esc(artistName)}</text>
</svg>`;
}
