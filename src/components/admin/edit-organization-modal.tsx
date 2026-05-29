"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, UploadCloud } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updateOrganizationProfile } from '@/app/actions';
import { uploadImageFile } from '@/lib/upload-client';
import Image from 'next/image';

interface EditOrganizationModalProps {
  children: React.ReactNode;
  organization: any;
  organizationId: string;
  onSuccess: () => void;
}

export function EditOrganizationModal({ 
  children, 
  organization, 
  organizationId,
  onSuccess 
}: EditOrganizationModalProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(organization.name);
  const [description, setDescription] = useState(organization.description);
  const [location, setLocation] = useState(organization.location);
  const [contactEmail, setContactEmail] = useState(organization.contactEmail || '');
  const [contactPhone, setContactPhone] = useState(organization.contactPhone || '');
  const [website, setWebsite] = useState(organization.website || '');
  const [logoImage, setLogoImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState(organization.imageUrl);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { toast } = useToast();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !description || !location) {
      toast({ variant: 'destructive', title: 'Missing fields', description: 'Please fill in required fields.' });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const updateData: any = {
        name,
        description,
        location,
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        website: website.trim() || undefined
      };

      // Only include imageUrl if a new image was selected
      if (logoImage) {
        updateData.imageUrl = (await uploadImageFile(logoImage, 'organizationImage', 'community', organizationId)).url;
      }

      const result = await updateOrganizationProfile(organizationId, updateData);
      
      if (!result.success) {
        throw new Error(result.message);
      }

      toast({
        title: 'Profile Updated!',
        description: `${name} has been successfully updated.`,
      });
      
      setOpen(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error updating organization:', error);
      toast({ 
        variant: 'destructive', 
        title: 'Update failed',
        description: error.message || 'Failed to update organization.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3 pb-6 border-b">
          <DialogTitle className="text-2xl font-headline">
            Edit Organization Profile
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            Update organization information and contact details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          {/* Logo Upload */}
          <div className="space-y-2">
            <Label htmlFor="logo" className="text-sm font-medium">
              Organization Logo
            </Label>
            <div className="flex items-center gap-4">
              {previewUrl && (
                <Image
                  src={previewUrl}
                  alt="Logo preview"
                  width={80}
                  height={80}
                  className="rounded-lg border object-cover"
                />
              )}
              <div className="flex-1">
                <label 
                  htmlFor="logo" 
                  className="flex items-center justify-center gap-2 px-4 py-8 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
                >
                  <UploadCloud className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {logoImage ? logoImage.name : 'Click to upload new logo (optional)'}
                  </span>
                </label>
                <input
                  id="logo"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* Basic Information */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Organization Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Books for All Foundation"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" className="text-sm font-medium">
                Location <span className="text-red-500">*</span>
              </Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Lahore, Pakistan"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your organization's mission and goals..."
              rows={4}
              required
            />
          </div>

          {/* Contact Information */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-medium mb-4">Contact Information</h3>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactEmail" className="text-sm font-medium">
                  Contact Email
                </Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="contact@organization.org"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactPhone" className="text-sm font-medium">
                  Contact Phone
                </Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+92 300 1234567"
                />
              </div>
            </div>

            <div className="space-y-2 mt-4">
              <Label htmlFor="website" className="text-sm font-medium">
                Website
              </Label>
              <Input
                id="website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://www.organization.org"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Organization'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
