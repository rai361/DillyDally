"use client";

// Might be used in the future

import React, { createContext, useContext } from "react";

interface NonceContextParams {
    nonce: string | null;
    hashed: string | null;
}

const NonceContext = createContext<NonceContextParams>({
    nonce: null,
    hashed: null
});

export function NonceProvider({ 
    children, 
    nonce, 
    hashed 
} : { 
    children: React.ReactNode, 
    nonce: NonceContextParams['nonce']
    hashed: NonceContextParams['hashed']
 }) {
    return (
        <NonceContext.Provider value={{nonce, hashed}}>
            {children}
        </NonceContext.Provider>
    )
}

export const useNonce = () => useContext(NonceContext); 