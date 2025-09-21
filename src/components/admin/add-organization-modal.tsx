
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, UploadCloud, Building } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSession } from 'next-auth/react';
import { addOrganizationByAdmin } from '@/app/actions';
import { fileToDataUri } from '@/lib/utils';

export function AddOrganizationModal({ children, onOrganizationAdded }: { children: React.ReactNode, onOrganizationAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [logoImage, setLogoImage] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { data: session } = useSession();
  const { toast } = useToast();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setLogoImage(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) {
      toast({ variant: 'destructive', title: 'Authentication required.' });
      return;
    }
    if (!name || !description || !location || !logoImage) {
      toast({ variant: 'destructive', title: 'Missing fields', description: 'Please fill in all fields.' });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const imageUrl = await fileToDataUri(logoImage);
      const result = await addOrganizationByAdmin({ 
        name, 
        description, 
        location, 
        imageUrl,
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        website: website.trim() || undefined
      });
      
      if (!result.success) {
        throw new Error(result.message);
      }

      toast({
        title: 'Organization Added!',
        description: `${name} has been added and is now visible on the donate page.`,
      });
      // Reset form and close modal
      setName('');
      setDescription('');
      setLocation('');
      setContactEmail('');
      setContactPhone('');
      setWebsite('');
      setLogoImage(null);
      setOpen(false);
      onOrganizationAdded();

    } catch (error) {
      console.error('Error adding organization:', error);
      toast({ variant: 'destructive', title: 'Submission failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3 pb-6 border-b">
          <DialogTitle className="text-2xl font-headline flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building className="h-5 w-5 text-primary" />
            </div>
            Add New Organization
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground leading-relaxed">
            Fill in the details to add a new donation partner. They will be approved automatically and visible on the donate page.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-8 py-6">
          {/* Basic Information Section */}
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold font-headline text-foreground">Basic Information</h3>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="org-name" className="text-sm font-medium">Organization Name *</Label>
                  <Input 
                    id="org-name" 
                    placeholder="Enter organization name"
                    className="h-11"
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    disabled={isSubmitting}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-location" className="text-sm font-medium">Location (City) *</Label>
                  <Input 
                    id="org-location" 
                    placeholder="e.g., New York, NY"
                    className="h-11"
                    value={location} 
                    onChange={(e) => setLocation(e.target.value)} 
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-description" className="text-sm font-medium">Description *</Label>
                <Textarea 
                  id="org-description" 
                  placeholder="Describe the organization's mission and activities..."
                  className="min-h-[100px] resize-none"
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>
          </div>
          
          {/* Contact Information Section */}
          <div className="space-y-6 pt-6 border-t">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold font-headline text-foreground">Contact Information</h3>
              <p className="text-sm text-muted-foreground">Optional details for public display and communication</p>
              
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="org-email" className="text-sm font-medium">Contact Email</Label>
                  <Input 
                    id="org-email" 
                    type="email" 
                    placeholder="contact@organization.org"
                    className="h-11"
                    value={contactEmail} 
                    onChange={(e) => setContactEmail(e.target.value)} 
                    disabled={isSubmitting}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="org-phone" className="text-sm font-medium">Contact Phone</Label>
                  <Input 
                    id="org-phone" 
                    type="tel" 
                    placeholder="+1 (555) 123-4567"
                    className="h-11"
                    value={contactPhone} 
                    onChange={(e) => setContactPhone(e.target.value)} 
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="org-website" className="text-sm font-medium">Website</Label>
                <Input 
                  id="org-website" 
                  type="url" 
                  placeholder="https://www.organization.org"
                  className="h-11"
                  value={website} 
                  onChange={(e) => setWebsite(e.target.value)} 
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>
          
          {/* Logo Upload Section */}
          <div className="space-y-6 pt-6 border-t">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold font-headline text-foreground">Organization Logo *</h3>
              <p className="text-sm text-muted-foreground">Upload a high-quality logo that will be displayed on the donation page</p>
              
              <Label htmlFor="org-logo" className="cursor-pointer block">
                <div className={`
                  relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 
                  ${logoImage 
                    ? 'border-primary/50 bg-primary/5' 
                    : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5'
                  }
                  ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'}
                `}>
                  <div className="flex flex-col items-center space-y-4">
                    <div className={`
                      h-16 w-16 rounded-full flex items-center justify-center transition-colors
                      ${logoImage ? 'bg-primary/20' : 'bg-muted/50'}
                    `}>
                      <UploadCloud className={`h-8 w-8 ${logoImage ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-base font-medium">
                        {logoImage ? logoImage.name : 'Click to upload logo'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {logoImage 
                          ? `File selected: ${(logoImage.size / 1024 / 1024).toFixed(2)} MB`
                          : 'PNG, JPG, GIF up to 10MB'
                        }
                      </p>
                    </div>
                  </div>
                  <Input 
                    id="org-logo" 
                    type="file" 
                    className="sr-only" 
                    onChange={handleImageChange} 
                    accept="image/*" 
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </Label>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
              className="h-11 px-6"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !name || !description || !location || !logoImage}
              className="h-11 px-6 font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding Organization...
                </>
              ) : (
                <>
                  <Building className="mr-2 h-4 w-4" />
                  Add Organization
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
