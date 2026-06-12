'use client';

export default function ResultsDownload({ results, keyword }) {
  const handleDownload = (type) => {
    const filename = type === 'csv' ? results.csv_file : results.excel_file;
    const fileNameOnly = filename.split('/').pop();
    window.open(
  `${process.env.NEXT_PUBLIC_API_URL}/download/${fileNameOnly}`,
  '_blank'
);

  return (
    <div className="max-w-2xl mx-auto text-center">
      <div className="mb-8">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-3xl font-bold mb-4">Scraping Complete!</h2>
        <p className="text-gray-600 text-lg">
          Successfully scraped <strong>{results.total_records}</strong> businesses
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <button
          onClick={() => handleDownload('csv')}
          className="bg-green-600 text-white py-4 px-6 rounded-lg hover:bg-green-700 transition font-semibold flex items-center justify-center"
        >
          <span className="text-2xl mr-2">📊</span>
          Download CSV
        </button>

        <button
          onClick={() => handleDownload('excel')}
          className="bg-blue-600 text-white py-4 px-6 rounded-lg hover:bg-blue-700 transition font-semibold flex items-center justify-center"
        >
          <span className="text-2xl mr-2">📈</span>
          Download Excel
        </button>
      </div>

      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="font-semibold mb-3">Data Includes:</h3>
        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
          <div>✓ Business Name</div>
          <div>✓ Category</div>
          <div>✓ Address</div>
          <div>✓ Phone Number</div>
          <div>✓ Website</div>
          <div>✓ Rating</div>
          <div>✓ Review Count</div>
          <div>✓ Google Maps URL</div>
          <div>✓ Coordinates</div>
          <div>✓ City & State</div>
        </div>
      </div>

      <button
        onClick={() => window.location.reload()}
        className="mt-6 text-indigo-600 hover:text-indigo-800 font-semibold"
      >
        ← Start New Scraping Job
      </button>
    </div>
  );
}
