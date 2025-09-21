/**
 * Advanced form validation system with real-time feedback
 * and accessible validation patterns
 */

import { useState, useCallback, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'

// Validation rule types
export type ValidationRule = {
  required?: boolean | string
  minLength?: { value: number; message: string }
  maxLength?: { value: number; message: string }
  pattern?: { value: RegExp; message: string }
  min?: { value: number; message: string }
  max?: { value: number; message: string }
  custom?: (value: any) => string | undefined
}

export type ValidationRules = Record<string, ValidationRule>

export type FormErrors = Record<string, string>

export type FormTouched = Record<string, boolean>

// Built-in validation rules
export const validationRules = {
  email: {
    pattern: {
      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
      message: 'Please enter a valid email address'
    }
  },
  password: {
    minLength: { value: 8, message: 'Password must be at least 8 characters' },
    pattern: {
      value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    }
  },
  confirmPassword: (originalPassword: string) => ({
    custom: (value: string) => {
      if (value !== originalPassword) {
        return 'Passwords do not match'
      }
      return undefined
    }
  }),
  phone: {
    pattern: {
      value: /^[\+]?[1-9][\d]{0,15}$/,
      message: 'Please enter a valid phone number'
    }
  },
  url: {
    pattern: {
      value: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
      message: 'Please enter a valid URL'
    }
  },
  bookTitle: {
    required: 'Book title is required',
    minLength: { value: 2, message: 'Title must be at least 2 characters' },
    maxLength: { value: 100, message: 'Title must not exceed 100 characters' }
  },
  bookAuthor: {
    required: 'Author name is required',
    minLength: { value: 2, message: 'Author name must be at least 2 characters' },
    maxLength: { value: 50, message: 'Author name must not exceed 50 characters' }
  },
  bookPrice: {
    min: { value: 0, message: 'Price cannot be negative' },
    max: { value: 10000, message: 'Price seems unreasonably high' },
    custom: (value: string) => {
      if (value && !/^\d+(\.\d{1,2})?$/.test(value)) {
        return 'Please enter a valid price (e.g., 29.99)'
      }
      return undefined
    }
  },
  bookDescription: {
    required: 'Description is required',
    minLength: { value: 10, message: 'Description must be at least 10 characters' },
    maxLength: { value: 1000, message: 'Description must not exceed 1000 characters' }
  }
}

// Validation function
export function validateField(value: any, rule: ValidationRule): string | undefined {
  // Required validation
  if (rule.required) {
    if (value === undefined || value === null || value === '') {
      return typeof rule.required === 'string' ? rule.required : 'This field is required'
    }
  }

  // Skip other validations if field is empty and not required
  if (!value) return undefined

  // String length validations
  if (typeof value === 'string') {
    if (rule.minLength && value.length < rule.minLength.value) {
      return rule.minLength.message
    }
    if (rule.maxLength && value.length > rule.maxLength.value) {
      return rule.maxLength.message
    }
    if (rule.pattern && !rule.pattern.value.test(value)) {
      return rule.pattern.message
    }
  }

  // Numeric validations
  if (typeof value === 'number' || !isNaN(Number(value))) {
    const numValue = Number(value)
    if (rule.min && numValue < rule.min.value) {
      return rule.min.message
    }
    if (rule.max && numValue > rule.max.value) {
      return rule.max.message
    }
  }

  // Custom validation
  if (rule.custom) {
    return rule.custom(value)
  }

  return undefined
}

// Form validation hook
export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  validationRules: ValidationRules,
  {
    validateOnChange = true,
    validateOnBlur = true,
    submitValidation = true
  } = {}
) {
  const [values, setValues] = useState<T>(initialValues)
  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<FormTouched>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  // Validate single field
  const validateSingleField = useCallback((name: string, value: any): string | undefined => {
    const rule = validationRules[name]
    if (!rule) return undefined
    return validateField(value, rule)
  }, [validationRules])

  // Validate all fields
  const validateForm = useCallback((): FormErrors => {
    const newErrors: FormErrors = {}
    
    Object.keys(validationRules).forEach(fieldName => {
      const error = validateSingleField(fieldName, values[fieldName])
      if (error) {
        newErrors[fieldName] = error
      }
    })
    
    return newErrors
  }, [values, validateSingleField])

  // Update field value
  const setValue = useCallback((name: string, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }))
    
    if (validateOnChange && touched[name]) {
      const error = validateSingleField(name, value)
      setErrors(prev => ({
        ...prev,
        [name]: error || ''
      }))
    }
  }, [validateOnChange, touched, validateSingleField])

  // Handle field blur
  const handleBlur = useCallback((name: string) => {
    setTouched(prev => ({ ...prev, [name]: true }))
    
    if (validateOnBlur) {
      const error = validateSingleField(name, values[name])
      setErrors(prev => ({
        ...prev,
        [name]: error || ''
      }))
    }
  }, [validateOnBlur, validateSingleField, values])

  // Clear field error
  const clearError = useCallback((name: string) => {
    setErrors(prev => {
      const { [name]: _, ...rest } = prev
      return rest
    })
  }, [])

  // Submit form
  const handleSubmit = useCallback(async <R>(
    onSubmit: (values: T) => Promise<R>,
    options: {
      onSuccess?: (result: R) => void
      onError?: (error: any) => void
      successMessage?: string
      showErrorToast?: boolean
    } = {}
  ): Promise<R | null> => {
    const {
      onSuccess,
      onError,
      successMessage,
      showErrorToast = true
    } = options

    try {
      setIsSubmitting(true)

      // Validate form if enabled
      if (submitValidation) {
        const formErrors = validateForm()
        if (Object.keys(formErrors).length > 0) {
          setErrors(formErrors)
          // Mark all fields as touched to show errors
          const allTouched = Object.keys(validationRules).reduce((acc, key) => {
            acc[key] = true
            return acc
          }, {} as FormTouched)
          setTouched(allTouched)
          
          if (showErrorToast) {
            toast({
              variant: 'destructive',
              title: 'Validation Error',
              description: 'Please correct the errors below and try again.'
            })
          }
          return null
        }
      }

      // Clear errors before submission
      setErrors({})

      // Submit form
      const result = await onSubmit(values)
      
      if (onSuccess) {
        onSuccess(result)
      }
      
      if (successMessage) {
        toast({
          title: 'Success',
          description: successMessage
        })
      }
      
      return result
    } catch (error: any) {
      if (onError) {
        onError(error)
      }
      
      if (showErrorToast) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message || 'An error occurred. Please try again.'
        })
      }
      
      throw error
    } finally {
      setIsSubmitting(false)
    }
  }, [values, validateForm, submitValidation, validationRules, toast])

  // Reset form
  const resetForm = useCallback(() => {
    setValues(initialValues)
    setErrors({})
    setTouched({})
    setIsSubmitting(false)
  }, [initialValues])

  // Check if form is valid
  const isValid = Object.keys(validateForm()).length === 0

  // Get field props for easy integration with form components
  const getFieldProps = useCallback((name: string) => ({
    value: values[name] || '',
    onChange: (value: any) => setValue(name, value),
    onBlur: () => handleBlur(name),
    error: touched[name] ? errors[name] : undefined,
    'aria-invalid': touched[name] && errors[name] ? 'true' : undefined,
    'aria-describedby': errors[name] ? `${name}-error` : undefined
  }), [values, setValue, handleBlur, errors, touched])

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    setValue,
    handleBlur,
    clearError,
    handleSubmit,
    resetForm,
    getFieldProps,
    validateForm
  }
}

// Field validation status helper
export function getFieldValidationStatus(
  value: any,
  error: string | undefined,
  touched: boolean
): 'idle' | 'valid' | 'invalid' {
  if (!touched) return 'idle'
  if (error) return 'invalid'
  if (value && !error) return 'valid'
  return 'idle'
}

// Debounced validation hook for real-time validation
export function useDebouncedValidation(
  value: any,
  validationFn: (value: any) => string | undefined,
  delay: number = 300
) {
  const [error, setError] = useState<string | undefined>()
  const [isValidating, setIsValidating] = useState(false)

  useEffect(() => {
    setIsValidating(true)
    const handler = setTimeout(() => {
      const validationError = validationFn(value)
      setError(validationError)
      setIsValidating(false)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, validationFn, delay])

  return { error, isValidating }
}
