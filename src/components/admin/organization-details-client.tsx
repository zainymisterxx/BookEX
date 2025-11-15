"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, Mail, Phone, Globe, MapPin, Calendar, User, 
  Edit, Trash2, Power, PowerOff, CheckCircle, XCircle, Clock,
  ArrowLeft, BarChart3
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { 
  deleteOrganization, 
  toggleOrganizationStatus, 
  updateOrganizationStatus 
} from '@/app/actions';
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
import { EditOrganizationModal } from './edit-organization-modal';

interface OrganizationDetailsClientProps {
  initialData: {
    organization: any;
    stats: {
      totalDonations: number;
      pendingDonations: number;
      confirmedDonations: number;
      inProgressDonations: number;
      completedDonations: number;
      cancelledDonations: number;
      rejectedDonations: number;
      totalBooksReceived: number;
      acceptanceRate: number;
    };
    submittedBy: any;
  };
  organizationId: string;
}

export function OrganizationDetailsClient({ initialData, organizationId }: OrganizationDetailsClientProps) {
  const [organization, setOrganization] = useState(initialData.organization);
  const [stats, setStats] = useState(initialData.stats);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteOrganization(organizationId);
      if (!result.success) throw new Error(result.message);
      
      toast({
        title: "Organization Deleted",
        description: "The organization has been permanently deleted.",
      });
      router.push('/admin');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: "Error",
        description: error.message || "Failed to delete organization.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleStatus = async () => {
    setIsToggling(true);
    try {
      const newActive = !organization.isActive;
      const result = await toggleOrganizationStatus(organizationId, newActive);
      if (!result.success) throw new Error(result.message);
      
      setOrganization({ ...organization, isActive: newActive });
      toast({
        title: newActive ? "Organization Activated" : "Organization Suspended",
        description: newActive 
          ? "The organization can now receive donations." 
          : "The organization is temporarily suspended.",
      });
      router.refresh();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: "Error",
        description: error.message || "Failed to update organization status.",
      });
    } finally {
      setIsToggling(false);
    }
  };

  const handleStatusChange = async (newStatus: 'approved' | 'pending' | 'rejected') => {
    setIsChangingStatus(true);
    try {
      const result = await updateOrganizationStatus(organizationId, newStatus);
      if (!result.success) throw new Error(result.message);
      
      setOrganization({ ...organization, status: newStatus });
      toast({
        title: "Status Updated",
        description: `Organization status changed to ${newStatus}.`,
      });
      router.refresh();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: "Error",
        description: error.message || "Failed to update status.",
      });
    } finally {
      setIsChangingStatus(false);
    }
  };

  const handleUpdateSuccess = () => {
    router.refresh();
  };

  const isActive = organization.isActive !== false; // Default to true if undefined

  return (
    <div className="min-h-screen bg-secondary p-4 lg:p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
        </Link>
        
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">
              {organization.name}
            </h1>
            <p className="text-muted-foreground mt-1">
              Organization Details & Management
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <EditOrganizationModal 
              organization={organization} 
              organizationId={organizationId}
              onSuccess={handleUpdateSuccess}
            >
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            </EditOrganizationModal>

            <Button
              variant={isActive ? "outline" : "default"}
              size="sm"
              onClick={handleToggleStatus}
              disabled={isToggling}
            >
              {isActive ? (
                <>
                  <PowerOff className="h-4 w-4 mr-2" />
                  Suspend
                </>
              ) : (
                <>
                  <Power className="h-4 w-4 mr-2" />
                  Activate
                </>
              )}
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Organization?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete{' '}
                    <strong>{organization.name}</strong> and remove all associated data.
                    {stats.totalDonations > 0 && (
                      <p className="mt-2 text-yellow-600 dark:text-yellow-400 font-medium">
                        ⚠️ This organization has {stats.totalDonations} donation(s). 
                        {stats.pendingDonations + stats.confirmedDonations + stats.inProgressDonations > 0 && (
                          <> Please complete or cancel active donations first.</>
                        )}
                      </p>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting ? "Deleting..." : "Delete Organization"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="max-w-7xl mx-auto mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Status:</span>
                <Badge 
                  variant={
                    organization.status === 'approved' ? 'default' : 
                    organization.status === 'rejected' ? 'destructive' : 'secondary'
                  }
                >
                  {organization.status}
                </Badge>
                {organization.status !== 'approved' && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => handleStatusChange('approved')}
                    disabled={isChangingStatus}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                )}
                {organization.status !== 'rejected' && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => handleStatusChange('rejected')}
                    disabled={isChangingStatus}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                )}
                {organization.status !== 'pending' && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => handleStatusChange('pending')}
                    disabled={isChangingStatus}
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    Mark Pending
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Active:</span>
                <Badge variant={isActive ? 'default' : 'secondary'}>
                  {isActive ? 'Active' : 'Suspended'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-6">
        {/* Profile Section */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Organization Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logo & Basic Info */}
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="flex-shrink-0">
                  <Image
                    src={organization.imageUrl}
                    alt={organization.name}
                    width={120}
                    height={120}
                    className="rounded-lg border object-cover"
                  />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="text-xl font-semibold">{organization.name}</h3>
                    <p className="text-muted-foreground mt-1">{organization.description}</p>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{organization.location}</span>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Contact Information</h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  {organization.contactEmail && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${organization.contactEmail}`} className="text-blue-600 hover:underline">
                        {organization.contactEmail}
                      </a>
                    </div>
                  )}
                  {organization.contactPhone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${organization.contactPhone}`} className="text-blue-600 hover:underline">
                        {organization.contactPhone}
                      </a>
                    </div>
                  )}
                  {organization.website && (
                    <div className="flex items-center gap-2 text-sm sm:col-span-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <a 
                        href={organization.website} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-blue-600 hover:underline"
                      >
                        {organization.website}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Metadata */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Metadata</h4>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Created:</span>
                    <span>{new Date(organization.createdAt).toLocaleDateString()}</span>
                  </div>
                  {organization.updatedAt && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Updated:</span>
                      <span>{new Date(organization.updatedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  {initialData.submittedBy && (
                    <div className="flex items-center gap-2 sm:col-span-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Submitted by:</span>
                      <span>{initialData.submittedBy.name} ({initialData.submittedBy.email})</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Statistics Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Statistics
              </CardTitle>
              <CardDescription>Donation metrics and performance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Donations</span>
                  <span className="text-2xl font-bold">{stats.totalDonations}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-yellow-600">Pending</span>
                  <span className="font-medium">{stats.pendingDonations}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-purple-600">Confirmed</span>
                  <span className="font-medium">{stats.confirmedDonations}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-orange-600">In Progress</span>
                  <span className="font-medium">{stats.inProgressDonations}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-green-600">Completed</span>
                  <span className="font-medium">{stats.completedDonations}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Cancelled</span>
                  <span className="font-medium">{stats.cancelledDonations}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-red-600">Rejected</span>
                  <span className="font-medium">{stats.rejectedDonations}</span>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Books Received</span>
                  <span className="text-xl font-bold text-green-600">{stats.totalBooksReceived}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Acceptance Rate</span>
                  <span className="text-xl font-bold text-blue-600">{stats.acceptanceRate}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
