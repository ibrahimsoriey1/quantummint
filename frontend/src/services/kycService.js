import axios from 'axios';
import { handleApiError } from '../utils/errorHandler';

const KYC_URL = '/api/kyc';
const DOCUMENTS_URL = '/api/documents';
const VERIFICATIONS_URL = '/api/verifications';

// Create axios instance with token
const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Get KYC profile
const getKycProfile = async () => {
  try {
    const response = await axios.get(
      `${KYC_URL}/profile`,
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Create or update KYC profile
const updateKycProfile = async (profileData) => {
  try {
    const response = await axios.post(
      `${KYC_URL}/profile`,
      profileData,
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get KYC status
const getKycStatus = async () => {
  try {
    const response = await axios.get(
      `${KYC_URL}/status`,
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Submit KYC for verification
const submitKycVerification = async () => {
  try {
    const response = await axios.post(
      `${KYC_URL}/verify`,
      {},
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Upload document
const uploadDocument = async (documentType, file, metadata = {}) => {
  try {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('documentType', documentType);
    formData.append('metadata', JSON.stringify(metadata));
    
    const response = await axios.post(
      `${DOCUMENTS_URL}/upload`,
      formData,
      { 
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get document
const getDocument = async (documentId) => {
  try {
    const response = await axios.get(
      `${DOCUMENTS_URL}/${documentId}`,
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get all documents
const getAllDocuments = async () => {
  try {
    const response = await axios.get(
      `${DOCUMENTS_URL}`,
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Delete document
const deleteDocument = async (documentId) => {
  try {
    const response = await axios.delete(
      `${DOCUMENTS_URL}/${documentId}`,
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get verification history
const getVerificationHistory = async () => {
  try {
    const response = await axios.get(
      `${VERIFICATIONS_URL}/history`,
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get verification details
const getVerificationDetails = async (verificationId) => {
  try {
    const response = await axios.get(
      `${VERIFICATIONS_URL}/${verificationId}`,
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get required documents
const getRequiredDocuments = async () => {
  try {
    const response = await axios.get(
      `${KYC_URL}/required-documents`,
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

const kycService = {
  getKycProfile,
  updateKycProfile,
  getKycStatus,
  submitKycVerification,
  uploadDocument,
  getDocument,
  getAllDocuments,
  deleteDocument,
  getVerificationHistory,
  getVerificationDetails,
  getRequiredDocuments,
};

export default kycService;