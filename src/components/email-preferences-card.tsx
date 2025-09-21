"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Mail, Bell } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getUserEmailPreferences, updateEmailPreferences } from '@/app/actions';

interface EmailPreferences {
  exchangeProposals: boolean;
  exchangeUpdates: boolean;
  contactNotifications: boolean;
  weeklyDigest: boolean;
}

export function EmailPreferencesCard() {
  const [preferences, setPreferences] = useState<EmailPreferences>({
    exchangeProposals: true,
    exchangeUpdates: true,
    contactNotifications: true,
    weeklyDigest: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const prefs = await getUserEmailPreferences();
        setPreferences(prefs);
      } catch (error) {
        console.error('Error fetching email preferences:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreferences();
  }, []);

  const handlePreferenceChange = (key: keyof EmailPreferences, value: boolean) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await updateEmailPreferences(preferences);
      if (result.success) {
        toast({
          title: "Preferences Updated",
          description: "Your email notification preferences have been saved.",
        });
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to update preferences",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update email preferences",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading preferences...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Notifications
        </CardTitle>
        <CardDescription>
          Choose which email notifications you'd like to receive
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Exchange Notifications */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Exchange Notifications
          </h4>
          
          <div className="space-y-4 pl-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="exchange-proposals" className="text-base">
                  Exchange Proposals
                </Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when someone proposes a book exchange with you
                </p>
              </div>
              <Switch
                id="exchange-proposals"
                checked={preferences.exchangeProposals}
                onCheckedChange={(checked) => handlePreferenceChange('exchangeProposals', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="exchange-updates" className="text-base">
                  Exchange Status Updates
                </Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when your exchange status changes (accepted, completed, etc.)
                </p>
              </div>
              <Switch
                id="exchange-updates"
                checked={preferences.exchangeUpdates}
                onCheckedChange={(checked) => handlePreferenceChange('exchangeUpdates', checked)}
              />
            </div>
          </div>
        </div>

        {/* Book Notifications */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground">
            Book Notifications
          </h4>
          
          <div className="space-y-4 pl-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="contact-notifications" className="text-base">
                  Contact Notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when someone contacts you about your books
                </p>
              </div>
              <Switch
                id="contact-notifications"
                checked={preferences.contactNotifications}
                onCheckedChange={(checked) => handlePreferenceChange('contactNotifications', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="weekly-digest" className="text-base">
                  Weekly Digest
                </Label>
                <p className="text-sm text-muted-foreground">
                  Get a weekly summary of new books available in your area
                </p>
              </div>
              <Switch
                id="weekly-digest"
                checked={preferences.weeklyDigest}
                onCheckedChange={(checked) => handlePreferenceChange('weeklyDigest', checked)}
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Preferences'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
