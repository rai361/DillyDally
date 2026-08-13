// "use client";

// import { ChangeEvent, useState } from "react";
// import { toDataURL } from "../utils";
// import Link from "next/link";
// import { UserProfile } from "../types";


// function AvatarUpload({ image, setImage } : { image: string, setImage: (image: string) => any }) {
//   const handleFiles = async (files: FileList | null) => {
//     if (!files) return;

//     setImage(await toDataURL(files[0]));
//   }
  
//   return (
//     <div className="flex flex-row justify-between gap-1.5 w-[50vw] h-[40vh] p-5 rounded-lg bg-[#f5ecd9]">
//       <div className="flex flex-col">
//         <label className="block text-lg readable-font font-semibold uppercase tracking-wide text-[#4a3f2f]/50">
//           Choose an image
//         </label>
//         <div className="relative flex-1 aspect-square rounded-lg border border-dashed border-[#4a3f2f]/25 text-[#4a3f2f]/50 hover:border-[#a1602a] hover:text-[#a1602a]">
//           <input 
//             type="file"
//             accept="image/*"
//             className="text-transparent w-full h-full"
//             onChange={(event) => handleFiles(event.currentTarget.files)}
//           />
//           <div className="pointer-events-none inset-0 absolute flex flex-col items-center justify-center gap-0.5">
//             <span className="text-base leading-none">+</span>
//             <span className="text-[10px] font-semibold">Add</span>
//           </div>
//         </div>
//       </div>
//       <div className="h-full">
//         {image && (
//           <img src={image} className="h-full rounded-full object-cover aspect-square border-4 border-[#f5ecd9]" />
//         )}
//       </div>
//     </div>
//   )
// }

// function Editing({ 
//   handle,
//   displayName, 
//   bio, 
//   setProfile,
//   setAvatar,
//   onClose,
//   avatarUrl
// } : { 
//   handle: string,
//   displayName: string, 
//   avatarUrl: string,
//   bio: string,
//   setProfile: (value: any) => any,
//   setAvatar: (url: string) => any,
//   onClose: () => any
// }) {
//   const [fields, setFields] = useState<{ name: string, biography: string, image: string, handle: string }>({
//     name: displayName,
//     biography: bio,
//     image: avatarUrl,
//     handle
//   });

//   const modifyField = function<K extends keyof typeof fields>(field: K, value: typeof fields[K]) {
//     setFields(prev => ({
//       ...prev,
//       [field]: value
//     }));
//   }

//   const handleFieldUpdate = (field: keyof typeof fields) => {
//     return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
//       setFields(prev => ({
//         ...prev,
//         [field]: event.target.value
//       }));
//     }
//   }

//   return (
//     <>
//       <button 
//         // @ts-ignore
//         commandfor="image-upload"
//         command="show-modal"
//         className="hover:brightness-60 cursor-pointer"
//       >
//         <img
//           src={fields.image}
//           className="h-24 w-24 rounded-full border-4 border-[#f5ecd9] object-cover shadow-lg"
//         />
//       </button>

//       <dialog id="image-upload" closedby="any" className="absolute left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] bg-transparent">
//         <AvatarUpload image={fields.image} setImage={(image) => modifyField("image", image)} />
//       </dialog>

//       <div className="mt-6">
//         <label>
//           Display Name
//         </label>
//         <input 
//           type="text" 
//           defaultValue={displayName}
//           onChange={handleFieldUpdate('name')}
//           className="w-full resize-none rounded-lg border border-[#4a3f2f]/15 bg-white/40 px-3 py-2 text-sm text-[#4a3f2f] placeholder:text-[#4a3f2f]/40 focus:outline-none focus:ring-2 focus:ring-[#a1602a]/40"
//         />
//       </div>
//       <div className="mt-6">
//         <label>
//           Handle
//         </label>
//         <input 
//           type="text" 
//           defaultValue={handle}
//           onChange={handleFieldUpdate('handle')}
//           className="w-full resize-none rounded-lg border border-[#4a3f2f]/15 bg-white/40 px-3 py-2 text-sm text-[#4a3f2f] placeholder:text-[#4a3f2f]/40 focus:outline-none focus:ring-2 focus:ring-[#a1602a]/40"
//         />
//       </div>
//       <div className="mt-6">
//         <label>
//           Bio
//         </label>
//         <textarea 
//           rows={3}
//           defaultValue={bio}
//           onChange={handleFieldUpdate('biography')}
//           className="w-full resize-none rounded-lg border border-[#4a3f2f]/15 bg-white/40 px-3 py-2 text-sm text-[#4a3f2f] placeholder:text-[#4a3f2f]/40 focus:outline-none focus:ring-2 focus:ring-[#a1602a]/40"
//         />
//       </div>

