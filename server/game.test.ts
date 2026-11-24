/**
 * Server-Tests für Team-Staffel und Sabotage.
 * Starten mit: npm test   (läuft komplett mit den erfundenen Demo-Daten, ohne Spotify)
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import type { ClientMessage, FxEvent, ItemKind, RoomState, ServerMessage } from '../shared/types';
import { GameServer } from './game';
import { DemoProvider } from './music/demo';

// ---------- Testaufbau ----------

class FakeSocket extends EventEmitter {
  readonly OPEN = 1;
  readyState = 1;
  inbox: ServerMessage[] = [];
  send(data: string) {
    this.inbox.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
    this.emit('close');
  }
}

class CountingDemo extends DemoProvider {
  sectionCalls = 0;
  override async getInitialSections(artistId: string) {
    this.sectionCalls++;
    return super.getInitialSections(artistId);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor(cond: () => boolean, what = 'Bedingung', timeout = 3000) {
  const end = Date.now() + timeout;
  while (!cond()) {
    if (Date.now() > end) throw new Error(`Zeitüberschreitung beim Warten auf: ${what}`);
    await sleep(5);
  }
}

class Client {
  ws = new FakeSocket();
  constructor(
    server: GameServer,
    public session: string,
  ) {
    server.attach(this.ws as never);
    this.ws.emit('message', JSON.stringify({ t: 'hello', sessionId: session }));
  }
  get state(): RoomState {
    for (let i = this.ws.inbox.length - 1; i >= 0; i--) {
      const m = this.ws.inbox[i];
      if (m.t === 'state') return m.state;
    }
    throw new Error(`${this.session}: noch kein Spielstand`);
  }
  get me() {
    return this.state.players.find((p) => p.id === this.state.you)!;
  }
  get fx(): FxEvent[] {
    return this.ws.inbox.flatMap((m) => (m.t === 'fx' ? [m.fx] : []));
  }
  /** Schickt eine Nachricht und wartet, bis der Server geantwortet hat */
  async send(msg: ClientMessage) {
    const before = this.ws.inbox.length;
    this.ws.emit('message', JSON.stringify(msg));
    await waitFor(() => this.ws.inbox.length > before, `Antwort auf ${msg.t}`);
    await sleep(2);
  }
  lastError(): string | null {
    for (let i = this.ws.inbox.length - 1; i >= 0; i--) {
      const m = this.ws.inbox[i];
      if (m.t === 'error' || m.t === 'moveFailed') return m.message;
      if (m.t === 'state') return null;
    }
    return null;
  }
  async expectError(msg: ClientMessage, pattern: RegExp) {
    const before = this.ws.inbox.length;
    this.ws.emit('message', JSON.stringify(msg));
    await waitFor(() => this.ws.inbox.slice(before).some((m) => m.t === 'error' || m.t === 'moveFailed'), `Fehler bei ${msg.t}`);
    const err = this.ws.inbox.slice(before).find((m) => m.t === 'error' || m.t === 'moveFailed') as { message: string };
    assert.match(err.message, pattern);
  }
  /** Zug machen und warten, bis er durch ist */
  async move(albumId: string, trackNo: number, artistId: string) {
    const before = this.ws.inbox.length;
    this.ws.emit('message', JSON.stringify({ t: 'move', albumId, trackId: `${albumId}-t${trackNo}`, artistId }));
    await waitFor(
      () =>
        this.ws.inbox.slice(before).some(
          (m) =>
            m.t === 'moveFailed' ||
            (m.t === 'state' &&
              ((m.state.yourPath.length > 0 && m.state.yourPath.at(-1)!.artist.id === artistId) ||
                // Staffel: Etappe geschafft → man ist danach Zuschauer
                !!m.state.teams?.some((t) => t.legs.some((l) => l.runnerId === m.state.you && l.endAt && l.path?.at(-1)?.artist.id === artistId)))),
        ),
      `Zug zu ${artistId}`,
    );
    const failed = this.ws.inbox.slice(before).find((m) => m.t === 'moveFailed') as { message: string } | undefined;
    if (failed) throw new Error(`Zug abgelehnt: ${failed.message}`);
  }
}

