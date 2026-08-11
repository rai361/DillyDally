import { type SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./supabase/client";
import { getFileExt } from "./utils";

export interface ImageUpload {
    file: File;
    caption?: string;
}

export async function getUserProfile() {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .single();

    if (error) throw error;

    return data;
}

export async function uploadImagesForQuest(userId: string, sideQuestId: string, images: ImageUpload[]) {
    await Promise.all(images.map(async (image) => {
        const fileName = `${crypto.randomUUID()}.${getFileExt(image.file.name)}`;
        
        const { data, error } = await supabase
            .storage
            .from('avatar')
            .upload(`${userId}/${fileName}`, image.file);
    
        if (error) throw error;
    
        await supabase 
            .from('gallery')
            .insert({
                user_id: userId,
                quest_id: sideQuestId,
                caption: image.caption
            });
    }));
}

export async function getClosestQuests({ latitude, longitude } : { latitude: number, longitude: number }, limit: number = 5) {
    const { data, error } = await supabase.rpc("get_n_closest", { 
        p_lat: latitude,
        p_lon: longitude,
        p_limit: limit 
    });

    if (error) throw error;

    return data;
}

export async function getFollowerStats(userId: string): Promise<{ followers: number, following: number }> {
    const { data, error } = await supabase.rpc("get_follower_stats", { p_user_id: userId });

    if (error) throw error;

    return data;
}

export async function getBookmarkedQuests() {
    const { data, error } = await supabase
        .from('bookmarks')
        .select('*, side_quests(*)');

    if (error) throw error;
    
    return data ?? [];
}

export async function getSideQuests() {
    const { data, error } = await supabase
        .from('side_quests')
        .select('*');

    if (error) throw error;

    return data ?? [];
}

export async function getPinnedImages() {
    const { data, error } = await supabase
        .from('gallery')
        .select('*')
        .eq('pinned', true);
    
    if (error) throw error;
    
    return data ?? [];
}

export async function pinImage(imageId: string) {
    const { data, error } = await supabase
        .from('gallery')
        .update({ pinned: true })
        .eq('id', imageId);
    
    if (error) throw error;
}

export async function unpinImage(imageId: string) {
    const { data, error } = await supabase
        .from('gallery')
        .update({ pinned: false })
        .eq('id', imageId);
    
    if (error) throw error;
}

export async function submitQuestForApproval({
    title,
    description,
    price,
    latitude,
    longitude,
    time,
    category,
    tags,
    image
} : {
    title: string,
    description: string,
    price: number,
    latitude: number,
    longitude: number,
    time: string,
    category: string,
    tags: string[],
    image: string
}) {
    const { data, error } = await supabase.rpc("submit_quest_for_approval", {
        p_title: title,
        p_description: description,
        p_price: price,
        p_lat: latitude,
        p_long: longitude,
        p_time: time,
        p_category: category,
        p_tags: tags,
        p_image: image
    });

    if (error) throw error;

    return data;
}

export async function updateUserAvatar(userId: string, file: File) {
    const fileName = `${crypto.randomUUID()}.${getFileExt(file.name)}`;
    
    const { data, error } = await supabase
        .storage
        .from('avatar')
        .upload(`${userId}/${fileName}`, file);

    if (error) throw error;

    const { data: userData, error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: data.fullPath })
        .eq('user_id', userId);

    if (updateError) throw updateError;

    return userData;
}

