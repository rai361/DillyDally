// Things that might be used idk

export async function sha256hash(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(text);
    
    const buffer = await crypto.subtle.digest('SHA-256', encoded);;
    const array = Array.from(new Uint8Array(buffer));
    const hashed = array.map((b) => b.toString(16).padStart(2, '0')).join('');

    return hashed;
}

export async function generateNonce(): Promise<string[]> {
    const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
    const hashed = await sha256hash(nonce);

    return [nonce, hashed];
}

export function getFileExt(fileName: string): string {
    return fileName.substring(fileName.lastIndexOf('.') + 1);
}