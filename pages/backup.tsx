import { useState } from 'react';
import Head from 'next/head';

export default function BackupPage() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState('json');
  const [includeMetadata, setIncludeMetadata] = useState(true);

  const handleDownload = async () => {
    setIsDownloading(true);
    
    try {
      const params = new URLSearchParams({
        format: selectedFormat,
        metadata: includeMetadata.toString()
      });
      
      const response = await fetch(`/api/backup-data?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to create backup');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `alby-lsp-backup-${new Date().toISOString().split('T')[0]}.${selectedFormat}`;
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download backup. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Database Backup - Alby LSP Price Board</title>
      </Head>
      
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">
              📦 Database Backup
            </h1>
            
            <div className="mb-8">
              <p className="text-gray-600 mb-4">
                Download a complete backup of your LSP price data. This includes all current channel data, 
                historical data, and metadata.
              </p>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Important
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>
                        This backup contains all your historical data. Store it safely as it can be used to restore 
                        your database if needed.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Format Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  File Format
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { value: 'json', label: 'JSON', description: 'Complete data structure' },
                    { value: 'csv', label: 'CSV', description: 'Spreadsheet format' },
                    { value: 'sql', label: 'SQL', description: 'Database import' },
                    { value: 'txt', label: 'TXT', description: 'Human readable' }
                  ].map((format) => (
                    <label key={format.value} className="relative">
                      <input
                        type="radio"
                        name="format"
                        value={format.value}
                        checked={selectedFormat === format.value}
                        onChange={(e) => setSelectedFormat(e.target.value)}
                        className="sr-only"
                      />
                      <div className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedFormat === format.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}>
                        <div className="font-medium text-gray-900">{format.label}</div>
                        <div className="text-sm text-gray-500">{format.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Metadata Option */}
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={includeMetadata}
                    onChange={(e) => setIncludeMetadata(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Include metadata (database statistics and configuration)
                  </span>
                </label>
              </div>

              {/* Download Button */}
              <div className="pt-4">
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className={`w-full md:w-auto px-6 py-3 rounded-md font-medium transition-colors ${
                    isDownloading
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                  }`}
                >
                  {isDownloading ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating Backup...
                    </div>
                  ) : (
                    '📥 Download Backup'
                  )}
                </button>
              </div>

              {/* Format Descriptions */}
              <div className="mt-8 bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Format Details</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <p><strong>JSON:</strong> Complete data structure with all metadata. Best for programmatic use and full restoration.</p>
                  <p><strong>CSV:</strong> Tabular format suitable for Excel, Google Sheets, or data analysis tools.</p>
                  <p><strong>SQL:</strong> SQL INSERT statements that can be imported into a SQLite or MySQL database.</p>
                  <p><strong>TXT:</strong> Human-readable text format for quick inspection and manual review.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
