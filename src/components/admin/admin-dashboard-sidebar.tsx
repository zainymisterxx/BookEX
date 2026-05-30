"use client";

import { useEffect, useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, PlusCircle, Shield, Database, Users, FileText, AlertTriangle, UserCheck, Menu, X, Search } from "lucide-react";
import type { Organization, Report, User } from '@/lib/types';
import Link from 'next/link';
import { AdminReportActions } from '@/components/admin/admin-report-actions';
import { AdminOrgActions } from '@/components/admin/admin-org-actions';
import { AdminUserActions } from '@/components/admin/admin-user-actions';
import { getAdminDashboardData, getAdminReports, resolveReport, removeContentAndResolveReport } from '@/app/actions';
import { AddOrganizationModal } from '@/components/admin/add-organization-modal';
import { DatabaseManagement } from '@/components/admin/database-management';
import SecurityAdminDashboard from '@/components/admin/security-admin-dashboard';
import ContentModerationDashboard from '@/components/admin/content-moderation-dashboard';
import SimpleComprehensiveDashboard from '@/components/admin/simple-comprehensive-dashboard';
import { ResponsiveTable, OrganizationMobileCard, UserMobileCard } from '@/components/admin/responsive-table';

type ReportStatus = 'pending' | 'resolved' | 'dismissed';

interface ReportWithUsers extends Report {
    reporter?: { _id: string; name: string };
    reportedUser?: { _id: string; name: string };
}

interface AdminData {
    userCount: number;
    listingCount: number;
    organizations: Organization[];
    reports: Report[];
    users: User[];
}

interface AdminDashboardClientProps {
    initialData: AdminData;
}

