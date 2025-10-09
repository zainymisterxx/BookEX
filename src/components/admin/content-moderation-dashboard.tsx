/**
 * Content Moderation Dashboard Component
 * Admin interface for managing content moderation and security
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { apiFetch } from '@/lib/api-client';

interface ModerationAction {
  _id: string;
  userId: string;
  contentId: string;
  contentType: 'book' | 'post' | 'comment' | 'profile';
  action: 'approve' | 'flag' | 'reject' | 'quarantine' | 'ban';
  flags: string[];
  autoModerated: boolean;
  createdAt: string;
}

interface MaintenanceStats {
  cleaned: number;
  actions: string[];
}

interface SystemHealth {
  moderationQueue: number;
  flaggedContent: number;
  bannedUsers: number;
  activeWarnings: number;
}

export default function ContentModerationDashboard() {
  const [moderationQueue, setModerationQueue] = useState<ModerationAction[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [maintenanceRunning, setMaintenanceRunning] = useState(false);
  const [lastMaintenance, setLastMaintenance] = useState<MaintenanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadModerationData();
  }, []);

  const loadModerationData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load moderation queue
      const queueResponse = await apiFetch('/api/moderation?action=moderationQueue&limit=50&filter=flagged');
      if (!queueResponse.ok) throw new Error('Failed to load moderation queue');
      const queue = await queueResponse.json();
      setModerationQueue(queue);

      // Calculate system health metrics
      const health: SystemHealth = {
        moderationQueue: queue.length,
        flaggedContent: queue.filter((item: ModerationAction) => item.action === 'flag').length,
        bannedUsers: 0, // This would come from a separate API call
        activeWarnings: queue.filter((item: ModerationAction) => item.flags.length > 0).length
      };
      setSystemHealth(health);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load moderation data');
    } finally {
      setLoading(false);
    }
  };

  const runContentCleanup = async () => {
    try {
      setMaintenanceRunning(true);
      setError(null);

      const response = await apiFetch('/api/moderation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cleanup' })
      });

      if (!response.ok) throw new Error('Cleanup failed');
      const result = await response.json();
      setLastMaintenance(result);
      
      // Reload data after cleanup
      await loadModerationData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cleanup failed');
    } finally {
      setMaintenanceRunning(false);
    }
  };

  const runBusinessMaintenance = async () => {
    try {
      setMaintenanceRunning(true);
      const response = await apiFetch('/api/business-logic', {
        method: 'PATCH'
      });
      if (!response.ok) throw new Error('Business maintenance failed');
      await loadModerationData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Business maintenance failed');
    } finally {
      setMaintenanceRunning(false);
    }
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'approve': return 'bg-green-500';
      case 'flag': return 'bg-yellow-500';
      case 'reject': return 'bg-red-500';
      case 'quarantine': return 'bg-orange-500';
      case 'ban': return 'bg-red-800';
      default: return 'bg-gray-500';
    }
  };

  const getHealthStatus = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return { status: 'Good', color: 'text-green-600' };
    if (value <= thresholds.warning) return { status: 'Warning', color: 'text-yellow-600' };
    return { status: 'Critical', color: 'text-red-600' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading moderation dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Content Moderation Dashboard</h1>
        <div className="space-x-2">
          <Button 
            onClick={runContentCleanup} 
            disabled={maintenanceRunning}
            variant="outline"
          >
            {maintenanceRunning ? 'Running...' : 'Run Content Cleanup'}
          </Button>
          <Button 
            onClick={runBusinessMaintenance} 
            disabled={maintenanceRunning}
            variant="outline"
          >
            Business Maintenance
          </Button>
        </div>
      </div>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {lastMaintenance && (
        <Alert className="border-green-200 bg-green-50">
          <AlertDescription className="text-green-800">
            Last maintenance cleaned up {lastMaintenance.cleaned} items
          </AlertDescription>
        </Alert>
      )}

      {/* System Health Overview */}
      {systemHealth && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Moderation Queue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{systemHealth.moderationQueue}</div>
              <div className={`text-xs ${getHealthStatus(systemHealth.moderationQueue, { good: 10, warning: 25 }).color}`}>
                {getHealthStatus(systemHealth.moderationQueue, { good: 10, warning: 25 }).status}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Flagged Content</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{systemHealth.flaggedContent}</div>
              <div className={`text-xs ${getHealthStatus(systemHealth.flaggedContent, { good: 5, warning: 15 }).color}`}>
                {getHealthStatus(systemHealth.flaggedContent, { good: 5, warning: 15 }).status}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active Warnings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{systemHealth.activeWarnings}</div>
              <div className={`text-xs ${getHealthStatus(systemHealth.activeWarnings, { good: 3, warning: 10 }).color}`}>
                {getHealthStatus(systemHealth.activeWarnings, { good: 3, warning: 10 }).status}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">Healthy</div>
              <div className="text-xs text-green-600">All systems operational</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="queue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="queue">Moderation Queue</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Moderation</CardTitle>
              <CardDescription>
                Content flagged for review ({moderationQueue.length} items)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {moderationQueue.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  No items in moderation queue
                </div>
              ) : (
                <div className="space-y-4">
                  {moderationQueue.map((item) => (
                    <div key={item._id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">
                            {item.contentType.charAt(0).toUpperCase() + item.contentType.slice(1)} - {item.contentId}
                          </div>
                          <div className="text-sm text-gray-500">
                            User: {item.userId} • {new Date(item.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Badge className={getActionBadgeColor(item.action)}>
                            {item.action}
                          </Badge>
                          {item.autoModerated && (
                            <Badge variant="outline">Auto</Badge>
                          )}
                        </div>
                      </div>
                      
                      {item.flags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {item.flags.map((flag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {flag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Moderation Analytics</CardTitle>
              <CardDescription>
                System performance and moderation statistics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Auto-moderation accuracy</span>
                  <span>94%</span>
                </div>
                <Progress value={94} className="h-2" />
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>False positive rate</span>
                  <span>6%</span>
                </div>
                <Progress value={6} className="h-2" />
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Queue processing efficiency</span>
                  <span>87%</span>
                </div>
                <Progress value={87} className="h-2" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Moderation Settings</CardTitle>
              <CardDescription>
                Configure automatic moderation thresholds and policies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-gray-600">
                <p>• Toxicity threshold: 70%</p>
                <p>• Spam threshold: 80%</p>
                <p>• Profanity threshold: 60%</p>
                <p>• Auto-cleanup: Enabled (7 days)</p>
                <p>• New user approval: Required</p>
              </div>
              
              <Button variant="outline" className="w-full">
                Configure Thresholds
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
