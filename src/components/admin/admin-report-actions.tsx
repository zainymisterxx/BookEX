
"use client";

import { useState } from 'react';
import type { Report } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

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
import { resolveReport, removeContentAndResolveReport } from '@/app/actions';

interface AdminReportActionsProps {
  report: Report;
  onResolved: (reportId: string) => void;
}

export function AdminReportActions({ report, onResolved }: AdminReportActionsProps) {
  const [isActionLoading, setIsActionLoading] = useState(false);
  const { toast } = useToast();
  const reportId = String(report._id);
  const contentId = String(report.reportedContentId);

  const handleDismiss = async () => {
    setIsActionLoading(true);
    try {
      const result = await resolveReport(reportId);
      if (!result.success) throw new Error(result.message);
      toast({ title: "Report Dismissed", description: "The report has been marked as resolved." });
      onResolved(reportId);
    } catch (error) {
      console.error("Error dismissing report:", error);
      toast({ variant: 'destructive', title: "Error", description: "Could not dismiss the report." });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRemoveContent = async () => {
    setIsActionLoading(true);
    try {
      const result = await removeContentAndResolveReport(reportId, contentId, report.reportedContentType);
      if (!result.success) throw new Error(result.message);
      
      toast({ title: "Content Removed", description: "The reported content has been removed and the report resolved." });
      onResolved(reportId);
    } catch (error) {
      console.error("Error removing content:", error);
      toast({ variant: 'destructive', title: "Error", description: "Could not remove the content." });
    } finally {
      setIsActionLoading(false);
    }
  };

  if (report.status === 'resolved') {
    return <Button variant="outline" size="sm" disabled>Resolved</Button>;
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">Review</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Review Report</AlertDialogTitle>
          <AlertDialogDescription>
            <div className="space-y-2 text-sm text-foreground py-4">
                <p><strong>Reason:</strong> {report.reason}</p>
                <p><strong>Details:</strong> {report.details || 'No additional details provided.'}</p>
                <p><strong>Reported User ID:</strong> {report.reportedUserId}</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isActionLoading}>Cancel</AlertDialogCancel>
          <Button variant="secondary" onClick={handleDismiss} disabled={isActionLoading}>
            {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Dismiss Report
          </Button>
          <AlertDialogAction asChild>
             <Button variant="destructive" onClick={handleRemoveContent} disabled={isActionLoading}>
                {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Remove Content & Resolve
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
