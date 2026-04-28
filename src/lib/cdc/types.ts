export type StopCode =
  | 'BXG'
  | 'SPE'
  | 'BRL'
  | 'DHX'
  | 'KRA'
  | 'LCH'
  | 'LBG'
  | 'SWH'
  | 'NYH'
  | 'WOO'
  | 'PGL'
  | 'MGN'
  | 'ANU'
  | 'BNN'
  | 'RBC'
  | 'EUS'
  | 'MQL';

export type RouteCode = 'C011' | 'C012';

export type TicketType = 'eTicket' | 'Paper';

export type PassengerStatus = 'expected' | 'boarded' | 'noshow' | 'walkup' | 'alighted';

export type Passenger = {
  id: string;
  seat: string;
  name: string;
  joinStop: StopCode;
  leaveStop: StopCode;
  ticketType: TicketType;
  priority: boolean;
  status: PassengerStatus;
};

export type ReasonCode = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const REASON_LABELS: Record<ReasonCode, string> = {
  1: 'Train Late',
  2: 'Breakdown',
  3: 'Traffic',
  4: 'Weather',
  5: 'Passenger',
  6: 'Ticket Sales',
  7: 'Roadworks',
  8: 'Other',
};

export type TimekeepingEntry = {
  id: string;
  date: string;
  routeCode: RouteCode;
  minsLate: number;
  timeRecorded: string;
  location: StopCode;
  reasonCode: ReasonCode;
};

export type ArrivalStatus = 'early' | 'ontime' | 'late';

export type Form25State = {
  weekEnding: string;
  backupBoardings: number;
  arrival: ArrivalStatus;
  lateMins: number;
  entries: TimekeepingEntry[];
};

export type RunState = {
  routeCode: RouteCode;
  startedAt: string;
  passengers: Passenger[];
  currentStopIndex: number;
  stopArrivals: Partial<Record<StopCode, string>>;
  form25?: Form25State;
};
