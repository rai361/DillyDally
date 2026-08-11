import { getUserProfile } from "@/lib/functions";
import { isAdmin } from "@/lib/auth";
import { PriceIndicator, TimeIndicator } from "@/lib/components/Indicators";
import { createSupabaseClient, supabaseServer } from "@/lib/supabase/server"

function spotCard(spot: any) {
    return (
        <div className="block w-56 cursor-pointer overflow-hidden rounded-lg bg-[#f5ecd9] text-left text-[#4a3f2f] transition hover:brightness-95">
            <img src={spot.image} alt={spot.title} className="h-28 w-full object-cover" />
            <div className="space-y-1.5 p-2.5">
                {/* <CategoryBadge category={spot.category} /> */}
                <h3 className="text-base font-bold leading-tight text-[#4a3f2f]">{spot.title}</h3>
                <div className="flex items-center justify-between text-sm">
                <PriceIndicator price={spot.price} />
                </div>
                <TimeIndicator time={spot.time} />
                <div className={`pt-0.5 text-xs readable-font font-medium text-[#a1602a]`}>
                Tap to see more →
                </div>
            </div>
        </div>
    )
}

export default async function AdminDashboard() {
    const supabase = await createSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    console.log(user);

    if (!user || !isAdmin(user)) {
        return (
            <div className="w-full flex flex-1 flex-col items-center justify-center">
                <div className="border-r-20 border-2 border-black">
                    No access u cheeky li'l hecker
                </div>
            </div>
        )
    }

    const { data: { users } } = await supabaseServer.auth.admin.listUsers();

    const { data } = await supabaseServer
        .from('users')
        .select('*');

    const records = users.map(user => ({
        user,
        profile: data!.find((row) => row.user_id == user.id)
    }));

    console.log(records);

    const { data: submissions } = await supabase
        .from("side_quests")
        .select("*")
        .eq("status", "pending");

    return (
        <div className="mt-32 mx-56">
            <div>
                <h1 className="text-9xl">Admin Dashboard</h1>
            </div>
            <div className="flex flex-col gap-10 justify-center">
                <div>
                    <h2 className="text-[#4a3f2f]/50 text-4xl">Users</h2>
                    <div className="py-5 px-10 rounded-sm flex flex-col bg-[#f5ecd9] shadow-lg transition hover:-translate-y-1 hover:shadow-xl">
                        {records.map(record => (
                            <div className="flex flex-row items-center gap-10" key={record.user.id}>
                                <p className="text-2xl">{record.profile.display_name}</p>
                                <img src={record.profile.avatar_url} className="h-16 w-16 rounded-full border-4 border-[#f5ecd9] object-cover shadow-lg" />
                            </div>
                        ))}
                    </div>
                </div>
                {submissions && (
                    <div>
                        <h2 className="text-[#4a3f2f]/50 text-4xl">Submissions</h2>
                        <div className="flex flex-row flex-wrap gap-5">
                            {submissions.map(spotCard)}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}