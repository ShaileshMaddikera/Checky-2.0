import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Checky — Smart Shopping Assistant',
  description: 'AI-powered real-time price checker with smart glass UI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black overflow-hidden">{children}</body>
    </html>
  );
}
