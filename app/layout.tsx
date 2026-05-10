import './globals.css';
import 'katex/dist/katex.min.css';
import '@openuidev/react-ui/components.css';

import { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro, Inter, Baumans } from 'next/font/google';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { Toaster } from '@/components/ui/sileo-toaster';
import { ClientAnalytics } from '@/components/client-analytics';
// import { Databuddy } from '@databuddy/sdk';

import { Providers } from './providers';
import AuthGate from '@/components/auth-gate';
import { ClientHeartbeat } from '@/components/ClientHeartbeat';
import { SuspensionDetector } from '@/components/suspension-detector';

export const metadata: Metadata = {
  metadataBase: new URL('https://hypeer.vercel.app'),
  title: {
    default: 'HyperFix, la fixation — notre raison d’être.',
    template: '%s | HyperFix',
  },
  description: 'HyperFix, la fixation — notre raison d’être.',
  openGraph: {
    url: 'https://hypeer.vercel.app',
    siteName: 'HyperFix',
  },
  keywords: [
    'hypeer.vercel.app',
    'hyperfix',
    'HyperFix',
    'hyperfix app',
    'hyperfix search',
    'hyperfix business search',
    'la fixation',
    'notre raison d’être',
    'perplexity alternative',
    'ai search engine',
    'search engine',
    'Perplexity alternatives',
    'Perplexity AI alternatives',
    'open source ai search engine',
    'minimalistic ai search engine',
    'minimalistic ai search alternatives',
    'ai search',
    'minimal ai search',
    'minimal ai search alternatives',
    'AI Search Engine',
    'search engine',
    'AI',
    'perplexity',
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F9F9F9' },
    { media: '(prefers-color-scheme: dark)', color: '#111111' },
  ],
};

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  preload: true,
  weight: 'variable',
  display: 'swap',
});

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin'],
  variable: '--font-be-vietnam-pro',
  preload: true,
  display: 'swap',
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
});

const baumans = Baumans({
  subsets: ['latin'],
  variable: '--font-baumans',
  preload: true,
  display: 'swap',
  weight: ['400'],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${beVietnamPro.variable} ${baumans.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <AuthGate />
        <NuqsAdapter>
          <Providers>
            <Toaster position="top-center" />
            <ClientHeartbeat />
            <SuspensionDetector />
            {children}
          </Providers>
        </NuqsAdapter>
        {/* <Databuddy clientId={process.env.DATABUDDY_CLIENT_ID!} enableBatching={true} trackSessions={true} /> */}
        <ClientAnalytics />
      </body>
    </html>
  );
}
