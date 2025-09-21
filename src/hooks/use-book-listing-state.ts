/**
 * Book listing state management using useReducer for better organization
 */

import { useReducer, useCallback } from 'react';
import { BookGenre } from '@/lib/types';

export interface BookListingState {
  // Form data
  title: string;
  author: string;
  description: string;
  genre: BookGenre;
  condition: 'new' | 'like-new' | 'used' | 'worn';
  type: 'sell' | 'exchange';
  price: number | undefined;
  coverImage: File | null;
  
  // UI states
  isListingLoading: boolean;
  isAnalyzing: boolean;
  
  // AI suggestions
  aiSuggestion: {
    price?: number;
    condition?: 'new' | 'like-new' | 'used' | 'worn';
    description?: string;
  } | null;
  
  // Validation
  errors: {
    title?: string;
    author?: string;
    description?: string;
    price?: string;
    coverImage?: string;
    general?: string;
  };
  
  // Meta
  hasUnsavedChanges: boolean;
  lastSaved: Date | null;
}

export type BookListingAction = 
  | { type: 'SET_FIELD'; field: keyof BookListingState; value: any }
  | { type: 'SET_FORM_DATA'; data: Partial<BookListingState> }
  | { type: 'SET_AI_SUGGESTION'; suggestion: BookListingState['aiSuggestion'] }
  | { type: 'APPLY_AI_SUGGESTION' }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ANALYZING'; analyzing: boolean }
  | { type: 'SET_ERROR'; field: keyof BookListingState['errors']; error: string | undefined }
  | { type: 'CLEAR_ERRORS' }
  | { type: 'RESET_FORM' }
  | { type: 'MARK_SAVED' }
  | { type: 'MARK_UNSAVED' };

const initialState: BookListingState = {
  title: '',
  author: '',
  description: '',
  genre: 'other',
  condition: 'used',
  type: 'sell',
  price: undefined,
  coverImage: null,
  
  isListingLoading: false,
  isAnalyzing: false,
  
  aiSuggestion: null,
  
  errors: {},
  
  hasUnsavedChanges: false,
  lastSaved: null,
};

function bookListingReducer(state: BookListingState, action: BookListingAction): BookListingState {
  switch (action.type) {
    case 'SET_FIELD':
      return {
        ...state,
        [action.field]: action.value,
        hasUnsavedChanges: true,
        errors: {
          ...state.errors,
          [action.field]: undefined, // Clear field error when user starts typing
        }
      };
    
    case 'SET_FORM_DATA':
      return {
        ...state,
        ...action.data,
        hasUnsavedChanges: true,
      };
    
    case 'SET_AI_SUGGESTION':
      return {
        ...state,
        aiSuggestion: action.suggestion,
      };
    
    case 'APPLY_AI_SUGGESTION':
      if (!state.aiSuggestion) return state;
      
      return {
        ...state,
        price: state.aiSuggestion.price ?? state.price,
        condition: state.aiSuggestion.condition ?? state.condition,
        description: state.aiSuggestion.description ?? state.description,
        hasUnsavedChanges: true,
        aiSuggestion: null, // Clear suggestion after applying
      };
    
    case 'SET_LOADING':
      return {
        ...state,
        isListingLoading: action.loading,
      };
    
    case 'SET_ANALYZING':
      return {
        ...state,
        isAnalyzing: action.analyzing,
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        errors: {
          ...state.errors,
          [action.field]: action.error,
        }
      };
    
    case 'CLEAR_ERRORS':
      return {
        ...state,
        errors: {},
      };
    
    case 'RESET_FORM':
      return {
        ...initialState,
        lastSaved: null,
      };
    
    case 'MARK_SAVED':
      return {
        ...state,
        hasUnsavedChanges: false,
        lastSaved: new Date(),
      };
    
    case 'MARK_UNSAVED':
      return {
        ...state,
        hasUnsavedChanges: true,
      };
    
    default:
      return state;
  }
}