export function AdminDashboardSidebar({ initialData }: AdminDashboardClientProps) {
    const [data, setData] = useState<AdminData>(initialData);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Reports tab state
    const [reports, setReports] = useState<ReportWithUsers[]>([]);
    const [reportsStatus, setReportsStatus] = useState<ReportStatus>('pending');
    const [reportsPagination, setReportsPagination] = useState({ currentPage: 1, totalPages: 1, totalCount: 0, hasNext: false, hasPrev: false });
    const [reportsLoading, setReportsLoading] = useState(false);
    const [reportActionPending, startReportAction] = useTransition();

    // Users tab state
    const [userSearch, setUserSearch] = useState('');

    const fetchAdminData = async () => {
        setIsLoading(true);
        const response = await getAdminDashboardData();
        if (response.success) {
            setData(response.data);
        }
        setIsLoading(false);
    }
    
    const handleOrgActionCompleted = (orgId: string, newStatus: 'approved' | 'rejected') => {
        setData(prevData => {
            if (!prevData) return prevData;
            const updatedOrgs = prevData.organizations.map(org => 
                String(org._id) === orgId ? { ...org, status: newStatus } : org
            );
            return { ...prevData, organizations: updatedOrgs };
        });
        getAdminDashboardData().then(response => {
            if (response.success) {
                setData(response.data);
            }
        });
    }

    const handleReportActionCompleted = (reportId: string) => {
        setData(prevData => {
            if (!prevData) return prevData;
            const updatedReports = prevData.reports.filter(report => String(report._id) !== reportId);
            return { ...prevData, reports: updatedReports };
        });
        getAdminDashboardData().then(response => {
            if (response.success) {
                setData(response.data);
            }
        });
    }
    
    const handleOrganizationAdded = () => {
        fetchAdminData();
    }

    const handleUserStatusChanged = (userId: string, newStatus: 'active' | 'suspended') => {
        setData(prevData => {
            if (!prevData) return prevData;
            const updatedUsers = prevData.users.map(user => 
                String(user._id) === userId ? { ...user, status: newStatus } : user
            );
            return { ...prevData, users: updatedUsers };
        });
    }

    const handleUserDeleted = (userId: string) => {
        setData(prevData => {
            if (!prevData) return prevData;
            const updatedUsers = prevData.users.filter(user =>
                String(user._id) !== userId
            );
            return { ...prevData, users: updatedUsers };
        });
    }

    const fetchReports = async (status: ReportStatus, page = 1) => {
        setReportsLoading(true);
        const result = await getAdminReports(status, undefined, page, 20);
        setReports(result.reports as ReportWithUsers[]);
        setReportsPagination(result.pagination);
        setReportsLoading(false);
    };

    useEffect(() => {
        if (activeTab === 'reports') {
            fetchReports(reportsStatus, 1);
        }
    // NOTE: only re-run when tab or status changes, not fetchReports identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, reportsStatus]);

    const handleResolveReport = (reportId: string) => {
        startReportAction(async () => {
            await resolveReport(reportId);
            await fetchReports(reportsStatus, reportsPagination.currentPage);
        });
    };

    const handleRemoveAndResolve = (reportId: string, contentId: string, contentType: Report['reportedContentType']) => {
        startReportAction(async () => {
            await removeContentAndResolveReport(reportId, contentId, contentType);
            await fetchReports(reportsStatus, reportsPagination.currentPage);
        });
    };

    const { userCount, listingCount, organizations, reports: dashboardReports, users } = data;

    const filteredUsers = userSearch.trim().length === 0
        ? users
        : users?.filter(u => {
            const q = userSearch.toLowerCase();
            return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
        });

    const sidebarItems = [
        { id: 'comprehensive', label: 'Dashboard', icon: Shield },
        { id: 'overview', label: 'Overview', icon: Users },
        { 
            id: 'organizations', 
            label: 'Organizations', 
            icon: FileText,
            badge: organizations?.length || 0
        },
        { id: 'security', label: 'Security', icon: Shield },
        { 
            id: 'moderation', 
            label: 'Moderation', 
            icon: FileText,
            badge: reports?.filter(report => report.status === 'pending').length || 0
        },
        { id: 'database', label: 'Database', icon: Database },
        { id: 'users', label: 'Users', icon: UserCheck },
        {
            id: 'reports',
            label: 'Reports',
            icon: AlertTriangle,
            badge: dashboardReports?.filter(r => r.status === 'pending').length || 0
        },
    ];

    return (
        <div className="min-h-screen bg-secondary flex">
            {/* Mobile hamburger button */}
            <button 
                className="lg:hidden fixed top-20 left-4 z-50 p-2 bg-white rounded-lg shadow-md border"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label="Toggle sidebar"
            >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div 
                    className="lg:hidden fixed inset-0 bg-black/50 z-30"
                    onClick={() => setSidebarOpen(false)}
                />
            )}
            
            {/* Responsive Sidebar */}
            <div className={`
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                lg:translate-x-0 transition-transform duration-300 ease-in-out
                fixed lg:static w-64 bg-white shadow-lg border-r border-border min-h-screen z-40
            `}>
                <div className="p-6 border-b border-border">
                    <h2 className="text-2xl font-bold font-headline text-primary">Admin Panel</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Platform Management
                    </p>
                </div>
                <nav className="p-4 space-y-1">
                    {sidebarItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.id}
                                onClick={() => {
                                    setActiveTab(item.id);
                                    setSidebarOpen(false); // Close sidebar on mobile after selection
                                }}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors ${
                                    activeTab === item.id
                                        ? 'bg-primary text-primary-foreground'
                                        : 'hover:bg-accent hover:text-accent-foreground'
                                }`}
                            >
                                <div className="flex items-center">
                                    <Icon className="h-4 w-4 mr-3" />
                                    <span>{item.label}</span>
                                </div>
                                {item.badge && item.badge > 0 && (
                                    <Badge className="bg-red-500 text-white">
                                        {item.badge}
                                    </Badge>
                                )}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 min-h-screen bg-secondary lg:ml-0">
                <div className="p-4 lg:p-6 h-full">
                    {/* Mobile page title */}
                    <div className="lg:hidden mb-4 pl-12">
                        <h1 className="text-xl font-headline text-primary capitalize">
                            {sidebarItems.find(item => item.id === activeTab)?.label || 'Dashboard'}
                        </h1>
                    </div>
                    {activeTab === 'comprehensive' && <SimpleComprehensiveDashboard />}
                    
                    {activeTab === 'overview' && (
                        <div className="space-y-6 h-full">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="font-headline text-2xl">Platform Activity</CardTitle>
                                    <CardDescription>Overview of key metrics.</CardDescription>
                                </CardHeader>
                                <CardContent className="grid md:grid-cols-4 gap-6">
                                    <div className="p-6 bg-background rounded-lg border">
                                        <h3 className="text-sm font-medium text-muted-foreground">Total Users</h3>
                                        <p className="text-3xl font-bold">{userCount}</p>
                                    </div>
                                    <div className="p-6 bg-background rounded-lg border">
                                        <h3 className="text-sm font-medium text-muted-foreground">Active Listings</h3>
                                        <p className="text-3xl font-bold">{listingCount}</p>
                                    </div>
                                    <div className="p-6 bg-background rounded-lg border">
                                        <h3 className="text-sm font-medium text-muted-foreground">Organizations</h3>
                                        <p className="text-3xl font-bold">{organizations?.length || 0}</p>
                                    </div>
                                    <div className="p-6 bg-background rounded-lg border">
                                        <h3 className="text-sm font-medium text-muted-foreground">Pending Reports</h3>
                                        <p className="text-3xl font-bold text-yellow-600">{dashboardReports?.filter(r => r.status === 'pending').length || 0}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'organizations' && (
                        <div className="space-y-6 h-full">
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="font-headline text-2xl">Donation Organizations</CardTitle>
                                            <CardDescription>Manage and approve donation organizations.</CardDescription>
                                        </div>
                                        <AddOrganizationModal onOrganizationAdded={handleOrganizationAdded}>
                                            <Button>
                                                <PlusCircle className="h-4 w-4 mr-2" />
                                                Add Organization
                                            </Button>
                                        </AddOrganizationModal>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {/* Desktop table */}
                                    <div className="hidden md:block">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Name</TableHead>
                                                    <TableHead>Location</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {organizations?.map((org) => (
                                                    <TableRow key={String(org._id)}>
                                                        <TableCell className="font-medium">
                                                            <Link 
                                                                href={`/admin/organizations/${String(org._id)}`}
                                                                className="hover:text-primary hover:underline"
                                                            >
                                                                {org.name}
                                                            </Link>
                                                        </TableCell>
                                                        <TableCell>{org.location}</TableCell>
                                                        <TableCell>
                                                            <Badge 
                                                                variant={
                                                                    org.status === 'approved' ? 'default' : 
                                                                    org.status === 'rejected' ? 'destructive' : 'secondary'
                                                                }
                                                            >
                                                                {org.status}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="flex gap-2">
                                                            <Link href={`/admin/organizations/${String(org._id)}`}>
                                                                <Button variant="outline" size="sm">
                                                                    View Details
                                                                </Button>
                                                            </Link>
                                                            <AdminOrgActions 
                                                                organization={org} 
                                                                onActionCompleted={handleOrgActionCompleted}
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    
                                    {/* Mobile cards */}
                                    <div className="md:hidden space-y-4">
                                        {organizations?.map((org) => (
                                            <OrganizationMobileCard key={String(org._id)} organization={org}>
                                                <div className="flex gap-2">
                                                    <Link href={`/admin/organizations/${String(org._id)}`} className="flex-1">
                                                        <Button variant="outline" size="sm" className="w-full">
                                                            View Details
                                                        </Button>
                                                    </Link>
                                                    <AdminOrgActions 
                                                        organization={org} 
                                                        onActionCompleted={handleOrgActionCompleted}
                                                    />
                                                </div>
                                            </OrganizationMobileCard>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'security' && <SecurityAdminDashboard />}
                    
                    {activeTab === 'moderation' && <ContentModerationDashboard />}
                    
                    {activeTab === 'database' && <DatabaseManagement />}
                    
                    {activeTab === 'users' && (
                        <div className="space-y-6 h-full">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="font-headline text-2xl">User Management</CardTitle>
                                    <CardDescription>Manage platform users and their accounts.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="relative mb-4">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type="search"
                                            placeholder="Search by name or email…"
                                            value={userSearch}
                                            onChange={e => setUserSearch(e.target.value)}
                                            className="pl-9"
                                        />
                                    </div>
                                    {/* Desktop table */}
                                    <div className="hidden md:block">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Name</TableHead>
                                                    <TableHead>Email</TableHead>
                                                    <TableHead>Role</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Join Date</TableHead>
                                                    <TableHead>Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredUsers?.map((user) => (
                                                    <TableRow key={String(user._id)}>
                                                        <TableCell className="font-medium">{user.name}</TableCell>
                                                        <TableCell>{user.email}</TableCell>
                                                        <TableCell>
                                                            <Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'}>
                                                                {user.role}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                                                                {user.status || 'active'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                                                        </TableCell>
                                                        <TableCell>
                                                            <AdminUserActions
                                                                user={user}
                                                                onUserStatusChanged={handleUserStatusChanged}
                                                                onUserDeleted={handleUserDeleted}
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {filteredUsers?.length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                                                            No users match your search.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    {/* Mobile cards */}
                                    <div className="md:hidden space-y-4">
                                        {filteredUsers?.map((user) => (
                                            <UserMobileCard key={String(user._id)} user={user}>
                                                <AdminUserActions
                                                    user={user}
                                                    onUserStatusChanged={handleUserStatusChanged}
                                                    onUserDeleted={handleUserDeleted}
                                                />
                                            </UserMobileCard>
                                        ))}
                                        {filteredUsers?.length === 0 && (
                                            <p className="text-center text-muted-foreground py-6">No users match your search.</p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'reports' && (
                        <div className="space-y-6 h-full">
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between flex-wrap gap-4">
                                        <div>
                                            <CardTitle className="font-headline text-2xl">Report Management</CardTitle>
                                            <CardDescription>
                                                {reportsPagination.totalCount} report{reportsPagination.totalCount !== 1 ? 's' : ''} total
                                            </CardDescription>
                                        </div>
                                        <Select
                                            value={reportsStatus}
                                            onValueChange={(v) => setReportsStatus(v as ReportStatus)}
                                        >
                                            <SelectTrigger className="w-40">
                                                <SelectValue placeholder="Filter status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="pending">Pending</SelectItem>
                                                <SelectItem value="resolved">Resolved</SelectItem>
                                                <SelectItem value="dismissed">Dismissed</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {reportsLoading ? (
                                        <div className="flex justify-center py-12">
                                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : (
                                        <>
                                            <div className="hidden md:block">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Reporter</TableHead>
                                                            <TableHead>Content Type</TableHead>
                                                            <TableHead>Reason</TableHead>
                                                            <TableHead>Status</TableHead>
                                                            <TableHead>Date</TableHead>
                                                            <TableHead>Actions</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {reports.map((report) => (
                                                            <TableRow key={String(report._id)}>
                                                                <TableCell className="font-medium">
                                                                    {report.reporter?.name ?? report.reporterId ?? '—'}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Badge variant="secondary">
                                                                        {report.reportedContentType}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="max-w-xs truncate" title={report.details}>
                                                                    {report.reason}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Badge variant={
                                                                        report.status === 'pending' ? 'secondary' :
                                                                        report.status === 'resolved' ? 'default' : 'outline'
                                                                    }>
                                                                        {report.status}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell>
                                                                    {new Date(report.createdAt).toLocaleDateString()}
                                                                </TableCell>
                                                                <TableCell>
                                                                    {report.status === 'pending' && (
                                                                        <div className="flex gap-2">
                                                                            <Button
                                                                                size="sm"
                                                                                variant="outline"
                                                                                disabled={reportActionPending}
                                                                                onClick={() => handleResolveReport(String(report._id))}
                                                                            >
                                                                                Resolve
                                                                            </Button>
                                                                            <Button
                                                                                size="sm"
                                                                                variant="destructive"
                                                                                disabled={reportActionPending}
                                                                                onClick={() => handleRemoveAndResolve(
                                                                                    String(report._id),
                                                                                    report.reportedContentId,
                                                                                    report.reportedContentType
                                                                                )}
                                                                            >
                                                                                Remove Content
                                                                            </Button>
                                                                        </div>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                        {reports.length === 0 && (
                                                            <TableRow>
                                                                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                                                                    No {reportsStatus} reports.
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>

                                            {/* Mobile cards */}
                                            <div className="md:hidden space-y-4">
                                                {reports.map((report) => (
                                                    <Card key={String(report._id)} className="border">
                                                        <CardContent className="pt-4 space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <span className="font-medium text-sm">
                                                                    {report.reporter?.name ?? report.reporterId ?? '—'}
                                                                </span>
                                                                <Badge variant={
                                                                    report.status === 'pending' ? 'secondary' :
                                                                    report.status === 'resolved' ? 'default' : 'outline'
                                                                }>
                                                                    {report.status}
                                                                </Badge>
                                                            </div>
                                                            <div className="flex gap-2 flex-wrap">
                                                                <Badge variant="secondary">{report.reportedContentType}</Badge>
                                                                <span className="text-sm text-muted-foreground">{report.reason}</span>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground">
                                                                {new Date(report.createdAt).toLocaleDateString()}
                                                            </p>
                                                            {report.status === 'pending' && (
                                                                <div className="flex gap-2 pt-1">
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        disabled={reportActionPending}
                                                                        onClick={() => handleResolveReport(String(report._id))}
                                                                    >
                                                                        Resolve
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="destructive"
                                                                        disabled={reportActionPending}
                                                                        onClick={() => handleRemoveAndResolve(
                                                                            String(report._id),
                                                                            report.reportedContentId,
                                                                            report.reportedContentType
                                                                        )}
                                                                    >
                                                                        Remove Content
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                                {reports.length === 0 && (
                                                    <p className="text-center text-muted-foreground py-6">No {reportsStatus} reports.</p>
                                                )}
                                            </div>

                                            {/* Pagination */}
                                            {reportsPagination.totalPages > 1 && (
                                                <div className="flex items-center justify-between pt-4">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={!reportsPagination.hasPrev || reportsLoading}
                                                        onClick={() => fetchReports(reportsStatus, reportsPagination.currentPage - 1)}
                                                    >
                                                        Previous
                                                    </Button>
                                                    <span className="text-sm text-muted-foreground">
                                                        Page {reportsPagination.currentPage} of {reportsPagination.totalPages}
                                                    </span>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={!reportsPagination.hasNext || reportsLoading}
                                                        onClick={() => fetchReports(reportsStatus, reportsPagination.currentPage + 1)}
                                                    >
                                                        Next
                                                    </Button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
