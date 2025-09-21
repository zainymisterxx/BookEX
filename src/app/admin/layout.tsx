import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { AdminHeader } from '@/components/admin/admin-header';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session?.user || session.user.role !== 'admin') {
    redirect('/');
  }
  
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
