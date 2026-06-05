import type { Metadata } from 'next';
import { Merriweather, Nunito_Sans } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import AuthProvider from './auth-provider';
import { ProfileCompletionProvider } from '@/components/profile-completion-provider';
import { SocketProvider } from '@/components/socket-provider';
import { NotificationProvider } from '@/components/notification-provider';
import { ErrorBoundary } from '@/components/error-boundary';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';

export const metadata: Metadata = {
  title: 'BookEX — Exchange, Buy & Donate Books',
  description: 'Community-driven platform for buying, selling, exchanging, and donating books.',
  openGraph: {
    title: 'BookEX — Exchange, Buy & Donate Books',
    description: 'Community-driven platform for buying, selling, exchanging, and donating books.',
    type: 'website',
    siteName: 'BookEX',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BookEX — Exchange, Buy & Donate Books',
    description: 'Community-driven platform for buying, selling, exchanging, and donating books.',
  },
};

const fontBody = Nunito_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
  weight: ['400', '600', '700'],
});

const fontHeadline = Merriweather({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-headline',
  weight: ['400', '700'],
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn('font-body antialiased', fontBody.variable, fontHeadline.variable)} suppressHydrationWarning>
        <ErrorBoundary>
          <AuthProvider session={session}>
            <ProfileCompletionProvider>
              <SocketProvider>
                <NotificationProvider>
                  {children}
                  <Toaster />
                </NotificationProvider>
              </SocketProvider>
            </ProfileCompletionProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
