import { useState, useCallback } from 'react';
import * as Yup from 'yup';

export const useFormValidation = (initialValues, validationSchema) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isValid, setIsValid] = useState(false);

  const validateField = useCallback(async (fieldName, value) => {
    if (!validationSchema) return;

    try {
      const fieldSchema = Yup.reach(validationSchema, fieldName);
      await fieldSchema.validate(value);
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        [fieldName]: error.message
      }));
    }
  }, [validationSchema]);

  const validateForm = useCallback(async () => {
    if (!validationSchema) return true;

    try {
      await validationSchema.validate(values, { abortEarly: false });
      setErrors({});
      setIsValid(true);
      return true;
    } catch (error) {
      const newErrors = {};
      error.inner.forEach(err => {
        newErrors[err.path] = err.message;
      });
      setErrors(newErrors);
      setIsValid(false);
      return false;
    }
  }, [values, validationSchema]);

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setValues(prev => ({
      ...prev,
      [name]: newValue
    }));

    // Validate field on change
    validateField(name, newValue);
  }, [validateField]);

  const handleBlur = useCallback((e) => {
    const { name } = e.target;
    setTouched(prev => ({
      ...prev,
      [name]: true
    }));
  }, []);

  const setFieldValue = useCallback((name, value) => {
    setValues(prev => ({
      ...prev,
      [name]: value
    }));
    validateField(name, value);
  }, [validateField]);

  const setFieldError = useCallback((name, error) => {
    setErrors(prev => ({
      ...prev,
      [name]: error
    }));
  }, []);

  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsValid(false);
  }, [initialValues]);

  const getFieldProps = useCallback((name) => ({
    name,
    value: values[name] || '',
    onChange: handleChange,
    onBlur: handleBlur,
    error: touched[name] && !!errors[name],
    helperText: touched[name] && errors[name]
  }), [values, errors, touched, handleChange, handleBlur]);

  return {
    values,
    errors,
    touched,
    isValid,
    handleChange,
    handleBlur,
    setFieldValue,
    setFieldError,
    resetForm,
    validateForm,
    getFieldProps
  };
};





