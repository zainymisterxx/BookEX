/**
 * Enhanced form components with validation integration
 * Provides accessible, real-time validation feedback
 */

'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { getFieldValidationStatus } from '@/hooks/use-form-validation'

// Base field props interface
interface BaseFieldProps {
  label: string
  error?: string
  touched?: boolean
  required?: boolean
  description?: string
  className?: string
  'aria-describedby'?: string
  'aria-invalid'?: string
}

// Validation status indicator
function ValidationIndicator({ 
  status, 
  isValidating = false 
}: { 
  status: 'idle' | 'valid' | 'invalid'
  isValidating?: boolean 
}) {
  if (isValidating) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
  }

  switch (status) {
    case 'valid':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case 'invalid':
      return <AlertCircle className="h-4 w-4 text-destructive" />
    default:
      return null
  }
}

// Enhanced input component
interface ValidatedInputProps extends BaseFieldProps {
  type?: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  isValidating?: boolean
  autoComplete?: string
  disabled?: boolean
}

export function ValidatedInput({
  label,
  error,
  touched = false,
  required = false,
  description,
  className,
  type = 'text',
  placeholder,
  value,
  onChange,
  onBlur,
  isValidating = false,
  disabled = false,
  autoComplete,
  ...props
}: ValidatedInputProps) {
  const [focused, setFocused] = useState(false)
  const status = getFieldValidationStatus(value, error, touched)
  const fieldId = `field-${Math.random().toString(36).substr(2, 9)}`
  const errorId = `${fieldId}-error`
  const descriptionId = `${fieldId}-description`

  // Filter out aria-invalid from props to avoid type conflicts
  const { 'aria-invalid': _, ...inputProps } = props as any

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <Label 
          htmlFor={fieldId}
          className={cn(
            'text-sm font-medium',
            required && "after:content-['*'] after:ml-0.5 after:text-destructive"
          )}
        >
          {label}
        </Label>
        <ValidationIndicator status={status} isValidating={isValidating} />
      </div>
      
      {description && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}
      
      <div className="relative">
        <Input
          id={fieldId}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            setFocused(false)
            onBlur?.()
          }}
          onFocus={() => setFocused(true)}
          disabled={disabled}
          autoComplete={autoComplete}
          className={cn(
            'transition-colors',
            status === 'invalid' && 'border-destructive focus-visible:ring-destructive',
            status === 'valid' && 'border-green-500 focus-visible:ring-green-500',
            focused && 'ring-2'
          )}
          aria-describedby={cn(
            description && descriptionId,
            error && errorId
          )}
          {...inputProps}
        />
      </div>
      
      {error && touched && (
        <p 
          id={errorId}
          className="text-sm text-destructive flex items-center gap-1"
          role="alert"
          aria-live="polite"
        >
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  )
}

// Enhanced textarea component
interface ValidatedTextareaProps extends BaseFieldProps {
  placeholder?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  rows?: number
  maxLength?: number
  isValidating?: boolean
  disabled?: boolean
}

export function ValidatedTextarea({
  label,
  error,
  touched = false,
  required = false,
  description,
  className,
  placeholder,
  value,
  onChange,
  onBlur,
  rows = 4,
  maxLength,
  isValidating = false,
  disabled = false,
  ...props
}: ValidatedTextareaProps) {
  const [focused, setFocused] = useState(false)
  const status = getFieldValidationStatus(value, error, touched)
  const fieldId = `field-${Math.random().toString(36).substr(2, 9)}`
  const errorId = `${fieldId}-error`
  const descriptionId = `${fieldId}-description`

  // Filter out aria-invalid from props to avoid type conflicts
  const { 'aria-invalid': _, ...textareaProps } = props as any
  const characterCount = value?.length || 0

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <Label 
          htmlFor={fieldId}
          className={cn(
            'text-sm font-medium',
            required && "after:content-['*'] after:ml-0.5 after:text-destructive"
          )}
        >
          {label}
        </Label>
        <div className="flex items-center gap-2">
          {maxLength && (
            <span className={cn(
              'text-xs text-muted-foreground',
              characterCount > maxLength && 'text-destructive'
            )}>
              {characterCount}/{maxLength}
            </span>
          )}
          <ValidationIndicator status={status} isValidating={isValidating} />
        </div>
      </div>
      
      {description && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}
      
      <div className="relative">
        <Textarea
          id={fieldId}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            setFocused(false)
            onBlur?.()
          }}
          onFocus={() => setFocused(true)}
          disabled={disabled}
          rows={rows}
          maxLength={maxLength}
          className={cn(
            'transition-colors resize-none',
            status === 'invalid' && 'border-destructive focus-visible:ring-destructive',
            status === 'valid' && 'border-green-500 focus-visible:ring-green-500',
            focused && 'ring-2'
          )}
          aria-describedby={cn(
            description && descriptionId,
            error && errorId
          )}
          {...textareaProps}
        />
      </div>
      
      {error && touched && (
        <p 
          id={errorId}
          className="text-sm text-destructive flex items-center gap-1"
          role="alert"
          aria-live="polite"
        >
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  )
}

