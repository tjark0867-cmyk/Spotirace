import type { ArtistSummary, ItemKind, LegPublic, PlayerPublic, RoomState, TeamPublic } from '../../../shared/types';

/** Hilfsfunktionen für Team-Staffel und Sabotage (alles nur aus dem Spielstand, ohne Anfragen) */

export const isRelay = (state: RoomState) => !!state.teams && state.phase !== 'lobby';

export function myTeam(state: RoomState): TeamPublic | null {
  return state.teams?.find((t) => t.members.includes(state.you)) ?? null;
}

export function teamOfPlayer(state: RoomState, playerId: string): TeamPublic | null {
  return state.teams?.find((t) => t.members.includes(playerId)) ?? null;
}

export function activeLeg(team: TeamPublic | null): LegPublic | null {
  return team ? (team.legs[team.active] ?? null) : null;
}

/** Bin ich gerade der Läufer meines Teams? (Klassisch: spiele ich noch?) */
export function amRunner(state: RoomState): boolean {
  const me = state.players.find((p) => p.id === state.you);
  if (!isRelay(state)) return me?.status === 'playing';
  const team = myTeam(state);
  return !!team && team.status === 'playing' && activeLeg(team)?.runnerId === state.you;
}

/** Wohin muss ich gerade? Klassisch das Ziel, in der Staffel das Ende meiner Etappe */
export function currentGoal(state: RoomState): { artist: ArtistSummary | null; kind: 'target' | 'checkpoint' } {
  if (isRelay(state)) {
    const team = myTeam(state);
    const leg = activeLeg(team);
    if (team && leg) return { artist: leg.to, kind: leg.index < team.legs.length - 1 ? 'checkpoint' : 'target' };
  }
  return { artist: state.target, kind: 'target' };
}

/** Die ganze Strecke: Start → Wechselpunkte → Ziel */
export function route(state: RoomState, size?: number): Array<ArtistSummary | null> {
  const legs = size ?? teamSize(state);
  return [state.start, ...state.checkpoints.slice(0, Math.max(0, legs - 1)), state.target];
}

/** Teamgröße in der Lobby (2 oder 3; bestimmt die Zahl der Wechselpunkte) */
export function teamSize(state: RoomState): number {
  if (state.teams?.[0]?.legs.length) return state.teams[0].legs.length;
  const max = Math.max(0, ...(state.teams ?? []).map((t) => t.members.length));
  return Math.min(3, Math.max(2, max));
}

/** Wen ich gerade angreifen darf */
export function attackTargets(state: RoomState): PlayerPublic[] {
  if (isRelay(state)) {
    const mine = myTeam(state);
    return state.teams!
      .filter((t) => t !== mine && t.status === 'playing')
      .map((t) => state.players.find((p) => p.id === activeLeg(t)?.runnerId))
      .filter((p): p is PlayerPublic => !!p);
  }
  return state.players.filter((p) => p.id !== state.you && p.status === 'playing');
}

export const active = (until: number | null | undefined, now: number) => !!until && until > now;

export const secondsLeft = (until: number | null | undefined, now: number) => (until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0);

/** „Mia hat dich eingefroren!“ */
export const ITEM_VERB: Record<ItemKind, string> = {
  freeze: 'eingefroren',
  ink: 'mit Tinte bekleckert',
  rewind: 'zurückgespult',
  shield: 'ein Schild aufgestellt',
  key: 'den Generalschlüssel benutzt',
  peek: 'auf den Spickzettel geschaut',
};

/** „Wen willst du einfrieren?“ */
export const ITEM_ASK: Record<ItemKind, string> = {
  freeze: 'Wen willst du einfrieren?',
  ink: 'Wem verschmierst du die Sicht?',
  rewind: 'Wen spulst du zurück?',
  shield: '',
  key: '',
  peek: '',
};

export function playerName(state: RoomState, id: string | null | undefined): string {
  if (!id) return '';
  return state.players.find((p) => p.id === id)?.name ?? 'Jemand';
}
