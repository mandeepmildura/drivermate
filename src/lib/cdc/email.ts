import { ROUTES } from './stops';
import { totalServiceBoardings } from './tally';
import { REASON_LABELS, type Form25State, type RunState } from './types';

function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0');
}

function formatDateLong(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function arrivalLine(form: Form25State): string {
  if (form.arrival === 'late') return `Arrival: ${form.lateMins} minutes late`;
  if (form.arrival === 'early') return 'Arrival: Early';
  return 'Arrival: On time';
}

export function formatForm25Email(state: RunState): string {
  if (!state.form25) return '';
  const form = state.form25;
  const route = ROUTES[state.routeCode];
  const lines: string[] = [];
  lines.push('CDC V/Line — Form 25');
  lines.push(`Route: ${route.label}`);
  lines.push(`Week ending: ${formatDateLong(form.weekEnding)}`);
  lines.push('');
  lines.push(`Total Service Boardings: ${totalServiceBoardings(state.passengers)}`);
  lines.push(`Total Back Up Boardings: ${form.backupBoardings}`);
  lines.push('');
  lines.push(arrivalLine(form));

  if (form.arrival === 'late' && form.entries.length > 0) {
    lines.push('');
    lines.push('Timekeeping:');
    lines.push('Date        Route  Mins  Time   Location  Reason');
    for (const e of form.entries) {
      const date = e.date.padEnd(10);
      const routeCol = e.routeCode.padEnd(5);
      const mins = String(e.minsLate).padEnd(4);
      const time = e.timeRecorded.padEnd(5);
      const loc = e.location.padEnd(8);
      lines.push(`${date}  ${routeCol}  ${mins}  ${time}  ${loc}  ${e.reasonCode} (${REASON_LABELS[e.reasonCode]})`);
    }
  }

  return lines.join('\n');
}

export function form25Subject(state: RunState): string {
  const form = state.form25;
  const wk = form ? formatDateLong(form.weekEnding) : '';
  return `Form 25 ${state.routeCode} — week ending ${wk}`;
}
