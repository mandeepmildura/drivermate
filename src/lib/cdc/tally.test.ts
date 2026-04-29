import { describe, expect, it } from 'vitest';
import { groupedBoardingAt, setBoardedCountAt } from './tally';
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
