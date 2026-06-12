'use client';

import { useState } from 'react';
import UploadForm from '../components/UploadForm';
import ProgressDashboard from '../components/ProgressDashboard';
import ResultsDownload from '../components/ResultsDownload';

export default function Home() {
  const [step, setStep] = useState(1);
  const [cities, setCities] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [scrapingData, setScrapingData] = useState(null);
  const [results, setResults] = useState(null);

  const handleUploadComplete = (uploadedCities) => {
    setCities(uploadedCities);
    setStep(2);
  };

  const handleStartScraping = (searchKeyword) => {
    setKeyword(searchKeyword);
    setStep(3);
  };

  const handleScrapingComplete = (resultsData) => {
    setResults(resultsData);
    setStep(4);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🗺️ Google Maps Business Scraper
          </h1>
          <p className="text-lg text-gray-600">
            Extract business data from Google Maps with ease
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-12">
          <div className="flex items-center justify-center">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    step >= s
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {s}
                </div>
                {s < 4 && (
                  <div
                    className={`w-24 h-1 ${
                      step > s ? 'bg-indigo-600' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 px-12">
            <span className="text-sm text-gray-600">Upload</span>
            <span className="text-sm text-gray-600">Keyword</span>
            <span className="text-sm text-gray-600">Scraping</span>
            <span className="text-sm text-gray-600">Results</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-lg shadow-xl p-8">
          {step === 1 && <UploadForm onComplete={handleUploadComplete} />}
          
          {step === 2 && (
            <div className="max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold mb-6">Enter Search Keyword</h2>
              <input
                type="text"
                placeholder="e.g., Restaurant, Gym, Hospital"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-4"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>{cities.length}</strong> cities loaded
                </p>
                <p className="text-sm text-gray-600">
                  Searches will be generated as: <br />
                  <span className="font-mono text-indigo-600">
                    {keyword || '[keyword]'} {cities[0]?.City || '[city]'} {cities[0]?.State || '[state]'}
                  </span>
                </p>
              </div>
              <button
                onClick={() => handleStartScraping(keyword)}
                disabled={!keyword}
                className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold transition"
              >
                Start Scraping
              </button>
            </div>
          )}
          
          {step === 3 && (
            <ProgressDashboard
              keyword={keyword}
              cities={cities}
              onComplete={handleScrapingComplete}
            />
          )}
          
          {step === 4 && results && (
            <ResultsDownload results={results} keyword={keyword} />
          )}
        </div>
      </div>
    </div>
  );
}
