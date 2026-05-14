import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Webhook-Secret',
};

export const Route = createFileRoute('/api/public/webhook')({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: corsHeaders }),

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
        let payload: unknown;
        try {
          if (contentType.includes('application/json')) {
            payload = await request.json();
          } else if (contentType.includes('form')) {
            const fd = await request.formData();
            payload = Object.fromEntries(fd.entries());
          } else {
            payload = await request.text();
          }
        } catch {
          payload = null;
        }

        console.log('[webhook] received', {
          contentType,
          payload,
        });

        // Example: persist to a table if you create one.
        // await supabaseAdmin.from('webhook_events').insert({ payload });
        void supabaseAdmin;

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      },
    },
  },
});
