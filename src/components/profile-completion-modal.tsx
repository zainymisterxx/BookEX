'use client';

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Upload, User, MapPin, Phone, Calendar, Heart } from "lucide-react";
import { completeUserProfile } from "@/app/actions";
import { toast } from "@/hooks/use-toast";

interface ProfileCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onForceClose: () => void;
  user: {
    _id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
}

export function ProfileCompletionModal({ isOpen, onClose, onForceClose, user }: ProfileCompletionModalProps) {
  const { update } = useSession();
  const [formData, setFormData] = useState({
    name: user.name || '',
    city: '',
    phone: '',
    bio: '',
    interests: '',
    avatarUrl: user.avatarUrl || '',
    birthDate: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.city.trim()) {
      toast({
        title: "City Required",
        description: "Please enter your city to continue. This is required for book exchanges.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await completeUserProfile({
        userId: user._id,
        profileData: {
          name: formData.name,
          city: formData.city,
          phone: formData.phone || undefined,
          bio: formData.bio || undefined,
          interests: formData.interests ? formData.interests.split(',').map(i => i.trim()) : undefined,
          avatarUrl: formData.avatarUrl || undefined,
          birthDate: formData.birthDate || undefined
        }
      });

      if (result.success) {
        toast({
          title: "Profile Completed! 🎉",
          description: "Welcome to BookEx! Your profile has been set up successfully.",
        });
        
        // Update the session to reflect the profile completion
        await update({ profileCompleted: true });
        
        onForceClose();
        
        // Small delay then refresh to ensure everything is updated
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to complete profile",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 1 && !formData.name.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter your full name to continue.",
        variant: "destructive"
      });
      return;
    }
    if (step === 2 && !formData.city.trim()) {
      toast({
        title: "City Required", 
        description: "Please enter your city. This is required for book exchanges.",
        variant: "destructive"
      });
      return;
    }
    setStep(prev => prev + 1);
  };

  const prevStep = () => setStep(prev => prev - 1);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Complete Your Profile
          </DialogTitle>
          <DialogDescription>
            Welcome to BookEx! Let's set up your profile to get started with book exchanges and community features.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Indicator */}
          <div className="flex items-center justify-center space-x-2">
            <Badge variant={step >= 1 ? "default" : "outline"} className="w-8 h-8 rounded-full p-0 flex items-center justify-center">
              1
            </Badge>
            <div className={`h-0.5 w-8 ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
            <Badge variant={step >= 2 ? "default" : "outline"} className="w-8 h-8 rounded-full p-0 flex items-center justify-center">
              2
            </Badge>
            <div className={`h-0.5 w-8 ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
            <Badge variant={step >= 3 ? "default" : "outline"} className="w-8 h-8 rounded-full p-0 flex items-center justify-center">
              3
            </Badge>
          </div>

          {/* Step 1: Basic Information */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basic Information</h3>
              
              <div className="flex items-center justify-center mb-6">
                <div className="relative">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={formData.avatarUrl} />
                    <AvatarFallback className="text-2xl">
                      {formData.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
                    onClick={() => {
                      const url = prompt("Enter image URL (optional):");
                      if (url !== null) handleInputChange('avatarUrl', url);
                    }}
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter your full name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="Enter your phone number (optional)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="birthDate">Birth Date</Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => handleInputChange('birthDate', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Step 2: Location (Required) */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Location Information
              </h3>
              <p className="text-sm text-muted-foreground">
                Your city is required for book exchanges and local community features.
              </p>
              
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  placeholder="Enter your city (required for exchanges)"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  This helps us connect you with nearby book exchanges and community events.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Preferences */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Heart className="h-5 w-5" />
                Your Preferences
              </h3>
              
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  placeholder="Tell us a bit about yourself and your reading interests..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="interests">Favorite Genres</Label>
                <Input
                  id="interests"
                  value={formData.interests}
                  onChange={(e) => handleInputChange('interests', e.target.value)}
                  placeholder="e.g., Fiction, Mystery, Science Fiction, Romance"
                />
                <p className="text-xs text-muted-foreground">
                  Separate multiple genres with commas. This helps us recommend books you'll love!
                </p>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={step === 1}
            >
              Previous
            </Button>
            
            {step < 3 ? (
              <Button onClick={nextStep}>
                Next
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? "Completing..." : "Complete Profile"}
              </Button>
            )}
          </div>

          {/* Skip Option */}
          <div className="text-center">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              Skip for now
            </Button>
          </div>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Step {step} of 3 • Fields marked with * are required
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
