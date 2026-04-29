import { describe, expect, it } from 'vitest';
import {
  findSeatConflicts,
  groupedBoardingAt,
  ledgerSnapshot,
  nextActiveStopIndex,
  setBoardedCountAt,
} from './tally';
import type { Passenger, RouteCode, StopCode } from './types';

function pax(seat: string, joinStop: StopCode, leaveStop: StopCode): Passenger {
  return {
    id: `${seat}-${joinStop}-${leaveStop}`,
    seat,
    name: `pax-${seat}`,
    joinStop,
    leaveStop,
    ticketType: 'eTicket',
    priority: false,
    status: 'expected',
  };
}

const C012: RouteCode = 'C012'; // Mildura (MQL) → Bendigo (BXG)
const FIRST_STOP: StopCode = 'MQL';

describe('groupedBoardingAt', () => {
  it('returns a single flat group when not at the first stop', () => {
    const passengers = [pax('1', 'NYH', 'BXG'), pax('2', 'NYH', 'SWH')];
    const groups = groupedBoardingAt(passengers, 'NYH', C012);
    expect(groups).toHaveLength(1);
    expect(groups[0].destination).toBeNull();
    expect(groups[0].passengers.map((p) => p.seat)).toEqual(['1', '2']);
  });

  it('returns a single flat group when only one destination is present', () => {
    const passengers = [pax('5', FIRST_STOP, 'BXG'), pax('1', FIRST_STOP, 'BXG')];
    const groups = groupedBoardingAt(passengers, FIRST_STOP, C012);
    expect(groups).toHaveLength(1);
    expect(groups[0].destination).toBeNull();
  });

  it('groups by destination at the first stop, biggest group first', () => {
    const passengers = [
      pax('10', FIRST_STOP, 'SWH'),
      pax('11', FIRST_STOP, 'BXG'),
      pax('12', FIRST_STOP, 'BXG'),
      pax('13', FIRST_STOP, 'BXG'),
      pax('14', FIRST_STOP, 'SWH'),
      pax('15', FIRST_STOP, 'SWH'),
      pax('16', FIRST_STOP, 'SWH'),
    ];
    const groups = groupedBoardingAt(passengers, FIRST_STOP, C012);
    expect(groups.map((g) => g.destination)).toEqual(['SWH', 'BXG']);
    expect(groups[0].passengers.map((p) => p.seat)).toEqual(['10', '14', '15', '16']);
    expect(groups[1].passengers.map((p) => p.seat)).toEqual(['11', '12', '13']);
  });

  it('breaks ties by stop sequence — end-of-line wins', () => {
    // BXG is the last stop on C012; BNN is mid-route. Equal counts → BXG first.
    const passengers = [
      pax('1', FIRST_STOP, 'BNN'),
      pax('2', FIRST_STOP, 'BNN'),
      pax('3', FIRST_STOP, 'BXG'),
      pax('4', FIRST_STOP, 'BXG'),
    ];
    const groups = groupedBoardingAt(passengers, FIRST_STOP, C012);
    expect(groups.map((g) => g.destination)).toEqual(['BXG', 'BNN']);
  });

});

describe('setBoardedCountAt', () => {
  it('marks the lowest-seat boarders boarded, rest expected', () => {
    const passengers = [
      pax('5', FIRST_STOP, 'BXG'),
      pax('1', FIRST_STOP, 'BXG'),
      pax('3', FIRST_STOP, 'SWH'),
      pax('2', FIRST_STOP, 'BXG'),
    ];
    const next = setBoardedCountAt(passengers, FIRST_STOP, 2);
    const byId = Object.fromEntries(next.map((p) => [p.seat, p.status]));
    expect(byId['1']).toBe('boarded');
    expect(byId['2']).toBe('boarded');
    expect(byId['3']).toBe('expected');
    expect(byId['5']).toBe('expected');
  });

  it('does not touch walk-ups or alighted rows', () => {
    const walkup: Passenger = { ...pax('99', FIRST_STOP, 'BXG'), status: 'walkup' };
    const alighted: Passenger = { ...pax('98', FIRST_STOP, 'BXG'), status: 'alighted' };
    const passengers = [pax('1', FIRST_STOP, 'BXG'), walkup, alighted];
    const next = setBoardedCountAt(passengers, FIRST_STOP, 1);
    expect(next.find((p) => p.seat === '99')!.status).toBe('walkup');
    expect(next.find((p) => p.seat === '98')!.status).toBe('alighted');
    expect(next.find((p) => p.seat === '1')!.status).toBe('boarded');
  });

  it('clamps count above the available rows', () => {
    const passengers = [pax('1', FIRST_STOP, 'BXG'), pax('2', FIRST_STOP, 'BXG')];
    const next = setBoardedCountAt(passengers, FIRST_STOP, 99);
    expect(next.every((p) => p.status === 'boarded')).toBe(true);
  });

});

