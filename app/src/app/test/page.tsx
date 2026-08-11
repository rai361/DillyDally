"use client";

import { uploadCompletionImages } from "@/lib";

export default function TestPage() {
    return (
        <div className="flex flex-col flex-1 justify-center items-center">
            <input
                type="file"
                multiple
                onChange={(event) => {
                    uploadCompletionImages('38', Array.from(event.target.files!));
                }}
            />
        </div>
    )
}