export async function seedInitialQuests() {
    const initialSpots = [
        {
            id: 'robarts',
            position: [43.6644, -79.3999],
            title: 'Robarts 13th Floor Study Nook',
            description:
            'Quiet corner with skyline views. Great for cramming before finals, terrible for making friends.',
            image: 'https://picsum.photos/seed/robarts/500/350',
            price: 1,
            hype: 3,
            time: '~2 hrs',
            category: 'User Submitted',
            tags: ['quiet', 'study', 'indoor', 'solo-friendly'],
        },
        {
            id: 'harthouse',
            position: [43.664, -79.3957],
            title: 'Hart House Great Hall',
            description:
            'Gothic architecture, free events most weeks, and surprisingly good acoustics for club meetings.',
            image: 'https://picsum.photos/seed/harthouse/500/350',
            price: 1,
            hype: 4,
            time: '~30 min',
            category: 'User Submitted',
            tags: ['free', 'social', 'indoor', 'group-friendly'],
        },
        {
            id: 'sidsmith',
            position: [43.6633, -79.3997],
            title: 'Sid Smith Food Court Bowls',
            description:
            'Reliable grain bowls between classes. Gets slammed at noon, so go early or go hungry.',
            image: 'https://picsum.photos/seed/sidsmith/500/350',
            price: 2,
            hype: 3,
            time: '~20 min',
            category: 'Food!',
            tags: ['quick', 'vegetarian-friendly', 'solo-friendly'],
        },
        {
            id: 'baldwin',
            position: [43.6595, -79.4005],
            title: 'Kimchi House, Baldwin St.',
            description:
            'Small, cash-friendly, and consistently the best kimchi jjigae within walking distance of campus.',
            image: 'https://picsum.photos/seed/baldwin/500/350',
            price: 2,
            hype: 5,
            time: '~45 min',
            category: 'Food!',
            tags: ['cash-only', 'spicy', 'sit-down', 'date-friendly'],
        },
        {
            id: 'secondcup',
            position: [43.6598, -79.3977],
            title: 'Second Cup on College',
            description:
            'Sponsored spot — 10% off with your student card this month. Solid wifi, mediocre lattes.',
            image: 'https://picsum.photos/seed/secondcup/500/350',
            price: 2,
            hype: 2,
            time: '~15 min',
            category: 'Promoted',
            tags: ['study', 'wifi', 'discount', 'solo-friendly'],
        },
        {
            id: 'newcollege',
            position: [43.6656, -79.4012],
            title: 'New College Dining Hall Wings Night',
            description:
            'Sponsored by Res Life — Thursday wings night is a whole event, bring your meal card.',
            image: 'https://picsum.photos/seed/newcollege/500/350',
            price: 3,
            hype: 4,
            time: '~1 hr',
            category: 'Promoted',
            tags: ['social', 'sit-down', 'group-friendly'],
        },
        {
            id: 'philosopherswalk',
            position: [43.6672, -79.3986],
            title: "Philosopher's Walk",
            description:
            'Tree-lined path tucked behind the ROM. Best 15-minute reset between back-to-back lectures.',
            image: 'https://picsum.photos/seed/philosopherswalk/500/350',
            price: 1,
            hype: 4,
            time: '~15 min',
            category: 'Parks',
            tags: ['free', 'quiet', 'outdoor', 'date-friendly'],
        },
        {
            id: 'queenspark',
            position: [43.6619, -79.3912],
            title: 'Queen\u2019s Park Green',
            description:
            'Open lawn across from the legislature. Frisbee at noon, hammocks by 4pm most sunny days.',
            image: 'https://picsum.photos/seed/queenspark/500/350',
            price: 1,
            hype: 4,
            time: '~1 hr',
            category: 'Parks',
            tags: ['free', 'social', 'outdoor', 'group-friendly'],
        },
        {
            id: 'taddlecreek',
            position: [43.6611, -79.3975],
            title: 'Taddle Creek Trail Marker',
            description:
            'A buried creek daylighted in a small park pocket. Easy to miss, worth the two-minute detour.',
            image: 'https://picsum.photos/seed/taddlecreek/500/350',
            price: 1,
            hype: 2,
            time: '~10 min',
            category: 'Parks',
            tags: ['quiet', 'outdoor', 'hidden-gem', 'solo-friendly'],
        },
        {
            id: 'kensington',
            position: [43.6547, -79.4005],
            title: 'Kensington Market Empanadas',
            description:
            'Community-submitted find — cheap, filling, and a solid excuse to wander the market after class.',
            image: 'https://picsum.photos/seed/kensington/500/350',
            price: 1,
            hype: 5,
            time: '~30 min',
            category: 'User Submitted',
            tags: ['cash-only', 'quick', 'hidden-gem', 'date-friendly'],
        },
    ];


    await Promise.all(initialSpots.map(spot => 
        submitQuestForApproval({
            ...spot,
            latitude: spot.position[0],
            longitude: spot.position[1]
        })
    ))
}