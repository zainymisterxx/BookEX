/**
 * Global loading state management hook
 * Provides optimistic UI updates and loading states
 */

import { useState, useCallback, useRef } from 'react'
import { useToast } from '@/hooks/use-toast'

type LoadingState = {
  [key: string]: boolean
}

type OptimisticUpdate<T> = {
  action: () => Promise<T>
  optimisticUpdate?: () => void
  rollback?: () => void
  successMessage?: string
  errorMessage?: string
}

export function useOptimisticLoading() {
  const [loadingStates, setLoadingStates] = useState<LoadingState>({})
  const { toast } = useToast()
  const rollbackFunctions = useRef<Map<string, () => void>>(new Map())

  const setLoading = useCallback((key: string, isLoading: boolean) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: isLoading
    }))
  }, [])

  const isLoading = useCallback((key: string) => {
    return loadingStates[key] || false
  }, [loadingStates])

  const isAnyLoading = useCallback(() => {
    return Object.values(loadingStates).some(loading => loading)
  }, [loadingStates])

  const executeWithOptimisticUpdate = useCallback(async <T>(
    key: string,
    { action, optimisticUpdate, rollback, successMessage, errorMessage }: OptimisticUpdate<T>
  ): Promise<T | null> => {
    try {
      setLoading(key, true)
      
      // Apply optimistic update immediately
      if (optimisticUpdate) {
        optimisticUpdate()
        if (rollback) {
          rollbackFunctions.current.set(key, rollback)
        }
      }

      // Execute the actual action
      const result = await action()

      // Clear rollback function on success
      rollbackFunctions.current.delete(key)

      if (successMessage) {
        toast({
          title: 'Success',
          description: successMessage,
        })
      }

      return result
    } catch (error) {
      // Rollback optimistic update on error
      const rollbackFn = rollbackFunctions.current.get(key)
      if (rollbackFn) {
        rollbackFn()
        rollbackFunctions.current.delete(key)
      }

      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage || 'Something went wrong. Please try again.',
      })

      console.error(`Error in ${key}:`, error)
      return null
    } finally {
      setLoading(key, false)
    }
  }, [setLoading, toast])

  return {
    setLoading,
    isLoading,
    isAnyLoading,
    executeWithOptimisticUpdate,
    loadingStates
  }
}

// Specific hooks for common operations
export function useBookListingLoading() {
  const { setLoading, isLoading, executeWithOptimisticUpdate } = useOptimisticLoading()

  const createListing = useCallback(async (
    listingData: any,
    onOptimisticAdd?: (tempListing: any) => void,
    onRollback?: () => void
  ) => {
    return executeWithOptimisticUpdate('createListing', {
      action: () => {
        // This would be replaced with actual API call
        return new Promise(resolve => setTimeout(resolve, 1000))
      },
      optimisticUpdate: onOptimisticAdd ? () => onOptimisticAdd({
        ...listingData,
        _id: 'temp-' + Date.now(),
        createdAt: new Date().toISOString()
      }) : undefined,
      rollback: onRollback,
      successMessage: 'Book listed successfully!',
      errorMessage: 'Failed to list book. Please try again.'
    })
  }, [executeWithOptimisticUpdate])

  return {
    createListing,
    isCreatingListing: isLoading('createListing')
  }
}

export function useWishlistLoading() {
  const { setLoading, isLoading, executeWithOptimisticUpdate } = useOptimisticLoading()

  const toggleWishlist = useCallback(async (
    bookId: string,
    isCurrentlyWishlisted: boolean,
    onOptimisticToggle?: () => void,
    onRollback?: () => void
  ) => {
    return executeWithOptimisticUpdate('toggleWishlist', {
      action: () => {
        // This would be replaced with actual API call
        return new Promise(resolve => setTimeout(resolve, 500))
      },
      optimisticUpdate: onOptimisticToggle,
      rollback: onRollback,
      successMessage: isCurrentlyWishlisted ? 'Removed from wishlist' : 'Added to wishlist',
      errorMessage: 'Failed to update wishlist. Please try again.'
    })
  }, [executeWithOptimisticUpdate])

  return {
    toggleWishlist,
    isTogglingWishlist: isLoading('toggleWishlist')
  }
}

