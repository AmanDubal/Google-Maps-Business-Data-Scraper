'use client';

import { useState } from 'react';
import axios from 'axios';

export default function UploadForm({ onComplete }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  const handleFileChange = (selectedFile) => {
    if (!selectedFile) return;

    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    
    if (!validTypes.includes(selectedFile.type) && 
        !selectedFile.name.match(/\.(xlsx|xls)$/i)) {
      setError({
        type: 'validation',
        message: 'Invalid file type',
        details: 'Please upload an Excel file (.xlsx or .xls)',
        suggestion: 'Make sure your file has the correct extension'
      });
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (selectedFile.size > maxSize) {
      setError({
        type: 'validation',
        message: 'File too large',
        details: `File size: ${(selectedFile.size / 1024 / 1024).toFixed(2)}MB`,
        suggestion: 'Please upload a file smaller than 10MB'
      });
      return;
    }

    setFile(selectedFile);
    setError(null);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError({
        type: 'validation',
        message: 'No file selected',
        details: 'Please select a file to upload',
        suggestion: 'Click the upload area or drag and drop a file'
      });
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post( `${process.env.NEXT_PUBLIC_API_URL}/upload-cities`, formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 30000, // 30 second timeout
        }
      );

      if (response.data.success) {
        setPreviewData(response.data);
        
        // Validate cities data
        if (response.data.cities_count === 0) {
          setError({
            type: 'data',
            message: 'No cities found',
            details: 'The Excel file appears to be empty',
            suggestion: 'Please check your Excel file and make sure it contains city data'
          });
          setUploading(false);
          return;
        }

        // Show preview and confirm
        setTimeout(() => {
          onComplete(response.data.cities);
        }, 1000);
      } else {
        throw new Error(response.data.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      
      let errorInfo = {
        type: 'network',
        message: 'Upload failed',
        details: '',
        suggestion: ''
      };

      if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        errorInfo = {
          type: 'timeout',
          message: 'Request timeout',
          details: 'The server took too long to respond',
          suggestion: 'Please check your internet connection and try again'
        };
      } else if (err.code === 'ERR_NETWORK' || err.message.includes('Network Error')) {
        errorInfo = {
          type: 'network',
          message: 'Network error',
          details: 'Cannot connect to the server',
          suggestion: 'Make sure the backend server is running on http://NEXT_PUBLIC_API_URL'
        };
      } else if (err.response) {
        // Server responded with error
        if (err.response.status === 400) {
          errorInfo = {
            type: 'validation',
            message: 'Invalid file format',
            details: err.response.data.error || 'The Excel file format is incorrect',
            suggestion: 'Make sure your Excel file has "City" and "State" columns'
          };
        } else if (err.response.status === 500) {
          errorInfo = {
            type: 'server',
            message: 'Server error',
            details: 'An error occurred while processing your file',
            suggestion: 'Please check the file format and try again'
          };
        } else {
          errorInfo = {
            type: 'server',
            message: `Server error (${err.response.status})`,
            details: err.response.data.error || err.message,
            suggestion: 'Please try again or contact support'
          };
        }
      } else {
        errorInfo.details = err.message;
        errorInfo.suggestion = 'Please try again';
      }

      setError(errorInfo);
    } finally {
      setUploading(false);
    }
  };

  const ErrorDisplay = ({ error }) => {
    const iconMap = {
      validation: '⚠️',
      network: '🔌',
      timeout: '⏱️',
      server: '🔧',
      data: '📊'
    };

    const colorMap = {
      validation: 'yellow',
      network: 'red',
      timeout: 'orange',
      server: 'red',
      data: 'yellow'
    };

    const color = colorMap[error.type] || 'red';

    return (
      <div className={`bg-${color}-50 border-l-4 border-${color}-500 p-4 rounded-r-lg mb-4 animate-slideIn`}>
        <div className="flex items-start">
          <div className="text-2xl mr-3">{iconMap[error.type] || '❌'}</div>
          <div className="flex-1">
            <h3 className={`text-${color}-800 font-semibold mb-1`}>
              {error.message}
            </h3>
            {error.details && (
              <p className={`text-${color}-700 text-sm mb-2`}>
                {error.details}
              </p>
            )}
            {error.suggestion && (
              <div className={`bg-${color}-100 border border-${color}-200 rounded p-2 mt-2`}>
                <p className={`text-${color}-800 text-sm`}>
                  💡 <strong>Suggestion:</strong> {error.suggestion}
                </p>
              </div>
            )}
          </div>
          <button
            onClick={() => setError(null)}
            className={`text-${color}-500 hover:text-${color}-700 ml-2`}
          >
            ✕
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Upload Cities Excel File</h2>
      
      {/* Error Display */}
      {error && <ErrorDisplay error={error} />}

      {/* Success Preview */}
      {previewData && !error && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg mb-4 animate-slideIn">
          <div className="flex items-start">
            <div className="text-2xl mr-3">✅</div>
            <div>
              <h3 className="text-green-800 font-semibold mb-1">
                File uploaded successfully!
              </h3>
              <p className="text-green-700 text-sm">
                Found {previewData.cities_count} cities. Processing...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Upload Area */}
      <div className="mb-6">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
            dragActive
              ? 'border-indigo-500 bg-indigo-50'
              : error
              ? 'border-red-300 bg-red-50'
              : 'border-gray-300 hover:border-indigo-500'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => handleFileChange(e.target.files[0])}
            className="hidden"
            id="file-upload"
            disabled={uploading}
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <div className="text-6xl mb-4">
              {uploading ? '⏳' : file ? '📄' : '📁'}
            </div>
            <p className="text-lg font-semibold mb-2">
              {uploading
                ? 'Uploading...'
                : file
                ? file.name
                : 'Click to upload or drag and drop'}
            </p>
            <p className="text-sm text-gray-500">
              Excel files only (.xlsx, .xls) • Max 10MB
            </p>
            {file && !uploading && (
              <p className="text-xs text-gray-400 mt-2">
                Size: {(file.size / 1024).toFixed(2)} KB
              </p>
            )}
          </label>
        </div>
      </div>

      {/* Format Guide */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start mb-3">
          <span className="text-2xl mr-2">📋</span>
          <div>
            <p className="text-sm font-semibold text-blue-900 mb-1">
              Required Excel Format:
            </p>
            <p className="text-xs text-blue-700">
              Your file must contain "City" and "State" columns
            </p>
          </div>
        </div>
        <table className="w-full text-sm border border-blue-200 rounded overflow-hidden">
          <thead>
            <tr className="bg-blue-100">
              <th className="p-2 text-left border-r border-blue-200">State</th>
              <th className="p-2 text-left">City</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            <tr className="border-t border-blue-200">
              <td className="p-2 border-r border-blue-200">Maharashtra</td>
              <td className="p-2">Mumbai</td>
            </tr>
            <tr className="border-t border-blue-200">
              <td className="p-2 border-r border-blue-200">Maharashtra</td>
              <td className="p-2">Pune</td>
            </tr>
            <tr className="border-t border-blue-200">
              <td className="p-2 border-r border-blue-200">Gujarat</td>
              <td className="p-2">Ahmedabad</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="flex-1 bg-indigo-600 text-white py-3 px-6 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold transition flex items-center justify-center"
        >
          {uploading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Uploading...
            </>
          ) : (
            <>
              <span className="mr-2">📤</span>
              Upload & Continue
            </>
          )}
        </button>

        {file && !uploading && (
          <button
            onClick={() => {
              setFile(null);
              setError(null);
              setPreviewData(null);
            }}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Clear
          </button>
        )}
      </div>

      {/* Help Section */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600 mb-2">
          <strong>Common Issues:</strong>
        </p>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>✓ Make sure column names are exactly "City" and "State"</li>
          <li>✓ Remove any empty rows from your Excel file</li>
          <li>✓ Ensure the backend server is running on port 8000</li>
          <li>✓ Check that your file is not corrupted</li>
        </ul>
      </div>
    </div>
  );
}
