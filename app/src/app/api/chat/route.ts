import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, ToolUnion, Type } from '@google/genai/node';
import { createSupabaseClient, supabaseServer } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ALL_CATEGORIES } from '@/lib/constants';

const sideQuestDeclaration: ToolUnion = {
  functionDeclarations: [
    {
      name: 'getSideQuest',
      description: 'get a side quest when prompted with parameters',
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: {
            type: Type.STRING,
            description: 'The search terms or keywords extracted from the user request.',
          },
          category: {
            type: Type.STRING,
            description: "Category of side quests",
            enum: ALL_CATEGORIES
          },
        },
        required: ['query'],
      },
    },
  ],
};

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    redirect('/dashboard');
    return;
  }

  try {

    const { message, history } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const chat = ai.chats.create({
      model: 'gemini-3.6-flash',
      history: history || [],
      config: {
        tools: [sideQuestDeclaration],
        systemInstruction: `
You are an assistant that helps users find side quests.
When the user query is ambiguous, ask a single concise follow-up question to clarify.
You are conversing with a user by the name of ${profile.display_name}
`
      },
    });

    let response = await chat.sendMessage({ message });

    if (response.functionCalls && response.functionCalls.length > 0) {
      const call = response.functionCalls[0];

      if (call.name === 'getSideQuest') {
        const args = call.args as { query: string, category: string };

        const { data: dbResult, error } = await supabase
          .from('side_quests')
          .select('*')
          .or(`title.ilike.%${args.query}%,description.ilike.%${args.query}%,category.ilike.%${args.category}%`)
          .eq('status', 'approved');

        if (error) throw error;

        response = await chat.sendMessage({
          message: [{
            functionResponse: {
              name: 'getSideQuest',
              response: { foundRows: dbResult },
            },
          }],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                text: {
                  type: Type.STRING,
                  description: 'The natural language reply explaining why these specific options were chosen.'
                },
                questIds: {
                  type: Type.ARRAY,
                  items: { type: Type.NUMBER },
                  description: 'A list of the selected side quest ids from the side quest query'
                }
              },
              required: ['text', 'questIds']
            },
          },
        });

        const structuredResponse = JSON.parse(response.text!);
        
        return NextResponse.json({ 
          text: structuredResponse.text, 
          quests: dbResult.filter(result => structuredResponse.questIds.includes(result.id) )
        });
      }
    }

    return NextResponse.json({ text: response.text, questIds: [] });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}