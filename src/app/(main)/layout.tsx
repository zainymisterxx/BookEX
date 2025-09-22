'use client';

import { usePathname } from 'next/navigation';
import { Footer } from '@/components/footer';
import { Header } from '@/components/header';
import { FloatingAiAssistant } from '@/components/floating-ai-assistant';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // Hide footer on community pages
  const isCommunityPage = pathname?.startsWith('/community');
  
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">{children}</main>
      {!isCommunityPage && <Footer />}
      <FloatingAiAssistant />
    </div>
  );
}
