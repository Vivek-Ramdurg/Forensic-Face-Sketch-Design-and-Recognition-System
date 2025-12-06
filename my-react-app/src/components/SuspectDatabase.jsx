import { useState, useEffect } from 'react';
import { Search, User, Filter, Eye, Download, AlertCircle } from 'lucide-react';

export default function SuspectDatabase() {
  const [suspects, setSuspects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    loadSuspects();
  }, [searchTerm, statusFilter, currentPage]);

  const loadSuspects = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const queryParams = new URLSearchParams({
        search: searchTerm,
        ...(statusFilter !== 'all' && { status: statusFilter }),
        page: currentPage,
        limit: itemsPerPage
      });

      const response = await fetch(`http://localhost:3001/api/suspects?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSuspects(data.suspects || []);
      }
    } catch (error) {
      console.error('Error loading suspects:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-red-100 text-red-800';
      case 'apprehended': return 'bg-green-100 text-green-800';
      case 'at_large': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'active': return 'Active Investigation';
      case 'apprehended': return 'Apprehended';
      case 'at_large': return 'At Large';
      default: return status;
    }
  };

  const handleExport = () => {
    alert('Export functionality would be implemented here');
  };

  return (
    <div className="h-full bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Suspect Database</h2>
          <p className="text-slate-400">Browse and search through registered suspects</p>
        </div>

        <div className="bg-slate-900 rounded-lg border border-slate-800 mb-6">
          <div className="p-6 border-b border-slate-800">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, case number, or alias..."
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="apprehended">Apprehended</option>
                    <option value="at_large">At Large</option>
                  </select>
                </div>

                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>

                <button
                  onClick={loadSuspects}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                <p className="text-slate-400">Loading suspects...</p>
              </div>
            ) : suspects.length === 0 ? (
              <div className="p-12 text-center">
                <AlertCircle className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 mb-2">No suspects found</p>
                <p className="text-sm text-slate-500">
                  {searchTerm ? 'Try a different search term' : 'No suspects in database yet'}
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-800 border-b border-slate-700">
                    <th className="py-3 px-4 text-left text-slate-400 font-medium text-sm">Suspect</th>
                    <th className="py-3 px-4 text-left text-slate-400 font-medium text-sm">Case Info</th>
                    <th className="py-3 px-4 text-left text-slate-400 font-medium text-sm">Physical</th>
                    <th className="py-3 px-4 text-left text-slate-400 font-medium text-sm">Status</th>
                    <th className="py-3 px-4 text-left text-slate-400 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {suspects.map((suspect) => (
                    <tr key={suspect.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-700">
                            {suspect.photo_url ? (
                              <img
                                src={suspect.photo_url}
                                alt={suspect.full_name}
                                className="w-full h-full object-cover rounded-lg"
                              />
                            ) : (
                              <User className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-white">{suspect.full_name}</div>
                            <div className="text-xs text-slate-400">
                              {suspect.aliases?.length > 0 && `AKA: ${suspect.aliases.join(', ')}`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <div className="text-sm text-white font-mono">{suspect.case_number}</div>
                          {suspect.last_known_location && (
                            <div className="text-xs text-slate-400">{suspect.last_known_location}</div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <div className="text-sm text-slate-300">
                            {suspect.age && `${suspect.age}y`}
                            {suspect.gender && ` • ${suspect.gender}`}
                          </div>
                          <div className="text-xs text-slate-400">
                            {suspect.eye_color && `Eyes: ${suspect.eye_color}`}
                            {suspect.hair_color && ` • Hair: ${suspect.hair_color}`}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(suspect.status)}`}>
                          {getStatusLabel(suspect.status)}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 rounded-lg transition-colors">
                            Match
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="p-4 border-t border-slate-800 flex items-center justify-between">
            <div className="text-sm text-slate-400">
              Showing {suspects.length} suspects
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-slate-800 disabled:bg-slate-900 disabled:text-slate-600 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 text-sm text-slate-300">
                Page {currentPage}
              </span>
              <button
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-900/30 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">24</div>
                <div className="text-sm text-slate-400">Total Suspects</div>
              </div>
            </div>
            <div className="text-xs text-slate-500">Registered in database</div>
          </div>

          <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-900/30 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">18</div>
                <div className="text-sm text-slate-400">Active Cases</div>
              </div>
            </div>
            <div className="text-xs text-slate-500">Under investigation</div>
          </div>

          <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-900/30 rounded-lg flex items-center justify-center">
                <Eye className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">6</div>
                <div className="text-sm text-slate-400">Apprehended</div>
              </div>
            </div>
            <div className="text-xs text-slate-500">Successfully identified</div>
          </div>
        </div>
      </div>
    </div>
  );
}