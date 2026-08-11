import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

export function getFileExt(fileName: string): string {
    return fileName.substring(fileName.lastIndexOf('.') + 1);
}

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    const formData = await req.formData()
    const sideQuestId = parseInt(formData.get('sideQuestId') as string);
    const files = formData.getAll('files') as File[];

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response('Unauthorized', { status: 401 })

    const completionBucket = supabase.storage.from('completions');
    
    let uploadResponses = await Promise.all(files.map(file => {
        const fileName = `${crypto.randomUUID()}.${getFileExt(file.name)}`;

        return completionBucket
            .upload(
                `${userId}/${fileName}`, 
                file
            );
    }));

    let { data, error } = await supabase
        .from('completed')
        .insert({
            user_id: userId,
            quest_id: sideQuestId,
            image_url: uploadResponses
                .filter(response => !response.error && response.data.fullPath)
                .map(response => response.data?.fullPath)
        })
        .select()
        .single();

    if (error || !data) return;

    return new Response(JSON.stringify({ data }), {
      headers: { 
        'Access-Control-Allow-Origin': '*', // Replace with your production domain for security
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
        'Content-Type': 'application/json',
      },
    })
  }),
};