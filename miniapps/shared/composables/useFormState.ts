/**
 * Standard Form State Composable
 *
 * Provides form state management with validation, error handling,
 * and type safety for Vue 3 components.
 *
 * @example
 * ```ts
 * interface LoginForm {
 *   email: string;
 *   password: string;
 * }
 *
 * const { values, errors, validate, reset } = useFormState<LoginForm>({
 *   email: "",
 *   password: "",
 * }, (values) => {
 *   const errors: Record<string, string> = {};
 *   if (!values.email.includes("@")) errors.email = "Invalid email";
 *   if (values.password.length < 8) errors.password = "Too short";
 *   return errors;
 * });
 * ```
 */

import { reactive, computed, type Ref } from "vue";

export interface ValidationRules<T> {
  (values: T): Record<string, string> | null;
}

export interface FormState<T> {
  /** Current form values */
  values: T;
  /** Validation errors */
  errors: Record<string, string>;
  /** Which fields have been touched */
  touched: Record<string, boolean>;
  /** Whether the form is valid */
  isValid: Ref<boolean>;
  /** Set a field value */
  setFieldValue: <K extends keyof T>(field: K, value: T[K]) => void;
  /** Set an error message */
  setError: (field: string, message: string) => void;
  /** Clear an error message */
  clearError: (field: string) => void;
  /** Validate all fields */
  validate: () => boolean;
  /** Validate a single field */
  validateField: (field: string) => boolean;
  /** Reset form to initial values */
  reset: () => void;
  /** Mark all fields as touched */
  touchAll: () => void;
}

export function useFormState<T extends Record<string, any>>(
  initialValues: T,
  validate?: ValidationRules<T>,
): FormState<T> {
  const values = reactive({ ...initialValues }) as T;
  const errors = reactive<Record<string, string>>({});
  const touched = reactive<Record<string, boolean>>({});

  const setFieldValue = <K extends keyof T>(field: K, value: T[K]) => {
    (values as Record<string, unknown>)[String(field)] = value;
    touched[String(field)] = true;

    // Clear error when value changes
    if (errors[String(field)]) {
      delete errors[String(field)];
    }
  };

  const setError = (field: string, message: string) => {
    errors[field] = message;
  };

  const clearError = (field: string) => {
    delete errors[field];
  };

  const validateAll = (): boolean => {
    // Clear existing errors
    Object.keys(errors).forEach((key) => delete errors[key]);

    // Run validation if provided
    if (validate) {
      const validationErrors = validate(values);
      if (validationErrors) {
        Object.assign(errors, validationErrors);
      }
      return Object.keys(errors).length === 0;
    }

    return true;
  };

  const validateField = (field: string): boolean => {
    if (validate) {
      const validationErrors = validate(values);
      if (validationErrors && validationErrors[field]) {
        errors[field] = validationErrors[field];
        return false;
      }
    }
    delete errors[field];
    return true;
  };

  const reset = () => {
    Object.assign(values, initialValues);
    Object.keys(errors).forEach((key) => delete errors[key]);
    Object.keys(touched).forEach((key) => delete touched[key]);
  };

  const touchAll = () => {
    Object.keys(values).forEach((key) => {
      touched[key] = true;
    });
  };

  const isValid = computed(() => {
    return Object.keys(errors).length === 0;
  });

  return {
    values,
    errors,
    touched,
    isValid,
    setFieldValue,
    setError,
    clearError,
    validate: validateAll,
    validateField,
    reset,
    touchAll,
  };
}
