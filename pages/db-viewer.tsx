import { useState, useEffect } from 'react';
import Head from 'next/head';

interface KeyInfo {
  key: string;
  type: string;
  ttl: string | number;
  size: string | number;
}

interface KeyData {
  key: string;
  type: string;
  data: any;
}

export default function DatabaseViewer() {
  const [keys, setKeys] = useState<KeyInfo[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [keyData, setKeyData] = useState<KeyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pattern, setPattern] = useState('alby:lsp:*');

  const fetchKeys = async (searchPattern: string = 'alby:lsp:*') => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/db-viewer?action=list&pattern=${encodeURIComponent(searchPattern)}`);
      const data = await response.json();
      
      if (data.success) {
        setKeys(data.keys);
      } else {
        setError(data.message || 'Failed to fetch keys');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchKeyData = async (key: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/db-viewer?action=get&key=${encodeURIComponent(key)}`);
      const data = await response.json();
      
      if (data.success) {
        setKeyData(data);
        setSelectedKey(key);
      } else {
        setError(data.message || 'Failed to fetch key data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleSearch = () => {
    fetchKeys(pattern);
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  return (
    <>
      <Head>
        <title>Database Viewer - Alby LSP Price Board</title>
      </Head>
      
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h1 className="text-2xl font-bold text-gray-900">Database Viewer</h1>
              <p className="text-sm text-gray-600 mt-1">Visual interface for Vercel KV (Redis) database</p>
            </div>

            <div className="p-6">
              {/* Search Controls */}
              <div className="mb-6">
                <div className="flex space-x-4">
                  <div className="flex-1">
                    <label htmlFor="pattern" className="block text-sm font-medium text-gray-700 mb-2">
                      Key Pattern
                    </label>
                    <input
                      type="text"
                      id="pattern"
                      value={pattern}
                      onChange={(e) => setPattern(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="alby:lsp:*"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleSearch}
                      disabled={loading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Searching...' : 'Search'}
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Keys List */}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Keys ({keys.length})
                  </h2>
                  <div className="border border-gray-200 rounded-md max-h-96 overflow-y-auto">
                    {keys.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        No keys found
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-200">
                        {keys.map((keyInfo, index) => (
                          <div
                            key={index}
                            className={`p-3 cursor-pointer hover:bg-gray-50 ${
                              selectedKey === keyInfo.key ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                            }`}
                            onClick={() => fetchKeyData(keyInfo.key)}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {keyInfo.key}
                                </p>
                                <div className="flex space-x-4 mt-1">
                                  <span className="text-xs text-gray-500">
                                    Type: {keyInfo.type}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    TTL: {keyInfo.ttl}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Key Data */}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Key Data
                    {selectedKey && (
                      <span className="text-sm font-normal text-gray-500 ml-2">
                        ({selectedKey})
                      </span>
                    )}
                  </h2>
                  
                  {keyData ? (
                    <div className="border border-gray-200 rounded-md">
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700">
                            Type: {keyData.type}
                          </span>
                        </div>
                      </div>
                      <div className="p-4">
                        <pre className="text-xs text-gray-800 whitespace-pre-wrap overflow-x-auto">
                          {formatValue(keyData.data)}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-md p-8 text-center text-gray-500">
                      Select a key to view its data
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Actions</h3>
                <div className="flex space-x-4">
                  <button
                    onClick={() => fetchKeys('alby:lsp:history:*')}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    View History Keys
                  </button>
                  <button
                    onClick={() => fetchKeys('alby:lsp:channel:*')}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    View Current Keys
                  </button>
                  <button
                    onClick={() => fetchKeys('alby:lsp:*')}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    View All Keys
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
