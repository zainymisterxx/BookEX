
import { getAdminDashboardData } from '../actions';
import { AdminDashboardSidebar } from '@/components/admin/admin-dashboard-sidebar';

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';

// This is now a Server Component
export default async function AdminPage() {
  
  // Fetch initial data on the server
  const response = await getAdminDashboardData();
  
  // Extract data from the response
  const initialData = response.success ? response.data : {
    userCount: 0,
    listingCount: 0,
    organizations: [],
    reports: [],
    users: []
  };

  // Pass server-fetched data as initial props to the client component
  return (
    <AdminDashboardSidebar initialData={initialData} />
  );
}
