"use client"

import LoginWithGoogle from "@/lib/components/google/GoogleLogin";
import SectionEyebrow from "@/lib/components/SectionEyebrow";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { SubmitEvent, useState } from "react";

export default function RegistrationPage() {
    const [warning, setWarning] = useState<string | null>();
    const [success, setSuccess] = useState<string | null>();

    const router = useRouter();

    const handleSignUp = async (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();

        const formData = new FormData(event.currentTarget);
        const formValues = Object.fromEntries(formData);

        if (formValues.password != formValues.confirmPassword) {
            setWarning("Password's don't match");
            return;
        }
        
        const { data, error } = await supabase.auth.signUp({
            email: formValues.email as string,
            password: formValues.password as string
        });

        if (error) {
            setWarning(error.message);
        }

        if (data.user) {
            setSuccess("Successfully signed in!");
            router.push('/dashboard');
        }
    }

    return (
        <div className="mt-32 mx-[30%]">
            <div className="p-[10%] rounded-sm flex flex-col bg-[#f5ecd9] shadow-lg transition hover:-translate-y-1 hover:shadow-xl">
                <h1 className="text-6xl">Sign Up</h1>
                <div className="flex flex-col gap-5">
                    <form 
                        className="flex flex-col gap-10 items-stretch"
                        onSubmit={handleSignUp}
                    >
                        <div>
                            <h2>Email</h2>
                            <input 
                                name="email" 
                                type="email" 
                                required 
                                className="w-full resize-none rounded-lg border border-[#4a3f2f]/15 bg-white/40 px-3 py-2 text-sm text-[#4a3f2f] placeholder:text-[#4a3f2f]/40 focus:outline-none focus:ring-2 focus:ring-[#a1602a]/40" 
                            />
                        </div>
                        <div>
                            <h2>Password</h2>
                            <input 
                                name="confirmPassword" 
                                type="password" 
                                className="w-full resize-none rounded-lg border border-[#4a3f2f]/15 bg-white/40 px-3 py-2 text-sm text-[#4a3f2f] placeholder:text-[#4a3f2f]/40 focus:outline-none focus:ring-2 focus:ring-[#a1602a]/40" 
                                required 
                            />
                        </div>
                        <div>
                            <h2>Confirm Password</h2>
                            <input 
                                name="password" 
                                type="password" 
                                className="w-full resize-none rounded-lg border border-[#4a3f2f]/15 bg-white/40 px-3 py-2 text-sm text-[#4a3f2f] placeholder:text-[#4a3f2f]/40 focus:outline-none focus:ring-2 focus:ring-[#a1602a]/40" 
                                required 
                            />
                        </div>
                        <button className="border-2 border-blue rounded-sm px-3 py-1 self-start cursor-pointer bg-[#f5ecd9] shadow-lg transition hover:brightness-95">
                            Sign Up
                        </button>
                        {warning && (
                            <div className="bg-red-800 text-3xl border-2 border-red-300 text-white rounded-2xl p-5">
                                <p>{warning}</p>
                            </div>
                        )}
                        {success && (
                            <div className="bg-green-800 text-3xl border-2 border-green-300 text-white rounded-2xl p-5">
                                <p>{success}</p>
                            </div>
                        )}
                    </form>
                    <SectionEyebrow icon="">
                        Google
                    </SectionEyebrow>
                    <LoginWithGoogle />
                    <a href="/login" className="underline">
                        Already have an account?
                    </a>
                </div>
            </div>
        </div>
    )
}