'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { ProfileCompletionModal } from '@/components/profile-completion-modal';

interface ProfileCompletionContextType {
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  forceCloseModal: () => void;
}

const ProfileCompletionContext = createContext<ProfileCompletionContextType | undefined>(undefined);

export function ProfileCompletionProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [forceClosed, setForceClosed] = useState(false);

  useEffect(() => {
    // Check if user manually closed the modal before
    const manuallyDismissed = localStorage.getItem('profile-modal-dismissed');
    if (manuallyDismissed) {
      setForceClosed(true);
    }
  }, []);

  useEffect(() => {
    // Only check once the session is loaded and we haven't checked before
    if (status === 'loading' || hasChecked || forceClosed) return;

    const check = async () => {
      if (!session?.user) {
        setHasChecked(true);
        return;
      }

      // Call server action to compute completeness
      const { checkProfileCompletion } = await import('@/app/actions');
      const result = await checkProfileCompletion();
      if (result.isAuthenticated && !result.isProfileComplete) {
        const timer = setTimeout(() => {
          setIsModalOpen(true);
          setHasChecked(true);
        }, 1000);
        return () => clearTimeout(timer);
      }

      setHasChecked(true);
    };

    check();
  }, [session, status, hasChecked, forceClosed]);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => {
    setIsModalOpen(false);
    // Mark as manually dismissed
    localStorage.setItem('profile-modal-dismissed', 'true');
    setForceClosed(true);
  };
  const forceCloseModal = () => {
    setIsModalOpen(false);
    setForceClosed(true);
    // Clear the manual dismissal flag since profile was completed
    localStorage.removeItem('profile-modal-dismissed');
  };

  const contextValue: ProfileCompletionContextType = {
    isModalOpen,
    openModal,
    closeModal,
    forceCloseModal,
  };

  return (
    <ProfileCompletionContext.Provider value={contextValue}>
      {children}
      {session?.user && isModalOpen && !forceClosed && (
        <ProfileCompletionModal
          isOpen={isModalOpen}
          onClose={closeModal}
          onForceClose={forceCloseModal}
          user={{
            _id: session.user.id,
            name: session.user.name || '',
            email: session.user.email || '',
            avatarUrl: session.user.image || undefined,
          }}
        />
      )}
    </ProfileCompletionContext.Provider>
  );
}

export function useProfileCompletion() {
  const context = useContext(ProfileCompletionContext);
  if (context === undefined) {
    throw new Error('useProfileCompletion must be used within a ProfileCompletionProvider');
  }
  return context;
}