const GENRES: Record<string, string[]> = { nova: ['pop', 'synthpop'], kompass: ['dance', 'edm'], zeno: ['techno'] };
const A = (id: string) => ({ id, name: id, image: null, imageSmall: null, genres: GENRES[id] ?? [], url: null });

function setup(opts: { handoverMs?: number } = {}) {
  let offset = 0;
  const queue: number[] = [];
  const provider = new CountingDemo();
  const server = new GameServer(provider, () => {}, null, {
    countdownMs: 15,
    handoverMs: opts.handoverMs ?? 40,
    now: () => Date.now() + offset,
    random: () => (queue.length ? queue.shift()! : Math.random()),
  });
  let n = 0;
  const client = () => new Client(server, `s${++n}-${Math.random()}`);
  return {
    server,
    provider,
    client,
    advance: (ms: number) => (offset += ms),
    /** Nächste Zufallszahlen festlegen (z. B. für die Item-Kiste) */
    nextRandom: (...values: number[]) => queue.push(...values),
    /** Direkter Zugriff auf einen Spieler im Raum (nur für Tests) */
    rawPlayer(code: string, id: string) {
      const room = (server as unknown as { rooms: Map<string, { players: Array<{ id: string; items: ItemKind[]; attackReadyAt: number }> }> }).rooms.get(code)!;
      return room.players.find((p) => p.id === id)!;
    },
  };
}

async function lobby(env: ReturnType<typeof setup>, names: string[]) {
  const clients = names.map(() => env.client());
  await clients[0].send({ t: 'create', name: names[0] });
  const code = clients[0].state.code;
  for (let i = 1; i < clients.length; i++) await clients[i].send({ t: 'join', code, name: names[i] });
  return { clients, code };
}

async function readyAll(clients: Client[]) {
  for (const c of clients.slice(1)) await c.send({ t: 'ready', ready: true });
}

async function startRelay(env: ReturnType<typeof setup>, sabotage = false) {
  const { clients, code } = await lobby(env, ['Alex', 'Mia', 'Sam', 'Leo']);
  const [host] = clients;
  await host.send({ t: 'settings', settings: { mode: 'relay', sabotage } });
  await host.send({ t: 'setArtist', which: 'start', artist: A('nova') });
  await host.send({ t: 'setArtist', which: 'checkpoint', index: 0, artist: A('kompass') });
  await host.send({ t: 'setArtist', which: 'target', artist: A('zeno') });
  await readyAll(clients);
  await host.send({ t: 'start' });
  await waitFor(() => clients.every((c) => c.state.phase === 'playing'), 'Spielstart');
  const teams = host.state.teams!;
  const byId = new Map(clients.map((c) => [c.state.you, c]));
  const green = teams.find((t) => t.id === 'green')!.members.map((id) => byId.get(id)!);
  const pink = teams.find((t) => t.id === 'pink')!.members.map((id) => byId.get(id)!);
  return { clients, code, green, pink };
}

// ---------- Teams in der Lobby ----------

test('Lobby: Staffel verteilt Spieler automatisch auf zwei gleich große Teams', async () => {
  const env = setup();
  const { clients } = await lobby(env, ['Alex', 'Mia', 'Sam', 'Leo']);
  const [host] = clients;
  await host.send({ t: 'settings', settings: { mode: 'relay' } });
  const teams = host.state.teams!;
  assert.equal(teams.length, 2);
  assert.deepEqual(teams.map((t) => t.members.length), [2, 2]);
  assert.ok(host.state.players.every((p) => p.team !== null));

  // Wer später kommt, landet im kleineren Team
  const fifth = env.client();
  await fifth.send({ t: 'join', code: host.state.code, name: 'Nina' });
  assert.equal(fifth.me.team, 'green');
});