//       <button
//         onClick={() => {
//           setProfile({
//             display_name: fields.name,
//             bio: fields.biography,
//             handle: fields.handle
//           });

//           setAvatar(fields.image);

//           onClose();
//         }}
//         className="cursor-pointer rounded-full bg-[#a1602a] px-5 py-2 text-sm font-bold text-[#f5ecd9] transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[#4a3f2f]/15 disabled:text-[#4a3f2f]/40"
//       >
//         Save
//       </button>
//     </>
//   )
// }

// export default function ProfilePage({ profile } : { profile: UserProfile }) {
//     const [isEditing, setEditing] = useState(false);
    
//     return (
//     <main className="min-h-screen w-screen bg-[#f0e6d2] text-[#4a3f2f]">
//         <Link
//         href="/"
//         className="fixed left-4 top-4 z-10 flex items-center gap-1.5 rounded-full bg-[#f5ecd9] px-3 py-2 text-xs font-semibold text-[#4a3f2f] shadow-lg hover:brightness-95"
//         >
//         ← Back to map
//         </Link>
        
//         <div className="relative mx-auto flex max-w-xl flex-col items-center px-6 pb-16 pt-20">
//         <button
//             onClick={() => setEditing(prev => !prev)}
//             className="cursor-pointer absolute right-6 top-20 z-10 flex items-center gap-1.5 rounded-full bg-[#f5ecd9] px-3 py-2 text-md font-semibold text-[#4a3f2f] shadow-lg hover:brightness-95"
//         >
//             {isEditing ? "Stop Editing" : "Edit"} Profile
//         </button>
        

//         {isEditing ? (
//             <Editing 
//             avatarUrl={profile.avatarUrl}
//             displayName={profile.displayName}
//             bio={profile.bio}
//             setProfile={setProfile}
//             handle={profile.handle}
//             // @ts-ignore
//             setAvatar={setAvatar}
//             onClose={() => {
//                 setEditing(false);  
//             }}
//             />
//             ) : (
//             <>
//                 <img
//                 src={profile.avatarUrl}
//                 className="h-24 w-24 rounded-full border-4 border-[#f5ecd9] object-cover shadow-lg"
//                 />
//                 <h1 className="mt-4 text-2xl font-extrabold leading-tight text-[#4a3f2f]">
//                 {profile.displayName}
//                 </h1>
//                 <h1 className="mt-4 text-xl font-extrabold leading-tight text-[#4a3f2f]">
//                 @{profile.handle}
//                 </h1>
//                 <h1 className="mt-3 max-w-sm text-center text-sm leading-relaxed text-[#6b5d45]">
//                 {profile.bio}
//                 </h1>
//             </>
//         )}

//         {/* <FollowButton /> */}

//         <div className="mt-5 flex items-center divide-x divide-[#4a3f2f]/10 rounded-full bg-[#f5ecd9] py-3 shadow-md">
//             <StatBlock value={points} label="Points" accent />
//             <StatBlock value={profile.followers} label="Ducklings" />
//             <StatBlock value={profile.following} label="Admiring" />
//         </div>

//         {/* Pinned quest photos */}
//         {!isPhotosPending && (
//             <div className="mt-12 w-full gap-3">
//             <SectionEyebrow icon="📌">Pinned from quests</SectionEyebrow>
//             <PhotoCarousel photos={pinnedPhotos as GalleryImage[]} />
//             </div>
//         )}

//         {/* Favorite sidequests */}
//         <div className="mt-10 w-full">
//             <SectionEyebrow icon="⭐">Favorite sidequests</SectionEyebrow>
//             <div className="space-y-2.5 mt-3">
//             {/* @ts-ignore */}
//             {!isPending && (bookmarkedQuests?.map((bookmark: any) => (
//                 <FavoriteQuestCard key={bookmark.id} quest={bookmark.side_quests} />
//             )))}
//             </div>
//         </div>
//         </div>
//     </main>
//     );
// }