export function useBookListingState() {
  const [state, dispatch] = useReducer(bookListingReducer, initialState);
  
  // Memoized action creators
  const setField = useCallback((field: keyof BookListingState, value: any) => {
    dispatch({ type: 'SET_FIELD', field, value });
  }, []);
  
  const setFormData = useCallback((data: Partial<BookListingState>) => {
    dispatch({ type: 'SET_FORM_DATA', data });
  }, []);
  
  const setAISuggestion = useCallback((suggestion: BookListingState['aiSuggestion']) => {
    dispatch({ type: 'SET_AI_SUGGESTION', suggestion });
  }, []);
  
  const applyAISuggestion = useCallback(() => {
    dispatch({ type: 'APPLY_AI_SUGGESTION' });
  }, []);
  
  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', loading });
  }, []);
  
  const setAnalyzing = useCallback((analyzing: boolean) => {
    dispatch({ type: 'SET_ANALYZING', analyzing });
  }, []);
  
  const setError = useCallback((field: keyof BookListingState['errors'], error: string | undefined) => {
    dispatch({ type: 'SET_ERROR', field, error });
  }, []);
  
  const clearErrors = useCallback(() => {
    dispatch({ type: 'CLEAR_ERRORS' });
  }, []);
  
  const resetForm = useCallback(() => {
    dispatch({ type: 'RESET_FORM' });
  }, []);
  
  const markSaved = useCallback(() => {
    dispatch({ type: 'MARK_SAVED' });
  }, []);
  
  const markUnsaved = useCallback(() => {
    dispatch({ type: 'MARK_UNSAVED' });
  }, []);
  
  // Validation functions
  const validateField = useCallback((field: keyof BookListingState['errors'], value: any): string | undefined => {
    switch (field) {
      case 'title':
        if (!value || value.trim().length === 0) return 'Title is required';
        if (value.length > 200) return 'Title too long (max 200 characters)';
        break;
      
      case 'author':
        if (!value || value.trim().length === 0) return 'Author is required';
        if (value.length > 100) return 'Author name too long (max 100 characters)';
        break;
      
      case 'description':
        if (!value || value.trim().length === 0) return 'Description is required';
        if (value.length > 2000) return 'Description too long (max 2000 characters)';
        break;
      
      case 'price':
        if (state.type === 'sell') {
          if (value === undefined || value === null) return 'Price is required for sale listings';
          if (typeof value !== 'number' || isNaN(value)) return 'Price must be a valid number';
          if (value < 0) return 'Price cannot be negative';
          if (value > 100000) return 'Price too high (max PKR 100,000)';
        }
        break;
      
      case 'coverImage':
        if (!value) return 'Cover image is required';
        if (value.size > 5 * 1024 * 1024) return 'Image too large (max 5MB)';
        if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(value.type)) {
          return 'Invalid image format (use JPEG, PNG, or WebP)';
        }
        break;
    }
    return undefined;
  }, [state.type]);
  
  const validateForm = useCallback((): boolean => {
    const newErrors: BookListingState['errors'] = {};
    
    newErrors.title = validateField('title', state.title);
    newErrors.author = validateField('author', state.author);
    newErrors.description = validateField('description', state.description);
    newErrors.price = validateField('price', state.price);
    newErrors.coverImage = validateField('coverImage', state.coverImage);
    
    // Set all errors at once
    Object.entries(newErrors).forEach(([field, error]) => {
      if (error) {
        dispatch({ type: 'SET_ERROR', field: field as keyof BookListingState['errors'], error });
      }
    });
    
    return Object.values(newErrors).every(error => !error);
  }, [state, validateField]);
  
  // Computed values
  const isFormValid = Object.values(state.errors).every(error => !error) && 
                     state.title.trim() !== '' && 
                     state.author.trim() !== '' && 
                     state.description.trim() !== '' &&
                     state.coverImage !== null &&
                     (state.type === 'exchange' || (state.type === 'sell' && state.price !== undefined));
  
  const canSubmit = isFormValid && !state.isListingLoading && !state.isAnalyzing;
  
  return {
    state,
    actions: {
      setField,
      setFormData,
      setAISuggestion,
      applyAISuggestion,
      setLoading,
      setAnalyzing,
      setError,
      clearErrors,
      resetForm,
      markSaved,
      markUnsaved,
      validateField,
      validateForm,
    },
    computed: {
      isFormValid,
      canSubmit,
    }
  };
}

/**
 * Custom hook for managing unsaved changes warning
 */
export function useUnsavedChangesWarning(hasUnsavedChanges: boolean) {
  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      return e.returnValue;
    }
  }, [hasUnsavedChanges]);
  
  // Set up beforeunload listener
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }
  
  return () => {};
}
