import type { RouteCode, StopCode } from './types';

export const STOP_NAMES: Record<StopCode, string> = {
  BXG: 'Bendigo',
  SPE: 'Serpentine',
  BRL: 'Bears Lagoon',
  DHX: 'Durham Ox',
  KRA: 'Kerang',
  LCH: 'Lake Charm',
  LBG: 'Lake Boga',
  SWH: 'Swan Hill',
  NYH: 'Nyah',
  WOO: 'Wood Wood',
  PGL: 'Piangil',
  MGN: 'Manangatang',
  ANU: 'Annuello T/O',
  BNN: 'Bannerton T/O',
  RBC: 'Robinvale',
  EUS: 'Euston',
  MQL: 'Mildura',
};

export const ROUTES: Record<RouteCode, { label: string; stops: StopCode[] }> = {
  C011: {
    label: 'C011 Bendigo → Mildura',
    stops: [
      'BXG',
      'SPE',
      'BRL',
      'DHX',
      'KRA',
      'LCH',
      'LBG',
      'SWH',
      'NYH',
      'WOO',
      'PGL',
      'MGN',
      'ANU',
      'BNN',
      'RBC',
      'EUS',
      'MQL',
    ],
  },
  C012: {
    label: 'C012 Mildura → Bendigo',
    stops: [
      'MQL',
      'EUS',
      'RBC',
      'BNN',
      'ANU',
      'MGN',
      'PGL',
      'WOO',
      'NYH',
      'SWH',
      'LBG',
      'LCH',
      'KRA',
      'DHX',
      'BRL',
      'SPE',
      'BXG',
    ],
  },
};

export const ALL_STOP_CODES: StopCode[] = Object.keys(STOP_NAMES) as StopCode[];

export function stopLabel(code: StopCode): string {
  return `${code} ${STOP_NAMES[code]}`;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/t\/o|turn[- ]?off/g, '').replace(/[^a-z]/g, '');
}

const NAME_TO_CODE: Record<string, StopCode> = (() => {
  const m: Record<string, StopCode> = {};
  for (const [code, name] of Object.entries(STOP_NAMES) as [StopCode, string][]) {
    m[normalize(name)] = code;
    m[normalize(code)] = code;
  }
  return m;
})();

export function stopCodeFromName(stopName: string | null | undefined): StopCode | null {
  if (!stopName) return null;
  const direct = NAME_TO_CODE[normalize(stopName)];
  if (direct) return direct;
  const norm = normalize(stopName);
  for (const code of ALL_STOP_CODES) {
    if (norm.includes(normalize(STOP_NAMES[code]))) return code;
  }
  return null;
}
