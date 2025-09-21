import { Footer } from '@/components/footer';
import { Header } from '@/components/header';
import { FloatingAiAssistant } from '@/components/floating-ai-assistant';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <FloatingAiAssistant />
    </div>
  );
}
