import { createSupabaseClient, supabaseServer } from "@/lib/supabase/server";

export default async function UserProfilePage({ params } : { params: Promise<{ handle: string }> }) {
    const { handle } = await params;
    
    const { data, error } = await supabaseServer
        .from('users')
        .select('*')
        .eq('handle', handle);

    return (
        <div>
            
        </div>
    )
}