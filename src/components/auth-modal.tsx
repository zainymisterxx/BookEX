
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { signIn } from 'next-auth/react';
import { Loader2 } from 'lucide-react';
import { signUpUser, requestPasswordReset } from '@/app/actions';

export function AuthModal({ children, initialTab = "login" }: { children: React.ReactNode, initialTab?: "login" | "signup" }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <AuthTabs initialTab={initialTab} closeModal={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}


function AuthTabs({ initialTab, closeModal }: { initialTab: "login" | "signup", closeModal: () => void }) {
  const { toast } = useToast();
  const router = useRouter();
  const [currentView, setCurrentView] = useState<"login" | "signup" | "forgot">(initialTab);

  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  // Signup State
  const [signupFullName, setSignupFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [isSignupLoading, setIsSignupLoading] = useState(false);

  // Forgot Password State
  const [forgotEmail, setForgotEmail] = useState('');
  const [isForgotLoading, setIsForgotLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast({ variant: 'destructive', title: 'Missing fields' });
      return;
    }
    setIsLoginLoading(true);
    
    const result = await signIn('credentials', {
        redirect: false,
        email: loginEmail,
        password: loginPassword,
    });

    setIsLoginLoading(false);

    if (result?.error) {
        toast({ variant: 'destructive', title: 'Login failed', description: 'Invalid email or password.' });
    } else {
        toast({ title: 'Success!', description: 'You have successfully logged in.' });
        closeModal();
        router.refresh();
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupFullName || !signupEmail || !signupPassword || !signupConfirmPassword) {
      toast({ variant: 'destructive', title: 'Missing fields' });
      return;
    }
    if (signupPassword !== signupConfirmPassword) {
      toast({ variant: 'destructive', title: 'Passwords do not match' });
      return;
    }
    setIsSignupLoading(true);
    try {
        const result = await signUpUser({
            name: signupFullName,
            email: signupEmail,
            password: signupPassword,
        });

        if (!result.success) {
            toast({ variant: 'destructive', title: 'Signup failed', description: result.message });
            return;
        }

        // After successful sign-up, automatically log the user in
        const loginResult = await signIn('credentials', {
            redirect: false,
            email: signupEmail,
            password: signupPassword,
        });

        if (loginResult?.error) {
            throw new Error("Failed to login after signup.");
        }

        toast({ title: 'Account created!', description: "You've successfully signed up." });
        closeModal();
        // Redirect new users to profile settings to complete their city and profile
        router.push('/profile/settings');
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Signup failed', description: error.message || 'An unexpected error occurred.' });
    } finally {
        setIsSignupLoading(false);
        // Clear form on success or error
        setSignupFullName('');
        setSignupEmail('');
        setSignupPassword('');
        setSignupConfirmPassword('');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast({ variant: 'destructive', title: 'Please enter your email address' });
      return;
    }
    setIsForgotLoading(true);
    try {
      const result = await requestPasswordReset(forgotEmail);
      if (result.success) {
        toast({ title: 'Reset link sent!', description: result.message });
        setCurrentView('login');
        setForgotEmail('');
      } else {
        toast({ variant: 'destructive', title: 'Reset failed', description: result.message });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Reset failed', description: 'An unexpected error occurred.' });
    } finally {
      setIsForgotLoading(false);
    }
  };

  return (
    <Tabs value={currentView} onValueChange={(value) => setCurrentView(value as "login" | "signup" | "forgot")} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="login">Login</TabsTrigger>
        <TabsTrigger value="signup">Sign Up</TabsTrigger>
      </TabsList>
      <TabsContent value="login">
        <DialogHeader className="text-left mb-4">
          <DialogTitle className="text-2xl font-headline">Welcome Back</DialogTitle>
          <DialogDescription>Enter your email below to login to your account.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleLogin} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email-login">Email</Label>
            <Input 
              id="email-login" 
              type="email" 
              placeholder="m@example.com" 
              required 
              value={loginEmail} 
              onChange={(e) => setLoginEmail(e.target.value)} 
              disabled={isLoginLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleLogin(e as any);
                }
              }}
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password-login">Password</Label>
              <Button 
                type="button"
                variant="link" 
                className="px-0 font-normal" 
                onClick={(e) => {
                  e.preventDefault();
                  setCurrentView('forgot');
                }}
                tabIndex={-1}
              >
                Forgot password?
              </Button>
            </div>
            <PasswordInput 
              id="password-login" 
              required 
              value={loginPassword} 
              onChange={(e) => setLoginPassword(e.target.value)} 
              disabled={isLoginLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleLogin(e as any);
                }
              }}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoginLoading}>
            {isLoginLoading ? <Loader2 className="animate-spin" /> : 'Login'}
          </Button>
        </form>
      </TabsContent>
      <TabsContent value="signup">
        <DialogHeader className="text-left mb-4">
          <DialogTitle className="text-2xl font-headline">Create an Account</DialogTitle>
          <DialogDescription>Join our community of readers.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSignup} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="full-name">Full name</Label>
            <Input 
              id="full-name" 
              placeholder="Jane Doe" 
              required 
              value={signupFullName} 
              onChange={(e) => setSignupFullName(e.target.value)} 
              disabled={isSignupLoading} 
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email-signup">Email</Label>
            <Input 
              id="email-signup" 
              type="email" 
              placeholder="m@example.com" 
              required 
              value={signupEmail} 
              onChange={(e) => setSignupEmail(e.target.value)} 
              disabled={isSignupLoading} 
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password-signup">Password</Label>
            <PasswordInput 
              id="password-signup" 
              required 
              value={signupPassword} 
              onChange={(e) => setSignupPassword(e.target.value)} 
              disabled={isSignupLoading} 
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm-password-signup">Confirm Password</Label>
            <PasswordInput 
              id="confirm-password-signup" 
              required 
              value={signupConfirmPassword} 
              onChange={(e) => setSignupConfirmPassword(e.target.value)} 
              disabled={isSignupLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSignup(e as any);
                }
              }}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isSignupLoading}>
            {isSignupLoading ? <Loader2 className="animate-spin" /> : 'Create an account'}
          </Button>
        </form>
      </TabsContent>
      <TabsContent value="forgot">
        <DialogHeader className="text-left mb-4">
          <DialogTitle className="text-2xl font-headline">Reset Password</DialogTitle>
          <DialogDescription>Enter your email address and we'll send you a link to reset your password.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleForgotPassword} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email-forgot">Email</Label>
            <Input 
              id="email-forgot" 
              type="email" 
              placeholder="m@example.com" 
              required 
              value={forgotEmail} 
              onChange={(e) => setForgotEmail(e.target.value)} 
              disabled={isForgotLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleForgotPassword(e as any);
                }
              }}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isForgotLoading}>
            {isForgotLoading ? <Loader2 className="animate-spin" /> : 'Send Reset Link'}
          </Button>
          <Button 
            type="button"
            variant="link" 
            className="mt-2" 
            onClick={() => setCurrentView('login')}
          >
            Back to Login
          </Button>
        </form>
      </TabsContent>
    </Tabs>
  );
}
