
"use client";

import { useState } from 'react';
import type { Organization } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from 'lucide-react';
import { approveOrganization, rejectOrganization } from '@/app/actions';

interface AdminOrgActionsProps {
  organization: Organization;
  onActionCompleted: (orgId: string, newStatus: 'approved' | 'rejected') => void;
}

export function AdminOrgActions({ organization, onActionCompleted }: AdminOrgActionsProps) {
  const [isActionLoading, setIsActionLoading] = useState(false);
  const { toast } = useToast();
  const orgId = String(organization._id);

  const handleApprove = async () => {
    setIsActionLoading(true);
    try {
      const result = await approveOrganization(orgId);
      if (!result.success) throw new Error(result.message);
      toast({ title: "Organization Approved", description: `${organization.name} is now a donation partner.` });
      onActionCompleted(orgId, 'approved');
    } catch (error) {
      console.error("Error approving organization:", error);
      toast({ variant: 'destructive', title: "Error", description: "Could not approve the organization." });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReject = async () => {
    setIsActionLoading(true);
    try {
      const result = await rejectOrganization(orgId);
      if (!result.success) throw new Error(result.message);
      toast({ title: "Organization Rejected", description: `The application for ${organization.name} has been rejected.` });
      onActionCompleted(orgId, 'rejected');
    } catch (error) {
      console.error("Error rejecting organization:", error);
      toast({ variant: 'destructive', title: "Error", description: "Could not reject the organization." });
    } finally {
      setIsActionLoading(false);
    }
  };

  if (organization.status === 'approved' || organization.status === 'rejected') {
    return <Button variant="outline" size="sm" disabled>{organization.status}</Button>;
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">Review</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Review Application: {organization.name}</AlertDialogTitle>
          <AlertDialogDescription>
            <div className="space-y-4 text-sm text-foreground py-4">
                <div className="flex items-center gap-4">
                    <Image src={organization.imageUrl} alt={organization.name} width={64} height={64} className="rounded-md border" />
                    <div>
                        <p><strong>Location:</strong> {organization.location}</p>
                        <p><strong>Submitted by:</strong> {organization.submittedBy}</p>
                    </div>
                </div>
                <p><strong>Description:</strong> {organization.description}</p>
                
                {/* Contact Information */}
                {(organization.contactEmail || organization.contactPhone || organization.website) && (
                    <div className="border-t pt-3">
                        <p className="font-medium text-muted-foreground mb-2">Contact Information:</p>
                        {organization.contactEmail && (
                            <p><strong>Email:</strong> {organization.contactEmail}</p>
                        )}
                        {organization.contactPhone && (
                            <p><strong>Phone:</strong> {organization.contactPhone}</p>
                        )}
                        {organization.website && (
                            <p><strong>Website:</strong> {organization.website}</p>
                        )}
                    </div>
                )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isActionLoading}>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={handleReject} disabled={isActionLoading}>
            {isActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Reject Application
          </Button>
          <AlertDialogAction asChild>
             <Button onClick={handleApprove} disabled={isActionLoading}>
                {isActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Approve Organization
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
