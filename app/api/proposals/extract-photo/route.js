import { getCurrentProfile } from '@/lib/api-auth';

export const runtime = 'nodejs';

const schema = {
  type: 'object', additionalProperties: false,
  properties: {
    clientName: { type: 'string' }, clientEmail: { type: 'string' }, clientPhone: { type: 'string' },
    eventDate: { type: 'string' }, eventTime: { type: 'string' }, eventLocation: { type: 'string' },
    guestCount: { type: 'integer', minimum: 0 }, menuAndEventDetails: { type: 'string' },
    totalAmount: { type: 'number', minimum: 0 }, depositAmount: { type: 'number', minimum: 0 },
    internalNotes: { type: 'string' }, uncertainFields: { type: 'array', items: { type: 'string' } },
  },
  required: ['clientName', 'clientEmail', 'clientPhone', 'eventDate', 'eventTime', 'eventLocation', 'guestCount', 'menuAndEventDetails', 'totalAmount', 'depositAmount', 'internalNotes', 'uncertainFields'],
};

export async function POST(request) {
  const { profile } = await getCurrentProfile();
  if (!profile || !['owner', 'manager', 'super_admin'].includes(profile.role)) return Response.json({ error: 'You do not have permission to import proposals.' }, { status: 403 });
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: 'AI photo import is not configured.' }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const image = typeof body.image === 'string' ? body.image : '';
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(image)) return Response.json({ error: 'Upload a JPG, PNG, or WebP image.' }, { status: 400 });
  if (image.length > 10_000_000) return Response.json({ error: 'The photo is too large. Use an image under 7 MB.' }, { status: 413 });

  const apiResponse = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_PRICING_MODEL || 'gpt-5.4-mini', store: false,
      instructions: 'Read handwritten or printed catering event notes and extract proposal fields. Never guess missing names, dates, contacts, locations, prices, or quantities; use empty strings or zero and list uncertain or missing fields. Preserve menu items, service style, event duration, staffing, rentals, delivery, setup, cleanup, dietary needs, and special requests in menuAndEventDetails. Dates must be YYYY-MM-DD when clearly known.',
      input: [{ role: 'user', content: [{ type: 'input_text', text: 'Extract this event sheet into a catering proposal for manager review.' }, { type: 'input_image', image_url: image, detail: 'high' }] }],
      text: { format: { type: 'json_schema', name: 'proposal_photo_extraction', strict: true, schema } },
    }),
  });
  const data = await apiResponse.json().catch(() => null);
  if (!apiResponse.ok) { console.error('Proposal photo extraction failed', apiResponse.status, data?.error?.code || 'unknown'); return Response.json({ error: 'The photo could not be analyzed right now.' }, { status: 502 }); }
  const outputText = data?.output?.flatMap(item => item.content || []).find(item => item.type === 'output_text')?.text;
  if (!outputText) return Response.json({ error: 'No proposal details were found in the photo.' }, { status: 502 });
  try { return Response.json({ proposal: JSON.parse(outputText) }); }
  catch { return Response.json({ error: 'The extracted proposal details were invalid.' }, { status: 502 }); }
}