test('Lobby: Teams sind auf 3 begrenzt, Mischen ergibt gleich große Teams', async () => {
  const env = setup();
  const { clients } = await lobby(env, ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  const [host] = clients;
  await host.send({ t: 'settings', settings: { mode: 'relay' } });
  // 7 Spieler: 3 + 3, einer schaut zu
  assert.deepEqual(host.state.teams!.map((t) => t.members.length), [3, 3]);
  const spectator = clients.find((c) => c.me.team === null)!;
  await spectator.expectError({ t: 'setTeam', team: 'green' }, /voll/);

  await host.send({ t: 'shuffleTeams' });
  const sizes = host.state.teams!.map((t) => t.members.length);
  assert.deepEqual(sizes, [3, 3]);
  const all = host.state.teams!.flatMap((t) => t.members);
  assert.equal(new Set(all).size, 6);
});

test('Lobby: Staffel startet nur mit gleich großen Teams und allen Wechselpunkten', async () => {
  const env = setup();
  const { clients } = await lobby(env, ['Alex', 'Mia', 'Sam', 'Leo']);
  const [host, mia] = clients;
  await host.send({ t: 'settings', settings: { mode: 'relay' } });
  await host.send({ t: 'setArtist', which: 'start', artist: A('nova') });
  await host.send({ t: 'setArtist', which: 'target', artist: A('zeno') });
  await readyAll(clients);
  await host.expectError({ t: 'start' }, /Wechselpunkt/);

  await host.expectError({ t: 'setArtist', which: 'checkpoint', index: 0, artist: A('zeno') }, /verschiedene/);
  await host.send({ t: 'setArtist', which: 'checkpoint', index: 0, artist: A('kompass') });

  // Mia wechselt das Team → 3 gegen 1
  const other = mia.me.team === 'green' ? 'pink' : 'green';
  await mia.send({ t: 'setTeam', team: other });
  await host.expectError({ t: 'start' }, /gleich große Teams/);
});

// ---------- Staffel-Ablauf ----------

test('Staffel: Übergabe am Wechselpunkt, Teamzeit = Summe der Etappen', async () => {
  const env = setup({ handoverMs: 120 });
  const { green, pink, clients } = await startRelay(env);
  const [g1, g2] = green;

  // Nur Läufer 1 darf klicken
  await g2.expectError({ t: 'move', albumId: 'r1d', trackId: 'r1d-t8', artistId: 'kompass' }, /jemand anderes/);
  assert.equal(g2.state.yourPath.length, 0, 'Wartende haben keinen eigenen Weg');
  assert.equal(g1.state.yourPath.length, 1);

  // A → B: Nova → DJ Kompass (Remix auf der Deluxe-Edition)
  await g1.move('r1d', 8, 'kompass');
  await waitFor(() => g2.fx.some((f) => f.kind === 'handover'), 'Übergabe');
  const handover = g2.fx.find((f) => f.kind === 'handover')!;
  assert.equal(handover.kind === 'handover' && handover.to, g2.state.you);
  const team = g1.state.teams!.find((t) => t.id === 'green')!;
  assert.equal(team.active, 1);
  assert.ok(team.legs[0].endAt);
  assert.equal(g1.state.yourPath.length, 0, 'Läufer 1 ist jetzt Zuschauer');
  assert.equal(g2.state.yourPath[0].artist.id, 'kompass', 'Läufer 2 startet bei B');

  // Während der Übergabe kann Läufer 2 noch nicht los
  await g2.expectError({ t: 'move', albumId: 'r7', trackId: 'r7-t4', artistId: 'zeno' }, /Stab/);
  await sleep(140);

  // B → C: DJ Kompass → Zeno Black
  await g2.move('r7', 4, 'zeno');
  await waitFor(() => g1.state.teams!.find((t) => t.id === 'green')!.status === 'finished', 'Team im Ziel');
  const done = g1.state.teams!.find((t) => t.id === 'green')!;
  assert.equal(done.place, 1);
  const legSum = done.legs.reduce((s, l) => s + (l.endAt! - l.startAt!), 0);
  assert.equal(done.finishMs, legSum);
  assert.equal(done.clicks, 2);
  assert.ok(g1.me.status === 'finished' && g2.me.status === 'finished');

  // Team Pink gibt auf → Ergebnis
  await pink[0].send({ t: 'giveUp' });
  await waitFor(() => clients[0].state.phase === 'results', 'Ergebnis');
  const res = pink[1].state.teams!;
  assert.equal(res.find((t) => t.id === 'pink')!.status, 'gaveup');
  assert.ok(res.find((t) => t.id === 'green')!.legs.every((l) => l.path && l.path.length === 2), 'im Ergebnis sieht jeder alle Etappen');
});

test('Staffel: Gegner sehen den Weg des anderen Teams erst im Ergebnis', async () => {
  const env = setup();
  const { green, pink } = await startRelay(env);
  await green[0].move('r1', 2, 'kaito');
  const seenByPink = pink[1].state.teams!.find((t) => t.id === 'green')!;
  assert.equal(seenByPink.legs[0].path, null);
  assert.equal(seenByPink.legs[0].current?.id, 'kaito', '„Gegner live sehen“ ist an');
  const seenByMate = green[1].state.teams!.find((t) => t.id === 'green')!;
  assert.equal(seenByMate.legs[0].path?.length, 2, 'Teamkollegen sehen live mit');
  assert.equal(seenByMate.legs[0].clicks, 1);
});

test('Staffel: Teamkollege übernimmt, wenn der Läufer 30 s weg ist', async () => {
  const env = setup();
  const { green } = await startRelay(env);
  const [g1, g2] = green;
  g1.ws.close();
  await waitFor(() => g2.state.players.find((p) => p.id === g1.state.you)!.connected === false, 'offline');
  const at = g2.state.teams!.find((t) => t.id === 'green')!.takeoverAt;
  assert.ok(at && at > g2.state.serverNow + 29_000);
  await g2.expectError({ t: 'takeover' }, /30 Sekunden/);

  env.advance(31_000);
  await g2.send({ t: 'takeover' });
  assert.ok(g2.fx.some((f) => f.kind === 'takeover'));
  const leg = g2.state.teams!.find((t) => t.id === 'green')!.legs[0];
  assert.equal(leg.runnerId, g2.state.you);
  await g2.move('r1d', 8, 'kompass');
  // Läufer 2 ist jetzt auch für Etappe 2 dran (er war sowieso eingeplant)
  assert.equal(g2.state.teams!.find((t) => t.id === 'green')!.active, 1);
});

test('Staffel: Anfeuern geht nur ans eigene Team', async () => {
  const env = setup();
  const { green, pink } = await startRelay(env);
  await green[1].send({ t: 'cheer', sticker: 'flame' });
  await waitFor(() => green[0].fx.some((f) => f.kind === 'cheer'), 'Sticker');
  assert.ok(!pink[0].fx.some((f) => f.kind === 'cheer'));
});

// ---------- Sabotage ----------

async function classicSabotage(env: ReturnType<typeof setup>, names = ['Alex', 'Mia']) {
  const { clients, code } = await lobby(env, names);
  const [host] = clients;
  await host.send({ t: 'settings', settings: { sabotage: true } });
  await host.send({ t: 'setArtist', which: 'start', artist: A('nova') });
  await host.send({ t: 'setArtist', which: 'target', artist: A('zeno') });
  await readyAll(clients);
  await host.send({ t: 'start' });
  await waitFor(() => clients.every((c) => c.state.phase === 'playing'), 'Spielstart');
  return { clients, code };
}

test('Sabotage: Nach jedem 2. Sprung gibt es eine Kiste, höchstens 2 Items', async () => {
  const env = setup();
  const { clients } = await classicSabotage(env);
  const [alex] = clients;
  assert.equal(alex.state.sabotage!.crateIn, 2);
  await alex.move('r1', 2, 'kaito');
  assert.equal(alex.state.sabotage!.crateIn, 1);
  env.nextRandom(0); // → Eiskristall
  await alex.move('r1', 2, 'nova');
  await waitFor(() => alex.fx.some((f) => f.kind === 'crate'), 'Kiste');
  assert.deepEqual(alex.state.sabotage!.items, ['freeze']);
  assert.equal(alex.state.sabotage!.crateIn, 2);

  env.nextRandom(0.99); // → Spickzettel
  await alex.move('r1', 2, 'kaito');
  await alex.move('r1', 2, 'nova');
  assert.deepEqual(alex.state.sabotage!.items, ['freeze', 'peek']);

  // Inventar voll → keine dritte Kiste, aber sie wartet
  await alex.move('r1', 2, 'kaito');
  await alex.move('r1', 2, 'nova');
  assert.equal(alex.state.sabotage!.items.length, 2);
  assert.ok(alex.fx.some((f) => f.kind === 'crateFull'));
  assert.equal(alex.state.sabotage!.crateIn, 0);
});

test('Sabotage: Item-Zufall verteilt alle 6 Items, ohne Gegner nur eigene Items', async () => {
  const env = setup();
  const { clients, code } = await classicSabotage(env);
  const rooms = (env.server as unknown as { rooms: Map<string, unknown> }).rooms;
  const room = rooms.get(code) as { players: Array<{ id: string }> };
  const roll = (env.server as unknown as { rollItem: (r: unknown, p: unknown) => ItemKind }).rollItem.bind(env.server);
  const counts = new Map<ItemKind, number>();
  for (let i = 0; i < 3000; i++) {
    const k = roll(room, room.players[0]);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  assert.equal(counts.size, 6);
  for (const [, n] of counts) assert.ok(n > 300 && n < 700, `ungleich verteilt: ${[...counts]}`);

  // Mia gibt auf → Alex hat keine Gegner mehr
  await clients[1].send({ t: 'giveUp' });
  for (let i = 0; i < 300; i++) {
    const k = roll(room, room.players[0]);
    assert.ok(['shield', 'key', 'peek'].includes(k), `Angriffs-Item ohne Gegner: ${k}`);
  }
});

test('Sabotage: Eiskristall friert ein, Abklingzeit, gleiche Effekte stapeln nicht', async () => {
  const env = setup();
  const { clients, code } = await classicSabotage(env, ['Alex', 'Mia', 'Sam']);
  const [alex, mia, sam] = clients;
  env.rawPlayer(code, alex.state.you).items = ['freeze', 'ink'];
  env.rawPlayer(code, sam.state.you).items = ['freeze'];

  await alex.send({ t: 'useItem', slot: 0, targetId: mia.state.you });
  await waitFor(() => mia.fx.some((f) => f.kind === 'item'), 'Angriff kommt an');
  const hit = mia.fx.find((f) => f.kind === 'item')!;
  assert.ok(hit.kind === 'item' && hit.item === 'freeze' && hit.from === alex.state.you && !hit.blocked);
  assert.ok(mia.me.effects.frozenUntil);
  await mia.expectError({ t: 'move', albumId: 'r1', trackId: 'r1-t2', artistId: 'kaito' }, /eingefroren/);

  // Abklingzeit beim Angreifer
  await alex.expectError({ t: 'useItem', slot: 0, targetId: sam.state.you }, /Abklingzeit/);
  assert.deepEqual(alex.state.sabotage!.items, ['ink'], 'abgelehnter Angriff kostet kein Item');

  // Zweites Einfrieren stapelt nicht
  await sam.expectError({ t: 'useItem', slot: 0, targetId: mia.state.you }, /schon eingefroren/);

  // Nach 10 s taut Mia auf
  env.advance(10_500);
  await mia.move('r1', 2, 'kaito');
});

test('Sabotage: Schild blockt den nächsten Angriff und verschwindet dann', async () => {
  const env = setup();
  const { clients, code } = await classicSabotage(env);
  const [alex, mia] = clients;
  env.rawPlayer(code, alex.state.you).items = ['ink', 'ink'];
  env.rawPlayer(code, mia.state.you).items = ['shield'];
  await mia.send({ t: 'useItem', slot: 0 });
  assert.ok(alex.state.players.find((p) => p.id === mia.state.you)!.effects.shieldUntil, 'Schild ist für alle sichtbar');

  await alex.send({ t: 'useItem', slot: 0, targetId: mia.state.you });
  const fx = mia.fx.find((f) => f.kind === 'item' && f.from === alex.state.you)!;
  assert.ok(fx.kind === 'item' && fx.blocked);
  assert.equal(mia.me.effects.shieldUntil, null);
  assert.equal(mia.me.effects.inkUntil, null);

  env.advance(20_500);
  await alex.send({ t: 'useItem', slot: 0, targetId: mia.state.you });
  assert.ok(mia.me.effects.inkUntil, 'ohne Schild wirkt die Tinte');
  assert.equal(alex.me.attacksSent, 2);
  assert.equal(alex.me.attacksHit, 1);
});

test('Sabotage: Rückspulen setzt den Gegner einen Artist zurück', async () => {
  const env = setup();
  const { clients, code } = await classicSabotage(env);
  const [alex, mia] = clients;
  env.rawPlayer(code, alex.state.you).items = ['rewind'];
  await alex.expectError({ t: 'useItem', slot: 0, targetId: mia.state.you }, /noch am Start/);
  assert.deepEqual(env.rawPlayer(code, alex.state.you).items, ['rewind'], 'abgelehnt → Item bleibt');

  await mia.move('r1', 2, 'kaito');
  await alex.send({ t: 'useItem', slot: 0, targetId: mia.state.you });
  const last = mia.state.yourPath.at(-1)!;
  assert.equal(last.artist.id, 'nova');
  assert.equal(last.rewind, true);
  assert.equal(mia.me.clicks, 1, 'Rückspulen zählt nicht als Klick');
});

test('Sabotage: Generalschlüssel macht gesperrte Songs auswählbar', async () => {
  const env = setup();
  const { clients, code } = await classicSabotage(env);
  const [, mia] = clients;
  // „Paper Moon“ (Mila) – Nova ist nur auf „Glasshouse“. „Bailando Sola“ (Mila, Rico) ist gesperrt.
  await mia.expectError({ t: 'move', albumId: 'r16', trackId: 'r16-t3', artistId: 'rico' }, /nicht dabei/);
  env.rawPlayer(code, mia.state.you).items = ['key'];
  await mia.send({ t: 'useItem', slot: 0 });
  assert.ok(mia.me.effects.keyUntil);
  await mia.move('r16', 3, 'rico');
  assert.equal(mia.state.yourPath.at(-1)!.artist.id, 'rico');

  // Ein fremdes Album ohne Nova bleibt trotzdem tabu
  env.advance(16_000);
  await mia.expectError({ t: 'move', albumId: 'r7', trackId: 'r7-t4', artistId: 'zeno' }, /nicht dabei/);
});

test('Sabotage: Spickzettel zeigt das Ziel und fragt höchstens einmal nach', async () => {
  const env = setup();
  const { clients, code } = await classicSabotage(env);
  const [alex, mia] = clients;
  env.rawPlayer(code, alex.state.you).items = ['peek'];
  env.rawPlayer(code, mia.state.you).items = ['peek'];
  const before = env.provider.sectionCalls;
  await alex.send({ t: 'useItem', slot: 0 });
  const peek = alex.state.sabotage!.peek!;
  assert.equal(peek.artist.id, 'zeno');
  assert.deepEqual(peek.genres, ['techno']);
  assert.ok(peek.covers.length >= 1 && peek.covers.length <= 3);
  assert.equal(mia.state.sabotage!.peek, null, 'nur für den, der ihn benutzt');
  await mia.send({ t: 'useItem', slot: 0 });
  assert.equal(env.provider.sectionCalls - before, 1);

  env.advance(15_500);
  await alex.move('r1', 2, 'kaito');
  assert.equal(alex.state.sabotage!.peek, null, 'nach 15 s wieder weg');
});

test('Sabotage in der Staffel: nur der aktive Läufer des anderen Teams ist angreifbar, Items wandern mit dem Stab', async () => {
  const env = setup();
  const { green, pink, code } = await startRelay(env, true);
  const [g1, g2] = green;
  const [p1, p2] = pink;
  env.rawPlayer(code, g1.state.you).items = ['freeze', 'shield'];

  await g1.expectError({ t: 'useItem', slot: 0, targetId: g2.state.you }, /nicht angreifen/);
  await g1.expectError({ t: 'useItem', slot: 0, targetId: p2.state.you }, /nicht angreifen/);
  await g2.expectError({ t: 'useItem', slot: 0, targetId: p1.state.you }, /kein Item|gerade läuft/);
  await g1.send({ t: 'useItem', slot: 0, targetId: p1.state.you });
  assert.ok(p1.me.effects.frozenUntil);

  // Übergabe: das übrige Schild geht an Läufer 2
  await g1.move('r1d', 8, 'kompass');
  await waitFor(() => g2.state.sabotage!.items.length === 1, 'Item weitergegeben');
  assert.deepEqual(g2.state.sabotage!.items, ['shield']);
  assert.deepEqual(g1.state.sabotage!.items, []);
});
