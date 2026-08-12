import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

async function callGeminiAPI(apiUrl: string, apiKey: string, messages: any[]) {
  // This helper sends the conversation to the configured Gemini-compatible
  // endpoint. The endpoint is expected to accept a JSON body with `messages`
  // (OpenAI-like chat format). If your Gemini endpoint uses a different
  // shape, adjust this helper or set GEMINI_API_URL accordingly.
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ messages }),
  });

  const text = await res.text();
  try {
    return { ok: res.ok, json: JSON.parse(text), text };
  } catch (e) {
    return { ok: res.ok, json: null, text };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawQuery: string = (body?.query ?? '').toString().trim();
    const convo: Array<{ role: string; text: string }> = Array.isArray(body?.messages)
      ? body.messages
      : [];

    // If Gemini credentials present, ask Gemini to interpret the intent and
    // either (A) ask a follow-up question, or (B) return structured filters
    // to apply to Supabase. The client-side sends the conversation so Gemini
    // can ask follow-ups.
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    const GEMINI_URL = process.env.GEMINI_API_URL; // e.g. your Generative API endpoint

    let assistantText = '';
    let filters: any = null;

    if (GEMINI_KEY && GEMINI_URL) {
      // Build messages for the model: system prompt + conversation so far + user query
      const system = {
        role: 'system',
        content:
          'You are an assistant that helps users find activities in a database of side_quests. ' +
          'When the user query is ambiguous, ask a single concise follow-up question to clarify. ' +
          'If the query is clear, return JSON only (no prose) inside a triple-backtick code block with the following shape: ' +
          '{"filters": {"query": string, "category": string|null, "tags": [string], "max_price": number|null, "time": string|null}, "message": "A short human-friendly acknowledgement"}. ' +
          'If you ask a follow-up question instead, return a plain assistant message (no JSON) asking the question.'
      };

      // Convert client convo into model-friendly messages
      const modelMessages = [system];
      for (const m of convo) {
        modelMessages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text ?? m.content ?? '' });
      }
      if (rawQuery) modelMessages.push({ role: 'user', content: rawQuery });

      const geminiResp = await callGeminiAPI(GEMINI_URL, GEMINI_KEY, modelMessages as any);

      if (!geminiResp.ok) {
        // fallback: continue with local search
        assistantText = `Gemini API error: ${geminiResp.text}`;
      } else {
        // geminiResp.text may contain JSON inside triple-backticks or plain text
        const text = geminiResp.text;
        assistantText = text;
        // Try to extract a JSON block from the response
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1]);
            filters = parsed.filters ?? null;
            // Prefer human-friendly message if present
            if (parsed.message) assistantText = parsed.message;
          } catch (e) {
            // ignore parse errors and leave assistantText as-is
          }
        } else {
          // try parsing entire text as JSON
          try {
            const parsed = JSON.parse(text);
            filters = parsed.filters ?? null;
            if (parsed.message) assistantText = parsed.message;
          } catch (e) {
            // not JSON — assume it's a follow-up question or plain reply
          }
        }
      }
    }

    // If filters were provided by Gemini, run a filtered supabase query.
    // Otherwise, fall back to the fuzzy search used previously.
    const selectCols = 'id,created_at,title,price,location,tags,hype,description,status,category,time,image,author_id,position,geojson';

    let spots: any[] = [];

    if (filters) {
      // Build query from filters (support query text, category, tags, max_price)
      let queryBuilder = supabase.from('side_quests').select(selectCols).limit(24);

      if (filters.query) {
        const cleaned = filters.query.toString().replace(/[%*]/g, '').replace(/'/g, '').trim();
        const starPattern = `*${cleaned.split(/\s+/).join('*')}*`;
        const orExpr = `title.ilike.${starPattern},description.ilike.${starPattern},category.ilike.${starPattern}`;
        const { data, error } = await queryBuilder.or(orExpr).limit(12);
        if (!error && Array.isArray(data)) spots = spots.concat(data);
      }

      if (filters.category) {
        const { data, error } = await supabase
          .from('side_quests')
          .select(selectCols)
          .eq('category', filters.category)
          .limit(12);
        if (!error && Array.isArray(data)) spots = spots.concat(data);
      }

      if (Array.isArray(filters.tags) && filters.tags.length > 0) {
        for (const t of filters.tags) {
          const { data, error } = await supabase
            .from('side_quests')
            .select(selectCols)
            .contains('tags', [t])
            .limit(12);
          if (!error && Array.isArray(data)) spots = spots.concat(data);
        }
      }

      if (filters.max_price != null) {
        const { data, error } = await supabase
          .from('side_quests')
          .select(selectCols)
          .lte('price', filters.max_price)
          .limit(24);
        if (!error && Array.isArray(data)) spots = spots.concat(data);
      }

      // Deduplicate by id
      const byId = new Map();
      for (const s of spots) byId.set(s.id, s);
      spots = Array.from(byId.values()).slice(0, 12);
    } else {
      // No filters: run the previous fuzzy search (primary + tags)
      const cleaned = rawQuery.replace(/[%*]/g, '').replace(/'/g, '').trim();
      const starPattern = `*${cleaned.split(/\s+/).join('*')}*`;
      const orExpr = `title.ilike.${starPattern},description.ilike.${starPattern},category.ilike.${starPattern}`;

      const { data: primaryData, error: primaryError } = await supabase
        .from('side_quests')
        .select(selectCols)
        .or(orExpr)
        .limit(12);

      if (!primaryError && Array.isArray(primaryData)) spots = spots.concat(primaryData);

      const tokens = cleaned.split(/\s+/).filter(Boolean);
      if (tokens.length > 0) {
        for (const t of tokens) {
          try {
            const { data: td, error: tdErr } = await supabase
              .from('side_quests')
              .select(selectCols)
              .contains('tags', [t])
              .limit(12);
            if (!tdErr && Array.isArray(td)) spots = spots.concat(td);
          } catch (e) {
            // ignore
          }
        }
      }

      // dedupe
      const byId = new Map();
      for (const s of spots) if (s?.id) byId.set(s.id, s);
      spots = Array.from(byId.values()).slice(0, 12);

      // If Gemini was configured but returned a plain question (no filters), set assistantText accordingly
      if (!process.env.GEMINI_API_KEY) {
        // nothing
      }
    }

    // Return assistantText (may be a follow-up question) and spots
    const messagesOut = [];
    if (assistantText) messagesOut.push(assistantText);

    return NextResponse.json({ messages: messagesOut, spots }, { status: 200 });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
