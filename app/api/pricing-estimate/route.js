import { getCurrentProfile } from '@/lib/api-auth';

export const runtime = 'nodejs';

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    serviceStyle: { type: 'string', enum: ['dropoff', 'buffet', 'family', 'plated', 'cocktail'] },
    menuLevel: { type: 'string', enum: ['simple', 'standard', 'premium'] },
    eventHours: { type: 'number', minimum: 2, maximum: 16 },
    travelEstimate: { type: 'number', minimum: 0, maximum: 5000 },
    otherFixedCosts: { type: 'number', minimum: 0, maximum: 25000 },
    taxPercent: { type: 'number', minimum: 0, maximum: 20 },
    depositPercent: { type: 'number', minimum: 0, maximum: 100 },
    analysis: { type: 'string', maxLength: 700 },
    missingInformation: { type: 'array', items: { type: 'string', maxLength: 160 }, maxItems: 6 },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
  required: ['serviceStyle', 'menuLevel', 'eventHours', 'travelEstimate', 'otherFixedCosts', 'taxPercent', 'depositPercent', 'analysis', 'missingInformation', 'confidence'],
};

function clean(value, max = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function POST(request) {
  const { profile } = await getCurrentProfile();
  if (!profile || !['owner', 'manager', 'super_admin'].includes(profile.role)) {
    return Response.json({ error: 'You do not have permission to use AI pricing.' }, { status: 403 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: 'AI pricing is not configured.' }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const guestCount = Math.max(0, Math.min(10000, Number(body.guestCount) || 0));
  const eventDescription = clean(body.eventDescription, 5000);
  const eventLocation = clean(body.eventLocation, 500);
  const eventDate = clean(body.eventDate, 30);
  if (!guestCount && !eventDescription) {
    return Response.json({ error: 'Add a guest count or event description first.' }, { status: 400 });
  }

  const apiResponse = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_PRICING_MODEL || 'gpt-5.4-mini',
      store: false,
      instructions: 'You are a catering operations analyst. Extract realistic service assumptions from the supplied event information. Do not invent menu prices or a final quote. Travel and other fixed costs should be conservative planning allowances based only on explicit details; use zero when unsupported. Identify missing details that materially affect price. Return only the requested structured result.',
      input: `Guest count: ${guestCount || 'not provided'}\nEvent date: ${eventDate || 'not provided'}\nLocation: ${eventLocation || 'not provided'}\nMenu and event notes:\n${eventDescription || 'not provided'}`,
      text: { format: { type: 'json_schema', name: 'catering_event_analysis', strict: true, schema } },
    }),
  });

  const data = await apiResponse.json().catch(() => null);
  if (!apiResponse.ok) {
    console.error('OpenAI pricing analysis failed', apiResponse.status, data?.error?.code || 'unknown');
    return Response.json({ error: 'AI analysis is temporarily unavailable.' }, { status: 502 });
  }
  const outputText = data?.output?.flatMap(item => item.content || []).find(item => item.type === 'output_text')?.text;
  if (!outputText) return Response.json({ error: 'AI analysis returned no usable result.' }, { status: 502 });

  try {
    return Response.json({ analysis: JSON.parse(outputText) });
  } catch {
    return Response.json({ error: 'AI analysis returned an invalid result.' }, { status: 502 });
  }
}