// Enhanced select component
interface ValidatedSelectProps extends BaseFieldProps {
  placeholder?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  options: Array<{ value: string; label: string; disabled?: boolean }>
  disabled?: boolean
}

export function ValidatedSelect({
  label,
  error,
  touched = false,
  required = false,
  description,
  className,
  placeholder = 'Select an option...',
  value,
  onChange,
  onBlur,
  options,
  disabled = false,
  ...props
}: ValidatedSelectProps) {
  const status = getFieldValidationStatus(value, error, touched)
  const fieldId = `field-${Math.random().toString(36).substr(2, 9)}`
  const errorId = `${fieldId}-error`
  const descriptionId = `${fieldId}-description`

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <Label 
          htmlFor={fieldId}
          className={cn(
            'text-sm font-medium',
            required && "after:content-['*'] after:ml-0.5 after:text-destructive"
          )}
        >
          {label}
        </Label>
        <ValidationIndicator status={status} />
      </div>
      
      {description && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}
      
      <Select
        value={value}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger
          id={fieldId}
          className={cn(
            'transition-colors',
            status === 'invalid' && 'border-destructive focus:ring-destructive',
            status === 'valid' && 'border-green-500 focus:ring-green-500'
          )}
          onBlur={onBlur}
          aria-describedby={cn(
            description && descriptionId,
            error && errorId
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem 
              key={option.value} 
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {error && touched && (
        <p 
          id={errorId}
          className="text-sm text-destructive flex items-center gap-1"
          role="alert"
          aria-live="polite"
        >
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  )
}

// File input component with validation
interface ValidatedFileInputProps extends BaseFieldProps {
  accept?: string
  onChange: (file: File | null) => void
  onBlur?: () => void
  maxSize?: number // in bytes
  disabled?: boolean
  preview?: string
}

export function ValidatedFileInput({
  label,
  error,
  touched = false,
  required = false,
  description,
  className,
  accept,
  onChange,
  onBlur,
  maxSize,
  disabled = false,
  preview,
  ...props
}: ValidatedFileInputProps) {
  const [dragOver, setDragOver] = useState(false)
  const status = getFieldValidationStatus(preview, error, touched)
  const fieldId = `field-${Math.random().toString(36).substr(2, 9)}`
  const errorId = `${fieldId}-error`
  const descriptionId = `${fieldId}-description`

  // Filter out aria-invalid from props to avoid type conflicts
  const { 'aria-invalid': _, ...inputProps } = props as any

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    
    if (file && maxSize && file.size > maxSize) {
      // This would trigger validation error
      onChange(file)
      return
    }
    
    onChange(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    
    const file = e.dataTransfer.files?.[0] || null
    if (file && accept && !file.type.match(accept)) {
      return
    }
    
    onChange(file)
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <Label 
          htmlFor={fieldId}
          className={cn(
            'text-sm font-medium',
            required && "after:content-['*'] after:ml-0.5 after:text-destructive"
          )}
        >
          {label}
        </Label>
        <ValidationIndicator status={status} />
      </div>
      
      {description && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}
      
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer',
          dragOver && 'border-primary bg-primary/5',
          status === 'invalid' && 'border-destructive',
          status === 'valid' && 'border-green-500',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          id={fieldId}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          onBlur={onBlur}
          disabled={disabled}
          className="hidden"
          aria-describedby={cn(
            description && descriptionId,
            error && errorId
          )}
          {...inputProps}
        />
        <label htmlFor={fieldId} className="cursor-pointer">
          {preview ? (
            <div className="space-y-2">
              <img src={preview} alt="Preview" className="mx-auto h-32 w-32 object-cover rounded" />
              <p className="text-sm text-muted-foreground">Click to change image</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-muted-foreground">
                <p>Click to upload or drag and drop</p>
                {maxSize && (
                  <p className="text-xs">Max size: {(maxSize / 1024 / 1024).toFixed(1)}MB</p>
                )}
              </div>
            </div>
          )}
        </label>
      </div>
      
      {error && touched && (
        <p 
          id={errorId}
          className="text-sm text-destructive flex items-center gap-1"
          role="alert"
          aria-live="polite"
        >
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  )
}
