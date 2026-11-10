import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'SindPetshop-SP | Gestão de Campo', description: 'Captação e inteligência territorial' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="pt-BR"><body>{children}</body></html>; }
