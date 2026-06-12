'use client';

import { useState } from 'react';
import axios from 'axios';

export default function UploadForm({ onComplete }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
        setFile(selectedFile);
        setError('');
      } else {
        setError('Please upload an Excel file (.xlsx or .xls)');
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('http://localhost:8000/upload-cities', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        onComplete(response.data.cities);
      } else {
        setError(response.data.error || 'Upload failed');
      }
    } catch (err) {
      setError('Failed to upload file. Please try again.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Upload Cities Excel File</h2>
      
      <div className="mb-6">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-500 transition">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <div className="text-6xl mb-4">📁</div>
            <p className="text-lg font-semibold mb-2">
              {file ? file.name : 'Click to upload Excel file'}
            </p>
            <p className="text-sm text-gray-500">
              File must contain 'City' and 'State' columns
            </p>
          </label>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm font-semibold mb-2">Example Excel Format:</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-blue-100">
              <th className="p-2 text-left">State</th>
              <th className="p-2 text-left">City</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-2">Maharashtra</td>
              <td className="p-2">Mumbai</td>
            </tr>
            <tr>
              <td className="p-2">Maharashtra</td>
              <td className="p-2">Pune</td>
            </tr>
            <tr>
              <td className="p-2">Gujarat</td>
              <td className="p-2">Ahmedabad</td>
            </tr>
          </tbody>
        </table>
      </div>

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold transition"
      >
        {uploading ? 'Uploading...' : 'Upload & Continue'}
      </button>
    </div>
  );
}
