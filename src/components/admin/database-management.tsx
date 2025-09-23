"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Database, CheckCircle, AlertCircle, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { optimizeDatabasePerformance, checkDatabaseHealth, createMissingDatabaseIndexes } from '@/app/actions';

interface DatabaseHealthData {
  healthy: boolean;
  missingIndexes: string[];
  totalChecked: number;
  message: string;
}

export function DatabaseManagement() {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isFixingIndexes, setIsFixingIndexes] = useState(false);
  const [healthData, setHealthData] = useState<DatabaseHealthData | null>(null);
  const { toast } = useToast();

  const handleFixMissingIndexes = async () => {
    setIsFixingIndexes(true);
    try {
      const result = await createMissingDatabaseIndexes();
      
      if (result.success) {
        toast({
          title: "Indexes Created!",
          description: result.data?.message || "Indexes created successfully",
        });
        // Refresh health check after fixing indexes
        await handleCheckHealth();
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Create missing indexes error:', error);
      toast({
        variant: 'destructive',
        title: "Index Creation Failed",
        description: "Failed to create missing indexes. Please try again.",
      });
    } finally {
      setIsFixingIndexes(false);
    }
  };

  const handleOptimizeDatabase = async () => {
    setIsOptimizing(true);
    try {
      const result = await optimizeDatabasePerformance();
      
      if (result.success) {
        toast({
          title: "Database Optimized!",
          description: result.data?.message || "Database optimized successfully",
        });
        // Refresh health check after optimization
        await handleCheckHealth();
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Database optimization error:', error);
      toast({
        variant: 'destructive',
        title: "Optimization Failed",
        description: "Failed to optimize database. Please try again.",
      });
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleCheckHealth = async () => {
    setIsChecking(true);
    try {
      const result = await checkDatabaseHealth();
      
      if (result.success && result.data) {
        setHealthData(result.data);
        toast({
          title: "Health Check Complete",
          description: result.data?.message || "Health check completed",
          variant: result.data?.healthy ? 'default' : 'destructive'
        });
      } else {
        throw new Error('Health check failed');
      }
    } catch (error) {
      console.error('Database health check error:', error);
      toast({
        variant: 'destructive',
        title: "Health Check Failed",
        description: "Failed to check database health. Please try again.",
      });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline text-2xl flex items-center gap-2">
          <Database className="h-6 w-6" />
          Database Performance
        </CardTitle>
        <CardDescription>
          Optimize database indexes and monitor performance health.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Health Status */}
        {healthData && (
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              {healthData.healthy ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-600" />
              )}
              <h3 className="font-semibold">Database Health Status</h3>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{healthData.message}</p>
              
              <div className="flex items-center gap-4">
                <Badge variant={healthData.healthy ? 'default' : 'secondary'}>
                  {healthData.healthy ? 'Healthy' : 'Needs Attention'}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {healthData.totalChecked} indexes checked
                </span>
              </div>
              
              {healthData.missingIndexes.length > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-destructive">
                      Missing Indexes ({healthData.missingIndexes.length}):
                    </p>
                    <Button 
                      size="sm" 
                      onClick={handleFixMissingIndexes}
                      disabled={isFixingIndexes || isOptimizing || isChecking}
                      className="ml-2"
                    >
                      {isFixingIndexes ? (
                        <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Creating...</>
                      ) : (
                        <>Fix Missing Indexes</>
                      )}
                    </Button>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {healthData.missingIndexes.map((index, i) => (
                      <li key={i} className="font-mono bg-muted px-2 py-1 rounded">
                        {index}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 flex-wrap">
          <Button 
            onClick={handleCheckHealth} 
            disabled={isChecking || isOptimizing || isFixingIndexes}
            variant="outline"
          >
            {isChecking ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking...</>
            ) : (
              <>Check Health</>
            )}
          </Button>
          
          {healthData && !healthData.healthy && (
            <Button 
              onClick={handleFixMissingIndexes}
              disabled={isFixingIndexes || isOptimizing || isChecking}
              variant="default"
            >
              {isFixingIndexes ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
              ) : (
                <><Zap className="mr-2 h-4 w-4" /> Fix Missing Indexes</>
              )}
            </Button>
          )}
          
          <Button 
            onClick={handleOptimizeDatabase} 
            disabled={isOptimizing || isChecking || isFixingIndexes}
            variant="secondary"
          >
            {isOptimizing ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Optimizing...</>
            ) : (
              <><Zap className="mr-2 h-4 w-4" /> Full Optimization</>
            )}
          </Button>
        </div>

        {/* Information */}
        <div className="bg-muted p-4 rounded-lg space-y-4">
          <div>
            <h4 className="font-medium mb-2">Database Index Management</h4>
            <div className="grid gap-3 text-sm text-muted-foreground">
              <div>
                <strong className="text-foreground">Check Health:</strong> Scans for missing critical indexes
              </div>
              <div>
                <strong className="text-foreground">Fix Missing Indexes:</strong> Creates only the missing indexes (fast & targeted)
              </div>
              <div>
                <strong className="text-foreground">Full Optimization:</strong> Creates all indexes and runs comprehensive optimization
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Critical Indexes:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <code>books_location_type_genre</code> - Faster book searches and filtering</li>
              <li>• <code>organizations_status_date</code> - Optimizes organization queries</li>
              <li>• <code>communities_members</code> - Improves community member lookups</li>
              <li>• <code>chats_participants</code> - Speeds up chat participant queries</li>
              <li>• <code>users_email_unique</code> - Ensures email uniqueness and fast login</li>
            </ul>
          </div>
          
          <p className="text-xs text-muted-foreground">
            <strong>Safe to run:</strong> All operations run in the background and won't affect live users.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
