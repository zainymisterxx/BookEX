
import { getAdminDashboardData } from '../actions';
import { AdminDashboardSidebar } from '@/components/admin/admin-dashboard-sidebar';

// This is now a Server Component
export default async function AdminPage() {
  
  // Fetch initial data on the server
  const initialData = await getAdminDashboardData();

  // Pass server-fetched data as initial props to the client component
  return (
    <AdminDashboardSidebar initialData={initialData} />
  );
}
