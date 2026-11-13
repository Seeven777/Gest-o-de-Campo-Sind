import type {Metadata} from 'next';
import './globals.css';
import './auth.css';
import './dock.css';
import './operations-simplified.css';
import './studio-unified.css';
export const metadata:Metadata={title:'SindPetshop-SP | Campo & Território',description:'Inteligência territorial e operação de campo do SindPetshop-SP'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
