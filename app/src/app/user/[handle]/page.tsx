import ProfilePage from "@/lib/components/ProfilePage";
import { createSupabaseClient, supabaseServer } from "@/lib/supabase/server";

export default async function UserProfilePage({ params } : { params: Promise<{ handle: string }> }) {
    const { handle } = await params;
    
    const { data, error } = await supabaseServer
        .from('users')
        .select('*')
        .eq('handle', handle)
        .single();

    if (!data || error) {
        return (
            <div className="w-full flex flex-col flex-1 justify-center items-center">
                <div className="p-5 text-4xl flex flex-col justify-center items-center border-solid border-4 border-[#4a3f2f]/10 rounded-lg bg-[#f5ecd9] text-[#4a3f2f]">
                <p>Not Logged In</p>

                <p>Go to&nbsp;
                    <a href="/dashboard" className="underline cursor-pointer">
                    /dashboard
                    </a>
                </p>
                </div>
            </div>
        )
    }

    return (
        <ProfilePage profileData={data} userId={data.user_id} />
    )
}