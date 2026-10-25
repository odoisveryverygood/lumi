import type { Metadata } from 'next';
import './globals.css';
import './flare.css';
import './experience.css';
import './morf.css';
import './morf-character.css';
import './morf-navigation.css';
import './morf-circuits.css';
import localFont from 'next/font/local';
const morfFont=localFont({src:'../public/fonts/Oxanium-Variable.ttf',variable:'--font-morf',display:'swap',weight:'200 800'});
export const metadata: Metadata = { icons: { icon: '/favicon.svg' }, title: 'Morf — Understand. Modify. Verify.', description: 'Have a conversation with any physical object. Explore its parts, understand its mechanisms, and see your changes take shape with Gemini.' };
export default function Layout({ children }: { children: React.ReactNode }) {return <html lang="en" className={morfFont.variable}><body>{children}</body></html>}
