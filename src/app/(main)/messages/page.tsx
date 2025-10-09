import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { redirect } from 'next/navigation';
import { MessagesPage } from '@/components/messages-page';

export default async function Messages() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect('/auth/signin');
  }

  return <MessagesPage currentUser={session.user} />;
}