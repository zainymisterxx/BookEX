/**
 * Enhanced loading wrapper component with suspense boundaries
 * and error handling for better UX
 */

'use client'

import { Suspense, Component } from 'react'
import { LoadingSpinner, PageSkeleton } from '@/components/ui/loading'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ErrorFallbackProps {
  error: Error
  resetErrorBoundary: () => void
}

function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p className="text-muted-foreground max-w-md">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
      </div>
      <Button onClick={resetErrorBoundary} variant="outline">
        <RefreshCw className="h-4 w-4 mr-2" />
        Try again
      </Button>
    </div>
  )
}

// Simple error boundary implementation
class ErrorBoundary extends Component<
  {
    children: React.ReactNode
    fallback?: React.ComponentType<ErrorFallbackProps>
  },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback || ErrorFallback
      return (
        <FallbackComponent 
          error={this.state.error}
          resetErrorBoundary={() => this.setState({ hasError: false, error: undefined })}
        />
      )
    }

    return this.props.children
  }
}

interface LoadingWrapperProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  errorFallback?: React.ComponentType<ErrorFallbackProps>
  showPageSkeleton?: boolean
}

export function LoadingWrapper({ 
  children, 
  fallback,
  errorFallback: CustomErrorFallback,
  showPageSkeleton = false
}: LoadingWrapperProps) {
  const FallbackComponent = fallback || (showPageSkeleton ? <PageSkeleton /> : (
    <div className="flex items-center justify-center min-h-[200px]">
      <LoadingSpinner size="lg" />
    </div>
  ))

  return (
    <ErrorBoundary fallback={CustomErrorFallback}>
      <Suspense fallback={FallbackComponent}>
        {children}
      </Suspense>
    </ErrorBoundary>
  )
}

// Specific loading wrappers for different page types
export function BookListingWrapper({ children }: { children: React.ReactNode }) {
  const CustomErrorFallback = ({ error, resetErrorBoundary }: ErrorFallbackProps) => (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-xl font-semibold">Failed to load books</h2>
        <p className="text-muted-foreground">
          Unable to fetch book listings. Please check your connection and try again.
        </p>
        <Button onClick={resetErrorBoundary}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Reload books
        </Button>
      </div>
    </div>
  )

  return (
    <LoadingWrapper
      fallback={<PageSkeleton />}
      errorFallback={CustomErrorFallback}
    >
      {children}
    </LoadingWrapper>
  )
}

export function CommunityWrapper({ children }: { children: React.ReactNode }) {
  const CustomErrorFallback = ({ error, resetErrorBoundary }: ErrorFallbackProps) => (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-xl font-semibold">Community unavailable</h2>
        <p className="text-muted-foreground">
          Unable to load community content. Please try again later.
        </p>
        <Button onClick={resetErrorBoundary}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Reload community
        </Button>
      </div>
    </div>
  )

  return (
    <LoadingWrapper
      fallback={<PageSkeleton />}
      errorFallback={CustomErrorFallback}
    >
      {children}
    </LoadingWrapper>
  )
}

export function ProfileWrapper({ children }: { children: React.ReactNode }) {
  const CustomErrorFallback = ({ error, resetErrorBoundary }: ErrorFallbackProps) => (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-xl font-semibold">Profile not found</h2>
        <p className="text-muted-foreground">
          Unable to load profile information. The user may not exist or there was a connection error.
        </p>
        <Button onClick={resetErrorBoundary}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Try again
        </Button>
      </div>
    </div>
  )

  return (
    <LoadingWrapper
      fallback={<PageSkeleton />}
      errorFallback={CustomErrorFallback}
    >
      {children}
    </LoadingWrapper>
  )
}

// Inline loading states for buttons and small components
export function InlineLoading({ 
  isLoading, 
  children, 
  size = "sm" 
}: { 
  isLoading: boolean
  children: React.ReactNode
  size?: "sm" | "default" | "lg"
}) {
  if (isLoading) {
    return <LoadingSpinner size={size} />
  }
  return <>{children}</>
}

// Progressive loading for image galleries
export function ProgressiveImageLoading({
  src,
  alt,
  className,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <div className="relative">
      <img
        src={src}
        alt={alt}
        className={className}
        loading="lazy"
        {...props}
        onLoad={(e) => {
          const target = e.target as HTMLImageElement
          target.style.opacity = '1'
        }}
        style={{
          opacity: 0,
          transition: 'opacity 0.3s ease-in-out',
          ...props.style
        }}
      />
    </div>
  )
}