describe('ledgerSnapshot', () => {
  it('counts an untouched manifest as all booked, none on bus', () => {
    const passengers = [
      pax('1', FIRST_STOP, 'BXG'),
      pax('2', FIRST_STOP, 'BXG'),
      pax('3', FIRST_STOP, 'SWH'),
    ];
    const ledger = ledgerSnapshot(passengers, C012, 0);
    expect(ledger.booked).toBe(3);
    expect(ledger.onBus).toBe(0);
    // At stop index 0 with all 'expected', the first-stop joiners count as
    // no-shows once the driver enters the head count.
    expect(ledger.noShows).toBe(3);
    expect(ledger.walkUps).toBe(0);
  });

  it('counts boarded as on-bus and walk-ups separately', () => {
    const passengers: Passenger[] = [
      { ...pax('1', FIRST_STOP, 'BXG'), status: 'boarded' },
      { ...pax('2', FIRST_STOP, 'BXG'), status: 'boarded' },
      { ...pax('3', FIRST_STOP, 'BXG'), status: 'expected' },
      { ...pax('99', FIRST_STOP, 'BXG'), status: 'walkup' },
    ];
    const ledger = ledgerSnapshot(passengers, C012, 0);
    expect(ledger.booked).toBe(4);
    expect(ledger.onBus).toBe(3); // 2 boarded + 1 walkup
    expect(ledger.noShows).toBe(1);
    expect(ledger.walkUps).toBe(1);
  });

  it('drops alighted passengers from on-bus', () => {
    const passengers: Passenger[] = [
      { ...pax('1', FIRST_STOP, 'BNN'), status: 'alighted' },
      { ...pax('2', FIRST_STOP, 'BXG'), status: 'boarded' },
    ];
    // After Bannerton — the alighted passenger has gotten off
    const stopsList = ['MQL', 'EUS', 'RBC', 'BNN'];
    const ledger = ledgerSnapshot(passengers, C012, stopsList.length - 1);
    expect(ledger.onBus).toBe(1);
  });
});

describe('nextActiveStopIndex', () => {
  it('skips stops with no pickups and no dropoffs', () => {
    // C012 stops: MQL=0, EUS=1, RBC=2, BNN=3, ANU=4, MGN=5, ...
    // Only RBC and MGN have activity. From MQL (0), next active should be RBC (2).
    const passengers = [
      pax('1', FIRST_STOP, 'RBC'),
      pax('2', FIRST_STOP, 'MGN'),
    ];
    expect(nextActiveStopIndex(passengers, C012, 0)).toBe(2);
    expect(nextActiveStopIndex(passengers, C012, 2)).toBe(5);
  });

  it('falls back to the last stop when no further activity', () => {
    // Only one passenger MQL→RBC. From RBC there's nothing ahead → last stop.
    const passengers = [pax('1', FIRST_STOP, 'RBC')];
    const lastIdx = 16; // BXG
    expect(nextActiveStopIndex(passengers, C012, 2)).toBe(lastIdx);
  });
});

describe('findSeatConflicts', () => {
  it('returns empty when seats are unique', () => {
    const passengers = [pax('1', FIRST_STOP, 'BXG'), pax('2', FIRST_STOP, 'BXG')];
    expect(findSeatConflicts(passengers, C012).size).toBe(0);
  });

  it('does not flag the same seat across non-overlapping legs', () => {
    // Seat B8 used Mildura → Robinvale, then Robinvale → Bendigo. Touching at
    // RBC but not overlapping — the seat frees up exactly when the second
    // passenger boards.
    const a = pax('B8', 'MQL', 'RBC');
    const b = pax('B8', 'RBC', 'BXG');
    expect(findSeatConflicts([a, b], C012).size).toBe(0);
  });

  it('flags the same seat when legs overlap', () => {
    const a = pax('B8', 'MQL', 'BXG');
    const b = pax('B8', 'MQL', 'SWH');
    const conflicts = findSeatConflicts([a, b], C012);
    expect(conflicts.has(a.id)).toBe(true);
    expect(conflicts.has(b.id)).toBe(true);
  });

  it('flags partial leg overlap', () => {
    // a: MQL → SWH, b: RBC → BXG — they share the bus from RBC to SWH
    const a = pax('B8', 'MQL', 'SWH');
    const b = pax('B8', 'RBC', 'BXG');
    expect(findSeatConflicts([a, b], C012).size).toBe(2);
  });

  it('ignores passengers with no seat', () => {
    const a = pax('', 'MQL', 'BXG');
    const b = pax('', 'MQL', 'BXG');
    expect(findSeatConflicts([a, b], C012).size).toBe(0);
  });
});

describe('groupedBoardingAt seat ordering', () => {
  it('sorts seats numerically within a group, empty seats last', () => {
    const passengers = [
      pax('12', FIRST_STOP, 'BXG'),
      pax('2', FIRST_STOP, 'BXG'),
      pax('', FIRST_STOP, 'BXG'),
      pax('7', FIRST_STOP, 'BXG'),
      pax('1A', FIRST_STOP, 'SWH'),
      pax('1B', FIRST_STOP, 'SWH'),
    ];
    const groups = groupedBoardingAt(passengers, FIRST_STOP, C012);
    const bxg = groups.find((g) => g.destination === 'BXG')!;
    expect(bxg.passengers.map((p) => p.seat)).toEqual(['2', '7', '12', '']);
  });
});
