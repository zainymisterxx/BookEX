'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { Footer } from '@/components/footer';
import { Header } from '@/components/header';

const FloatingAiAssistant = dynamic(
  () => import('@/components/floating-ai-assistant').then(m => m.FloatingAiAssistant),
  { ssr: false }
);

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // Hide footer on community pages and messages/chat pages
  const isCommunityPage = pathname?.startsWith('/community');
  const isMessagesPage = pathname?.startsWith('/messages');
  const shouldHideFooter = isCommunityPage || isMessagesPage;
  
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">{children}</main>
      {!shouldHideFooter && <Footer />}
      <FloatingAiAssistant />
    </div>
  );
}
