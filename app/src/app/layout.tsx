import type { Metadata } from 'next';
import './globals.css';
import 'leaflet/dist/leaflet.css'; 
import { Geist, Geist_Mono } from "next/font/google";

import { GoogleOAuthProvider } from "@react-oauth/google";
import GoogleOneTap from "@/lib/components/google/GoogleOneTap";
import QueryProvider from "@/lib/providers/QueryProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'DillyDally',
  description: 'A way to find fun sidequests to complete in your downtime!',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // const [nonce, hashed] = await generateNonce();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <GoogleOAuthProvider 
          clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!} 
          // nonce={nonce}
        >
          <QueryProvider>
            <GoogleOneTap />
            {children}
          </QueryProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}