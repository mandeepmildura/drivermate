// Daily DriverMate report — runs once a day, emails a PDF summary of yesterday's
// school shifts (AM/PM totals + per-shift detail). V/Line routes are skipped
// in v1; awaiting format spec from operator.
//
// Required env vars (set via `supabase secrets set` or dashboard):
//   RESEND_API_KEY       — Resend API key
//   REPORT_EMAIL_TO      — recipient (defaults to mandeep@freshoz.com)
//   REPORT_EMAIL_FROM    — sender, must be a verified Resend domain
//                          (defaults to onboarding@resend.dev for testing)

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { jsPDF } from 'npm:jspdf@2.5.2';
import { Resend } from 'npm:resend@4';

const TZ = 'Australia/Melbourne';

interface ShiftRow {
  id: string;
  started_at: string;
  driver: { full_name: string; driver_number: string } | null;
  route: { route_number: string; service_type: string } | null;
}

interface ReportRow {
  shiftId: string;
  driver: string;
  route: string;
  period: 'AM' | 'PM' | 'OTHER';
  pickups: number;
}

function classifyPeriod(routeNumber: string): ReportRow['period'] {
  const upper = routeNumber.toUpperCase();
  if (upper.endsWith('-AM') || upper.endsWith(' AM')) return 'AM';
  if (upper.endsWith('-PM') || upper.endsWith(' PM')) return 'PM';
  return 'OTHER';
}

// Yesterday in Melbourne — returns [startUtc, endUtc, dateLabel].
function melbourneYesterday(): [string, string, string] {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  const todayMelb = fmt.format(now);
  const [y, m, d] = todayMelb.split('-').map(Number);
  // Yesterday's local midnight, expressed as UTC. Step back 1 day, then construct
  // the UTC instant for the local Melbourne midnight using offset lookup.
  const yest = new Date(Date.UTC(y, m - 1, d) - 24 * 3600 * 1000);
  const yyyy = yest.getUTCFullYear();
  const mm = String(yest.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(yest.getUTCDate()).padStart(2, '0');
  const dateLabel = `${yyyy}-${mm}-${dd}`;

  // Determine UTC offset for Melbourne on that date (handles AEST/AEDT).
  const probe = new Date(Date.UTC(yyyy, yest.getUTCMonth(), yest.getUTCDate(), 12, 0, 0));
  const offsetFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' });
  const parts = offsetFmt.formatToParts(probe);
  const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+10:00';
  const match = tzPart.match(/([+-])(\d{2}):(\d{2})/);
  const offsetMin = match ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : 600;

  const startUtc = new Date(Date.UTC(yyyy, yest.getUTCMonth(), yest.getUTCDate(), 0, 0, 0) - offsetMin * 60 * 1000);
  const endUtc = new Date(startUtc.getTime() + 24 * 3600 * 1000);
  return [startUtc.toISOString(), endUtc.toISOString(), dateLabel];
}

function buildPdf(dateLabel: string, rows: ReportRow[]): Uint8Array {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('DriverMate — daily school report', 40, 60);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(`Date: ${dateLabel}`, 40, 82);

  const am = rows.filter((r) => r.period === 'AM');
  const pm = rows.filter((r) => r.period === 'PM');
  const amTotal = am.reduce((s, r) => s + r.pickups, 0);
  const pmTotal = pm.reduce((s, r) => s + r.pickups, 0);
  const dayTotal = amTotal + pmTotal;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary', 40, 120);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(`AM students:    ${amTotal}`, 60, 142);
  doc.text(`PM students:    ${pmTotal}`, 60, 160);
  doc.setFont('helvetica', 'bold');
  doc.text(`Day total:      ${dayTotal}`, 60, 180);
  doc.setFont('helvetica', 'normal');

  let y = 220;
  function section(title: string, items: ReportRow[]) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(title, 40, y);
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    if (items.length === 0) {
      doc.text('No shifts.', 60, y);
      y += 18;
      return;
    }
    doc.setFont('helvetica', 'bold');
    doc.text('Driver', 60, y);
    doc.text('Route', 240, y);
    doc.text('Pickups', pageWidth - 100, y);
    doc.setFont('helvetica', 'normal');
    y += 16;
    for (const row of items) {
      doc.text(row.driver, 60, y);
      doc.text(row.route, 240, y);
      doc.text(String(row.pickups), pageWidth - 100, y);
      y += 16;
      if (y > 780) { doc.addPage(); y = 60; }
    }
    y += 12;
  }

  section('AM shifts', am);
  section('PM shifts', pm);

  return doc.output('arraybuffer') as unknown as Uint8Array;
}

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const [startUtc, endUtc, dateLabel] = melbourneYesterday();

    const { data: shifts, error: shiftsErr } = await supabase
      .from('shifts')
      .select('id, started_at, driver:drivers(full_name, driver_number), route:routes(route_number, service_type)')
      .gte('started_at', startUtc)
      .lt('started_at', endUtc);
    if (shiftsErr) throw shiftsErr;

    const schoolShifts = (shifts ?? []).filter(
      (s: ShiftRow) => s.route?.service_type === 'school',
    ) as ShiftRow[];

    const rows: ReportRow[] = [];
    for (const shift of schoolShifts) {
      const { data: events, error: eventsErr } = await supabase
        .from('stop_events')
        .select('pickup_count')
        .eq('shift_id', shift.id);
      if (eventsErr) throw eventsErr;
      const pickups = (events ?? []).reduce((s, e) => s + (e.pickup_count ?? 0), 0);
      rows.push({
        shiftId: shift.id,
        driver: shift.driver?.full_name ?? 'unknown',
        route: shift.route?.route_number ?? 'unknown',
        period: classifyPeriod(shift.route?.route_number ?? ''),
        pickups,
      });
    }

    const pdf = buildPdf(dateLabel, rows);
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdf)));

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      return new Response(
        JSON.stringify({ ok: false, error: 'RESEND_API_KEY not set', dateLabel, rowCount: rows.length }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const resend = new Resend(resendKey);
    const to = Deno.env.get('REPORT_EMAIL_TO') ?? 'mandeep@freshoz.com';
    const from = Deno.env.get('REPORT_EMAIL_FROM') ?? 'onboarding@resend.dev';

    const am = rows.filter((r) => r.period === 'AM').reduce((s, r) => s + r.pickups, 0);
    const pm = rows.filter((r) => r.period === 'PM').reduce((s, r) => s + r.pickups, 0);

    const sent = await resend.emails.send({
      from,
      to,
      subject: `DriverMate daily report — ${dateLabel}`,
      text: `DriverMate daily report for ${dateLabel}.\n\nAM students: ${am}\nPM students: ${pm}\nDay total: ${am + pm}\n\nShifts: ${rows.length}\n\nFull breakdown attached as PDF.`,
      attachments: [{ filename: `drivermate-${dateLabel}.pdf`, content: pdfBase64 }],
    });

    if (sent.error) throw sent.error;

    return new Response(
      JSON.stringify({ ok: true, dateLabel, rowCount: rows.length, emailId: sent.data?.id }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
