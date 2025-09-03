/**
 * Handle API errors and return a standardized error object
 * @param {Error} error - The error object from axios
 * @returns {Error} - A standardized error object with message
 */
export const handleApiError = (error) => {
  let errorMessage = 'An unexpected error occurred. Please try again.';
  
  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    const { data } = error.response;
    
    if (data && data.message) {
      errorMessage = data.message;
    } else if (data && data.error) {
      errorMessage = data.error;
    } else if (error.response.status === 401) {
      errorMessage = 'Authentication failed. Please log in again.';
    } else if (error.response.status === 403) {
      errorMessage = 'You do not have permission to perform this action.';
    } else if (error.response.status === 404) {
      errorMessage = 'The requested resource was not found.';
    } else if (error.response.status === 422) {
      errorMessage = 'Validation failed. Please check your input.';
    } else if (error.response.status >= 500) {
      errorMessage = 'Server error. Please try again later.';
    }
  } else if (error.request) {
    // The request was made but no response was received
    errorMessage = 'No response from server. Please check your internet connection.';
  } else {
    // Something happened in setting up the request that triggered an Error
    errorMessage = error.message || 'An error occurred. Please try again.';
  }
  
  const customError = new Error(errorMessage);
  customError.originalError = error;
  return customError;
};

/**
 * Format validation errors from API response
 * @param {Object} errors - The errors object from API
 * @returns {Object} - Formatted errors object for Formik
 */
export const formatValidationErrors = (errors) => {
  const formattedErrors = {};
  
  if (typeof errors === 'object' && errors !== null) {
    Object.keys(errors).forEach((key) => {
      formattedErrors[key] = Array.isArray(errors[key]) 
        ? errors[key][0] 
        : errors[key];
    });
  }
  
  return formattedErrors;
};