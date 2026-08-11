import { createSupabaseClient, supabaseServer } from "@/lib/supabase/server";
import { getFileExt } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const formData = await req.formData();
    const sideQuestId = parseInt(formData.get('sideQuestId') as string);
    const files = formData.getAll('files') as File[];

    const supabase = await createSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response('Unauthorized', { status: 401 })

    const completionBucket = supabaseServer.storage.from('completions');
    
    let uploadResponses = await Promise.all(files.map(file => {
        const fileName = `${crypto.randomUUID()}.${getFileExt(file.name)}`;

        return completionBucket
            .upload(
                `${user.id}/${fileName}`, 
                file
            );
    }));

    let { data, error } = await supabase
        .from('completed')
        .insert({
            user_id: user.id,
            quest_id: sideQuestId,
            image_url: uploadResponses
                .filter(response => !response.error && response.data.fullPath)
                .map(response => response.data?.fullPath)
        })
        .select()
        .single();

    if (error || !data) return;

    return NextResponse.json({ data });
}