export function useCommunityLoading() {
  const { setLoading, isLoading, executeWithOptimisticUpdate } = useOptimisticLoading()

  const joinCommunity = useCallback(async (
    communityId: string,
    isCurrentlyMember: boolean,
    onOptimisticToggle?: () => void,
    onRollback?: () => void
  ) => {
    return executeWithOptimisticUpdate('joinCommunity', {
      action: () => {
        // This would be replaced with actual API call
        return new Promise(resolve => setTimeout(resolve, 800))
      },
      optimisticUpdate: onOptimisticToggle,
      rollback: onRollback,
      successMessage: isCurrentlyMember ? 'Left community' : 'Joined community',
      errorMessage: 'Failed to update membership. Please try again.'
    })
  }, [executeWithOptimisticUpdate])

  const createPost = useCallback(async (
    postData: any,
    onOptimisticAdd?: (tempPost: any) => void,
    onRollback?: () => void
  ) => {
    return executeWithOptimisticUpdate('createPost', {
      action: () => {
        // This would be replaced with actual API call
        return new Promise(resolve => setTimeout(resolve, 1000))
      },
      optimisticUpdate: onOptimisticAdd ? () => onOptimisticAdd({
        ...postData,
        _id: 'temp-' + Date.now(),
        likes: 0,
        likedBy: [],
        comments: [],
        createdAt: new Date().toISOString()
      }) : undefined,
      rollback: onRollback,
      successMessage: 'Post created successfully!',
      errorMessage: 'Failed to create post. Please try again.'
    })
  }, [executeWithOptimisticUpdate])

  const likePost = useCallback(async (
    postId: string,
    isCurrentlyLiked: boolean,
    onOptimisticToggle?: () => void,
    onRollback?: () => void
  ) => {
    return executeWithOptimisticUpdate('likePost', {
      action: () => {
        // This would be replaced with actual API call
        return new Promise(resolve => setTimeout(resolve, 300))
      },
      optimisticUpdate: onOptimisticToggle,
      rollback: onRollback,
      // No success message for likes (too frequent)
      errorMessage: 'Failed to update like. Please try again.'
    })
  }, [executeWithOptimisticUpdate])

  return {
    joinCommunity,
    createPost,
    likePost,
    isJoiningCommunity: isLoading('joinCommunity'),
    isCreatingPost: isLoading('createPost'),
    isLikingPost: isLoading('likePost')
  }
}

// Form loading hook
export function useFormLoading() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const { toast } = useToast()

  const submitForm = useCallback(async <T>(
    action: () => Promise<T>,
    {
      onSuccess,
      onError,
      successMessage,
      errorMessage
    }: {
      onSuccess?: (result: T) => void
      onError?: (error: any) => void
      successMessage?: string
      errorMessage?: string
    } = {}
  ) => {
    try {
      setIsSubmitting(true)
      setFieldErrors({})
      
      const result = await action()
      
      if (onSuccess) {
        onSuccess(result)
      }
      
      if (successMessage) {
        toast({
          title: 'Success',
          description: successMessage,
        })
      }
      
      return result
    } catch (error: any) {
      if (onError) {
        onError(error)
      }
      
      // Handle validation errors
      if (error.fieldErrors) {
        setFieldErrors(error.fieldErrors)
      }
      
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage || error.message || 'Please check your input and try again.',
      })
      
      throw error
    } finally {
      setIsSubmitting(false)
    }
  }, [toast])

  const clearFieldError = useCallback((field: string) => {
    setFieldErrors(prev => {
      const { [field]: _, ...rest } = prev
      return rest
    })
  }, [])

  return {
    isSubmitting,
    fieldErrors,
    submitForm,
    clearFieldError,
    setFieldErrors
  }
}
