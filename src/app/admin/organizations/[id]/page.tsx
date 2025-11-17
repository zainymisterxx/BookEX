import { getOrganizationDetails } from '@/app/actions';
import { OrganizationDetailsClient } from '@/components/admin/organization-details-client';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function OrganizationDetailsPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  const result = await getOrganizationDetails(id);
  
  if (!result.success) {
    notFound();
  }

  return <OrganizationDetailsClient initialData={result.data} organizationId={id} />;
}
