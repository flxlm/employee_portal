import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Webhook-Secret',
};

const EVENT_INQUIRY_FORM_ID = '252015118626046';

function pad2(n: number | string): string {
  const s = String(n);
  return s.length < 2 ? '0' + s : s;
}

function dateObjToRaw(o: { month?: string; day?: string; year?: string }): string {
  if (!o?.month || !o?.day || !o?.year) return '';
  return `${pad2(o.month)}-${pad2(o.day)}-${o.year}`;
}

function dateObjToISO(o: { month?: string; day?: string; year?: string }): string | null {
  if (!o?.month || !o?.day || !o?.year) return null;
  const d = new Date(Date.UTC(+o.year, +o.month - 1, +o.day));
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function timeObjToStr(o: any): string {
  if (!o) return '';
  if (typeof o === 'string') return o;
  if (o.hourSelect && o.minuteSelect) {
    return `${o.hourSelect}:${o.minuteSelect}${o.ampm ? ' ' + o.ampm : ''}`;
  }
  return '';
}

function strOrJoin(v: any): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.join('\n');
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

function formatBudget(o: any): string {
  if (!o || typeof o !== 'object') return strOrJoin(o);
  const num = o['number-3'] ?? '';
  const tax = o['selectbox-4'] ?? '';
  if (!num) return '';
  return `$${num}${tax ? ' -    ' + tax + '.' : ''}`;
}

async function insertEventInquiry(form: FormData) {
  const submissionId = (form.get('submissionID') || form.get('submission_id') || '').toString().trim();
  let raw: Record<string, any> = {};
  try {
    raw = JSON.parse(form.get('rawRequest')?.toString() || '{}');
  } catch {
    /* ignore */
  }

  const eventDateRaw = dateObjToRaw(raw.q4_dateOf);
  const eventDateIso = dateObjToISO(raw.q4_dateOf);

  const row = {
    submission_id: submissionId || `jotform:${Date.now()}`,
    submission_date: new Date().toISOString().replace('T', ' ').slice(0, 19),
    email: strOrJoin(raw.q3_email),
    event_date_raw: eventDateRaw,
    new_date_raw: '',
    event_date: eventDateIso,
    guests: strOrJoin(raw.q5_numberOf),
    reservation_type: strOrJoin(raw.q21_whatType),
    start_time: timeObjToStr(raw.q6_atWhat),
    arrival_time: timeObjToStr(raw.q7_time7),
    end_time: timeObjToStr(raw.q16_time16),
    bar_service: strOrJoin(raw.q12_typeA12),
    food_service: strOrJoin(raw.q14_typeA),
    food_service_time: timeObjToStr(raw.q8_time8),
    food_restrictions: strOrJoin(raw.q17_ifYou),
    dj: strOrJoin(raw.q15_pleaseSelect),
    description: strOrJoin(raw.q18_isThere),
    budget: formatBudget(raw.q25_input25),
    premium_drinks: strOrJoin(raw.q26_typeA26),
    premium_drinks_details: strOrJoin(raw.q27_typeA27),
    wedding_sections: strOrJoin(raw.q29_whichWedding),
    referral_source: strOrJoin(raw.q30_howDid),
    prepaid: '',
    status: 'NEW',
  };

  const { error } = await supabaseAdmin
    .from('event_inquiries')
    .upsert(row, { onConflict: 'submission_id', ignoreDuplicates: false });

  if (error) {
    console.error('[webhook] event_inquiries upsert failed', error);
    return { ok: false, error: error.message, submission_id: row.submission_id };
  }
  return { ok: true, submission_id: row.submission_id };
}

export const Route = createFileRoute('/api/public/webhook')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      POST: async ({ request }) => {
        // Optional shared-secret check. Set WEBHOOK_SECRET to enable.
        const secret = process.env.WEBHOOK_SECRET;
        if (secret) {
          const provided =
            request.headers.get('x-webhook-secret') ??
            new URL(request.url).searchParams.get('token');
          if (provided !== secret) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }
        }

        const contentType = request.headers.get('content-type') ?? '';

        // Always read the full raw body first so nothing is lost, then parse.
        const rawBody = await request.text();
        let form: FormData | null = null;
        let payload: unknown = rawBody;

        try {
          if (contentType.includes('application/json')) {
            payload = JSON.parse(rawBody);
          } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
            // Re-parse the raw body as form data using a synthetic Request so we keep the full payload.
            const res = new Request('http://localhost/_parse', {
              method: 'POST',
              headers: { 'content-type': contentType },
              body: rawBody,
            });
            form = await res.formData();
            payload = Object.fromEntries(form.entries());
          }
        } catch (e) {
          console.error('[webhook] body parse failed', e);
        }

        const formId =
          (form?.get('formID')?.toString() ??
            (typeof payload === 'object' && payload && (payload as any).formID)) || '';

        console.log('[webhook] received', { contentType, formId, bodyLength: rawBody.length, payload });

        if (form && formId === EVENT_INQUIRY_FORM_ID) {
          const result = await insertEventInquiry(form);
          return new Response(JSON.stringify(result), {
            status: result.ok ? 200 : 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        return new Response(JSON.stringify({ ok: true, ignored: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      },
    },
  },
});
