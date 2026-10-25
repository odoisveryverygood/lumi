import type { Metadata } from 'next';
import './globals.css';
import './flare.css';
import './experience.css';
import './lumi.css';
import localFont from 'next/font/local';
const lumiFont=localFont({src:'../public/fonts/Oxanium-Variable.ttf',variable:'--font-lumi',display:'swap',weight:'200 800'});
export const metadata: Metadata = { icons: { icon: '/favicon.svg' }, title: 'Lumi — A little light on everything.', description: 'Have a conversation with any physical object. Explore its parts, understand its mechanisms, and see your changes take shape with Gemini.' };
export default function Layout({ children }: { children: React.ReactNode }) {return <html lang="en" className={lumiFont.variable}><body>{children}</body></html>}
