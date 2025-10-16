import type { Metadata } from 'next';
import { Merriweather, Nunito_Sans } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import AuthProvider from './auth-provider';
import { ProfileCompletionProvider } from '@/components/profile-completion-provider';
import { SocketProvider } from '@/components/socket-provider';
import { NotificationProvider } from '@/components/notification-provider';

export const metadata: Metadata = {
  title: 'BookEx',
  description: 'A community for buying, selling, and exchanging books.',
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn('font-body antialiased', fontBody.variable, fontHeadline.variable)} suppressHydrationWarning>
        <AuthProvider>
          <ProfileCompletionProvider>
            <SocketProvider>
              <NotificationProvider>
                {children}
                <Toaster />
              </NotificationProvider>
            </SocketProvider>
          </ProfileCompletionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
