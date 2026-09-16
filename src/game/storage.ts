export interface ScoreRow {
  name: string;
  score: number;
  level: number;
  time: number;
  shape: string;
  kills: number;
  date: number;
}

const KEY = 'polygon-siege-scores-v1';
const MUTE_KEY = 'polygon-siege-muted-v1';
const BEST_KEY = 'polygon-siege-best-v1';

export function loadScores(): ScoreRow[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows)) return [];
    return rows.slice(0, 10);
  } catch { return []; }
}

export function saveScore(row: ScoreRow): ScoreRow[] {
  const rows = loadScores();
  rows.push(row);
  rows.sort((a, b) => b.score - a.score);
  const top = rows.slice(0, 10);
  try { localStorage.setItem(KEY, JSON.stringify(top)); } catch { /* ignore */ }
  return top;
}

export function clearScores() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function loadBest(): number {
  try { return parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch { return 0; }
}

export function saveBest(v: number) {
  try { localStorage.setItem(BEST_KEY, String(Math.floor(v))); } catch { /* ignore */ }
}

export function loadMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

export function saveMuted(m: boolean) {
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* ignore */ }
}
