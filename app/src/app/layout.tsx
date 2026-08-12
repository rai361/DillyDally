import type { Metadata } from 'next';
import './globals.css';
import 'leaflet/dist/leaflet.css';
import GooseTransition from '../components/GooseTransition';

export const metadata: Metadata = {
  title: 'DillyDally',
  description: 'A way to find fun sidequests to complete in your downtime!',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#f0e6d2]">
        <GooseTransition />
        {children}
      </body>
    </html>
  );
}