
"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, User, AlertCircle } from 'lucide-react';
import type { User as UserType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { AuthModal } from '@/components/auth-modal';
import { EmailPreferencesCard } from '@/components/email-preferences-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSession } from 'next-auth/react';
import { getUserForUpdate, updateUserProfile, getCitiesByCountryAction, getPopularCitiesAction, searchCitiesAction, getAvailableCountriesAction, checkUsernameAvailability } from '@/app/actions';
import { validateUsername } from '@/lib/username-utils';
import pakistanCities from '@/lib/location/pakistan-cities';
import { uploadImageFile } from '@/lib/upload-client';

const DEFAULT_COUNTRY = "Pakistan";

export default function SettingsPage() {
  const { data: session, status, update: updateSession } = useSession();
  const user = session?.user;

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [city, setCity] = useState('');
  const [isProfileIncomplete, setIsProfileIncomplete] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [availableCities, setAvailableCities] = useState<string[]>([]);

  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load available cities
    const loadCities = async () => {
      try {
        const citiesData = await getCitiesByCountryAction(DEFAULT_COUNTRY);
        const cities = (citiesData.length > 0 ? citiesData : pakistanCities).map(city => city.name);
        setAvailableCities(Array.from(new Set(cities)));
      } catch (error) {
        console.error('Error loading cities for profile settings:', error);
        setAvailableCities(pakistanCities.map(city => city.name));
      }
    };
    loadCities();

    const fetchUserData = async () => {
      if (user?.id) {
        setIsLoading(true);
        const userData = await getUserForUpdate(user.id);
        if (userData.success && userData.data) {
          setName(userData.data.name || '');
          setUsername(userData.data.username || '');
          setCity(userData.data.cityName || userData.data.cityNormalized || '');
          setAvatarPreview(userData.data.avatarUrl || null);
          if (!userData.data.cityNormalized) {
            setIsProfileIncomplete(true);
          }
        }
        setIsLoading(false);
      } else if (status !== 'loading') {
        setIsLoading(false);
      }
    };
    fetchUserData();
  }, [user, status]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const result = await updateUserProfile({
        userId: user.id,
        name,
        username,
        city,
        avatarUrl: '',
      });
      if (!result.success) throw new Error(result.message);
      setAvatarPreview(null);
      setAvatarFile(null);
      await updateSession({ image: null });
      toast({ title: 'Profile picture removed.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not remove picture.', description: 'Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Debounced username validation
  const checkUsernameDebounced = useCallback(
    debounce(async (newUsername: string) => {
      if (!newUsername || newUsername === user?.username) {
        setUsernameError(null);
        setIsCheckingUsername(false);
        return;
      }

      const validation = validateUsername(newUsername);
      if (!validation.valid) {
        setUsernameError(validation.error || 'Invalid username');
        setIsCheckingUsername(false);
        return;
      }

      try {
        const result = await checkUsernameAvailability(newUsername);
        if (result.success && result.data) {
          if (!result.data.available) {
            setUsernameError(result.data.error || 'Username is already taken');
          } else {
            setUsernameError(null);
          }
        } else {
          setUsernameError('Error checking username availability');
        }
      } catch (error) {
        console.error('Error checking username:', error);
        setUsernameError('Error checking username availability');
      } finally {
        setIsCheckingUsername(false);
      }
    }, 500),
    [user?.username]
  );

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUsername = e.target.value;
    setUsername(newUsername);
    setIsCheckingUsername(true);
    checkUsernameDebounced(newUsername);
  };

  // Simple debounce function
  function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
    let timeout: NodeJS.Timeout;
    return ((...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    }) as T;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    try {
      let newAvatarUrl: string | undefined = undefined;

      if (avatarFile) {
        try {
          newAvatarUrl = (await uploadImageFile(avatarFile, 'userAvatar', 'user', user.id)).url;
        } catch (uploadErr) {
          toast({ variant: 'destructive', title: 'Image upload failed', description: uploadErr instanceof Error ? uploadErr.message : 'Could not upload profile picture. Please try again.' });
          setIsSaving(false);
          return;
        }
      }
      
      // Validate username before saving
      if (username && username !== user.username) {
        const validation = validateUsername(username);
        if (!validation.valid) {
          throw new Error(validation.error || 'Invalid username');
        }
        
        const availability = await checkUsernameAvailability(username);
        if (availability.success && availability.data) {
          if (!availability.data.available) {
            throw new Error(availability.data.error || 'Username is already taken');
          }
        } else {
          throw new Error('Error checking username availability');
        }
      }

      const result = await updateUserProfile({
        userId: user.id,
        name: name,
        username: username,
        city: city,
        avatarUrl: newAvatarUrl,
      });
      
      if (!result.success) {
          throw new Error(result.message);
      }
      if (!result.data?.updatedUser) {
          throw new Error("Failed to update profile");
      }

      // This updates the session object from next-auth with the new data
      await updateSession({
          name: result.data.updatedUser.name,
          username: result.data.updatedUser.username,
          image: result.data.updatedUser.image,
      });

      toast({
        title: "Profile updated!",
        description: "Your changes have been saved successfully.",
      });
      router.push('/profile/me');
      router.refresh(); // To reflect header changes

    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        variant: 'destructive',
        title: "Update failed",
        description: "Could not save your changes. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || status === 'loading') {
    return (
      <div className="container py-12 md:py-16 flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="bg-secondary">
        <div className="container py-12 md:py-16 text-center min-h-[60vh] flex flex-col justify-center items-center">
            <h2 className="text-2xl font-bold font-headline">Please log in</h2>
            <p className="text-muted-foreground mt-2 mb-6">You need to be logged in to edit your profile.</p>
            <AuthModal>
              <Button size="lg">Login</Button>
            </AuthModal>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-secondary">
      <div className="container py-12 md:py-16">
        <Card className="max-w-2xl mx-auto border-2 shadow-xl shadow-primary/10">
          <CardHeader>
            <CardTitle className="text-3xl font-bold font-headline text-primary">Profile Settings</CardTitle>
            <CardDescription className="text-lg">Manage your account information and preferences.</CardDescription>
          </CardHeader>
          <CardContent>
            {isProfileIncomplete && (
                <Alert className="mb-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Complete Your Profile</AlertTitle>
                    <AlertDescription>
                        Please set your city to start listing books for sale or exchange. This helps connect you with local buyers and traders.
                    </AlertDescription>
                </Alert>
            )}
            <form onSubmit={handleSave} className="space-y-8">
              <div className="space-y-4">
                <Label>Profile Picture</Label>
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20 border-2">
                    <AvatarImage src={avatarPreview || undefined} />
                    <AvatarFallback><User className="h-8 w-8"/></AvatarFallback>
                  </Avatar>
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                    Change Picture
                  </Button>
                  {avatarPreview && (
                    <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={handleRemoveAvatar} disabled={isSaving}>
                      Remove
                    </Button>
                  )}
                  <Input 
                    type="file" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleAvatarChange}
                    accept="image/png, image/jpeg"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input 
                  id="name" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input 
                  id="username" 
                  value={username}
                  onChange={handleUsernameChange}
                  disabled={isSaving}
                  placeholder="e.g. john_doe"
                  className={usernameError ? 'border-red-500' : ''}
                />
                {isCheckingUsername && (
                  <p className="text-sm text-muted-foreground flex items-center">
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Checking availability...
                  </p>
                )}
                {usernameError && (
                  <p className="text-sm text-red-500">{usernameError}</p>
                )}
                {username && !usernameError && !isCheckingUsername && (
                  <p className="text-sm text-green-600">✓ Username available</p>
                )}
                <p className="text-sm text-muted-foreground">
                  3-24 characters, lowercase letters, numbers, and underscores only
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                  <select
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    disabled={isSaving}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="" disabled>Select your city</option>
                    {availableCities.map((cityName) => (
                      <option key={cityName} value={cityName}>{cityName}</option>
                    ))}
                  </select>
                <p className="text-sm text-muted-foreground">
                  Your city is used to find local book exchanges.
                </p>
              </div>
              <div className="flex justify-end pt-4">
                <Button 
                  type="submit" 
                  size="lg" 
                  disabled={isSaving || !!usernameError || isCheckingUsername}
                >
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Email Preferences Card */}
        <EmailPreferencesCard />
      </div>
    </div>
  );
}
