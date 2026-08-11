"use client"

import LoginWithGoogle from "@/lib/components/google/GoogleLogin";
import SectionEyebrow from "@/lib/components/SectionEyebrow";
import { supabase } from "@/lib/supabase/client";

export default function RegistrationPage() {
    return (
        <div className="mt-32 mx-[30%]">
            <div className="p-[10%] rounded-sm flex flex-col bg-[#f5ecd9] shadow-lg transition hover:-translate-y-1 hover:shadow-xl">
                <h1 className="text-6xl">Sign Up</h1>
                <div className="flex flex-col gap-5">
                    <form 
                        className="flex flex-col gap-10 items-stretch"
                        onSubmit={async (event) => {
                            event.preventDefault();

                            const formData = new FormData(event.currentTarget);
                            const formValues = Object.fromEntries(formData);
                            
                            await supabase.auth.signUp({
                                email: formValues.email as string,
                                password: formValues.password as string
                            });
                        }}
                    >
                        <div>
                            <h2>Email</h2>
                            <input name="email" type="email" className="border-black border-2 px-5 py-2 rounded-full w-full focus:bg-[#f5ecd9] required:invalid:border-red" required />
                        </div>
                        <div>
                            <h2>Password</h2>
                            <input name="password" type="password" className="border-black border-2 px-5 py-2 rounded-full w-full focus:bg-[#f5ecd9] required:invalid:border-red" required />
                            <a href="/forgot-password" className="underline">Forgot Password?</a>
                        </div>
                        <button className="border-2 border-blue rounded-sm px-3 py-1 self-start cursor-pointer bg-[#f5ecd9] shadow-lg transition hover:brightness-95">
                            Login
                        </button>
                    </form>
                    <SectionEyebrow icon="">
                        Google
                    </SectionEyebrow>
                    <LoginWithGoogle />
                </div>
            </div>
        </div>
    )
}