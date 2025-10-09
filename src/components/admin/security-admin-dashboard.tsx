/**
 * Comprehensive Security Admin Dashboard
 * Centralized management for all security features and monitoring
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Shield, 
  Lock, 
  Users, 
  FileText, 
  Database, 
  AlertTriangle, 
  CheckCircle, 
  Activity,
  MessageSquare,
  Upload,
  Settings,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { apiFetch } from '@/lib/api-client';

interface SecurityStats {
  authentication: {
    totalLogins: number;
    failedAttempts: number;
    blockedAccounts: number;
    rateLimitHits: number;
  };
  authorization: {
    accessDenied: number;
    privilegeEscalations: number;
    suspiciousActivity: number;
  };
  contentModeration: {
    flaggedContent: number;
    autoRejected: number;
    pendingReview: number;
    bannedUsers: number;
  };
  filesSecurity: {
    filesUploaded: number;
    virusDetected: number;
    quarantined: number;
    cleanFiles: number;
  };
  businessLogic: {
    activeLocks: number;
    duplicatesBlocked: number;
    suspiciousListings: number;
    inventoryIssues: number;
  };
  messageEncryption: {
    encryptedMessages: number;
    encryptionFailures: number;
    keyRotations: number;
  };
}

interface SecurityAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  timestamp: string;
  resolved: boolean;
}

export default function SecurityAdminDashboard() {
  const [securityStats, setSecurityStats] = useState<SecurityStats | null>(null);
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);
  const [systemHealth, setSystemHealth] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSecurityData();
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(loadSecurityData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadSecurityData = async () => {
    try {
      setError(null);
      if (!securityStats) setLoading(true);
      else setRefreshing(true);

      // Load real security statistics
      const [statsResponse, alertsResponse, healthResponse] = await Promise.all([
        apiFetch('/api/admin/security?action=securityStats'),
        apiFetch('/api/admin/security?action=securityAlerts'),
        apiFetch('/api/admin/security?action=systemHealth')
      ]);

      if (!statsResponse.ok || !alertsResponse.ok || !healthResponse.ok) {
        throw new Error('Failed to load security data');
      }

      const stats = await statsResponse.json();
      const alerts = await alertsResponse.json();
      const health = await healthResponse.json();

      setSecurityStats(stats);
      setSystemHealth(health.score);
      setSecurityAlerts(alerts);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load security data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const runSecurityMaintenance = async (category: string) => {
    try {
      setRefreshing(true);
      
      // Use our security API for all maintenance operations
      const response = await apiFetch('/api/admin/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'runMaintenance',
          category: category 
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Maintenance failed');
      }
      
      const result = await response.json();
      console.log(`Security maintenance completed for ${category}:`, result);
      
      // Refresh security data after maintenance
      await loadSecurityData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Maintenance failed');
    } finally {
      setRefreshing(false);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const response = await apiFetch('/api/admin/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'resolveAlert',
          alertId: alertId 
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to resolve alert');
      }
      
      // Remove the resolved alert from local state
      setSecurityAlerts(alerts => alerts.filter(alert => alert.id !== alertId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve alert');
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <CheckCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading security dashboard...</div>
      </div>
    );
  }

  if (!securityStats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-red-600">Failed to load security data</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Security Administration</h1>
          <p className="text-muted-foreground">Comprehensive security monitoring and management</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className={`text-2xl font-bold ${getHealthColor(systemHealth)}`}>
            {systemHealth}% Health
          </div>
          <Button 
            onClick={loadSecurityData} 
            disabled={refreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center space-x-2">
              <Shield className="h-4 w-4" />
              <CardTitle className="text-sm font-medium">Authentication</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{securityStats.authentication.failedAttempts}</div>
            <div className="text-xs text-muted-foreground">Failed attempts today</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center space-x-2">
              <Lock className="h-4 w-4" />
              <CardTitle className="text-sm font-medium">Authorization</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{securityStats.authorization.accessDenied}</div>
            <div className="text-xs text-muted-foreground">Access denied today</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <CardTitle className="text-sm font-medium">Content</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{securityStats.contentModeration.flaggedContent}</div>
            <div className="text-xs text-muted-foreground">Flagged content</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center space-x-2">
              <Upload className="h-4 w-4" />
              <CardTitle className="text-sm font-medium">Files</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{securityStats.filesSecurity.virusDetected}</div>
            <div className="text-xs text-muted-foreground">Malware detected</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4" />
              <CardTitle className="text-sm font-medium">Business Logic</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{securityStats.businessLogic.activeLocks}</div>
            <div className="text-xs text-muted-foreground">Active locks</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-4 w-4" />
              <CardTitle className="text-sm font-medium">Encryption</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{securityStats.messageEncryption.encryptionFailures}</div>
            <div className="text-xs text-muted-foreground">Encryption failures</div>
          </CardContent>
        </Card>
      </div>

      {/* Security Alerts */}
      {securityAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5" />
              <span>Security Alerts</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {securityAlerts.map((alert) => (
                <div key={alert.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                  {getAlertIcon(alert.type)}
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{alert.category}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(alert.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm mt-1">{alert.message}</p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => resolveAlert(alert.id)}
                    disabled={refreshing}
                  >
                    Resolve
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Authentication Security</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span>Total Logins Today</span>
                  <span className="font-bold">{securityStats.authentication.totalLogins}</span>
                </div>
                <div className="flex justify-between">
                  <span>Failed Attempts</span>
                  <span className="font-bold text-red-600">{securityStats.authentication.failedAttempts}</span>
                </div>
                <div className="flex justify-between">
                  <span>Blocked Accounts</span>
                  <span className="font-bold">{securityStats.authentication.blockedAccounts}</span>
                </div>
                <div className="flex justify-between">
                  <span>Rate Limit Hits</span>
                  <span className="font-bold">{securityStats.authentication.rateLimitHits}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Content Moderation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span>Flagged Content</span>
                  <span className="font-bold text-yellow-600">{securityStats.contentModeration.flaggedContent}</span>
                </div>
                <div className="flex justify-between">
                  <span>Auto-Rejected</span>
                  <span className="font-bold text-red-600">{securityStats.contentModeration.autoRejected}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pending Review</span>
                  <span className="font-bold">{securityStats.contentModeration.pendingReview}</span>
                </div>
                <div className="flex justify-between">
                  <span>Banned Users</span>
                  <span className="font-bold">{securityStats.contentModeration.bannedUsers}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Real-time Security Monitoring</CardTitle>
              <CardDescription>Live monitoring of security events and threats</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>System Health Score</span>
                    <span className={getHealthColor(systemHealth)}>{systemHealth}%</span>
                  </div>
                  <Progress value={systemHealth} className="h-2" />
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Authentication Success Rate</span>
                    <span className="text-green-600">
                      {Math.round((securityStats.authentication.totalLogins / (securityStats.authentication.totalLogins + securityStats.authentication.failedAttempts)) * 100)}%
                    </span>
                  </div>
                  <Progress 
                    value={(securityStats.authentication.totalLogins / (securityStats.authentication.totalLogins + securityStats.authentication.failedAttempts)) * 100} 
                    className="h-2" 
                  />
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>File Security Score</span>
                    <span className="text-green-600">
                      {Math.round((securityStats.filesSecurity.cleanFiles / securityStats.filesSecurity.filesUploaded) * 100)}%
                    </span>
                  </div>
                  <Progress 
                    value={(securityStats.filesSecurity.cleanFiles / securityStats.filesSecurity.filesUploaded) * 100} 
                    className="h-2" 
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Maintenance</CardTitle>
              <CardDescription>Run maintenance tasks to keep security systems healthy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button 
                  onClick={() => runSecurityMaintenance('content')}
                  disabled={refreshing}
                  className="w-full"
                >
                  Content Cleanup
                </Button>
                <Button 
                  onClick={() => runSecurityMaintenance('business')}
                  disabled={refreshing}
                  className="w-full"
                >
                  Business Logic Cleanup
                </Button>
                <Button 
                  onClick={() => runSecurityMaintenance('files')}
                  disabled={refreshing}
                  className="w-full"
                >
                  File Security Cleanup
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Configuration</CardTitle>
              <CardDescription>Configure security thresholds and policies</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-2">
                <p>• Rate Limiting: 30 requests/minute (standard), 5 login attempts/15min</p>
                <p>• Content Moderation: 70% toxicity threshold, 80% spam threshold</p>
                <p>• File Security: Virus scanning enabled, 10MB max file size</p>
                <p>• Business Logic: 100 books/user max, 10 listings/day max</p>
                <p>• Encryption: AES-256-GCM for messages, key rotation every 30 days</p>
              </div>
              
              <Button variant="outline" className="w-full">
                Configure Security Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
