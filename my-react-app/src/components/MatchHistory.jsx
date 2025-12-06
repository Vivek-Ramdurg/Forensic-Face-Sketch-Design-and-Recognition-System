import { useState, useEffect } from 'react';
import { Clock, Search, Filter, Eye, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

export default function MatchHistory() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadMatchHistory();
  }, [searchTerm, statusFilter]);

  const loadMatchHistory = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch('http://localhost:3001/api/sketches', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // For now, use mock data
        const mockMatches = [
          {
            id: '1',
            sketch_id: 'SK-2024-001',
            case_reference: 'CASE-2024-001',
            suspect_name: 'Marcus Johnson',
            confidence_score: 92,
            match_date: '2024-01-15 14:30',
            status: 'confirmed',
            features_matched: 8
          },
          {
            id: '2',
            sketch_id: 'SK-2024-002',
            case_reference: 'CASE-2024-002',
            suspect_name: 'Sarah Chen',
            confidence_score: 85,
            match_date: '2024-01-14 11:20',
            status: 'reviewed',
            features_matched: 7
          },
          {
            id: '3',
            sketch_id: 'SK-2024-003',
            case_reference: 'CASE-2024-003',
            suspect_name: 'David Miller',
            confidence_score: 78,
            match_date: '2024-01-13 16:45',
            status: 'pending',
            features_matched: 6
          },
          {
            id: '4',
            sketch_id: 'SK-2024-004',
            case_reference: 'CASE-2024-004',
            suspect_name: 'Alex Rodriguez',
            confidence_score: 95,
            match_date: '2024-01-12 09:15',
            status: 'confirmed',
            features_matched: 9
          },
          {
            id: '5',
            sketch_id: 'SK-2024-005',
            case_reference: 'CASE-2024-005',
            suspect_name: 'Emily Wilson',
            confidence_score: 88,
            match_date: '2024-01-11 13:40',
            status: 'reviewed',
            features_matched: 7
          }
        ];
        
        // Apply filters
        let filtered = mockMatches;
        if (searchTerm) {
          filtered = filtered.filter(match => 
            match.sketch_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            match.case_reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
            match.suspect_name.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }
        if (statusFilter !== 'all') {
          filtered = filtered.filter(match => match.status === statusFilter);
        }
        
        setMatches(filtered);
      }
    } catch (error) {
      console.error('Error loading match history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': 
        return 'bg-green-900/30 text-green-400 border-green-800';
      case 'reviewed': 
        return 'bg-blue-900/30 text-blue-400 border-blue-800';
      case 'pending': 
        return 'bg-yellow-900/30 text-yellow-400 border-yellow-800';
      case 'rejected': 
        return 'bg-red-900/30 text-red-400 border-red-800';
      default: 
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'confirmed': return <CheckCircle className="w-4 h-4" />;
      case 'reviewed': return <Eye className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getConfidenceColor = (score) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 80) return 'text-yellow-400';
    if (score >= 70) return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <div className="h-full bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Match History</h2>
          <p className="text-slate-400">Review past sketch matches and identifications</p>
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
                  placeholder="Search by sketch ID, case reference, or suspect name..."
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
                    <option value="confirmed">Confirmed</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="pending">Pending</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                
                <button
                  onClick={loadMatchHistory}
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
                <p className="text-slate-400">Loading match history...</p>
              </div>
            ) : matches.length === 0 ? (
              <div className="p-12 text-center">
                <AlertCircle className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 mb-2">No matches found</p>
                <p className="text-sm text-slate-500">
                  {searchTerm ? 'Try a different search term' : 'No match history available'}
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-800 border-b border-slate-700">
                    <th className="py-3 px-4 text-left text-slate-400 font-medium text-sm">Sketch & Case</th>
                    <th className="py-3 px-4 text-left text-slate-400 font-medium text-sm">Suspect Match</th>
                    <th className="py-3 px-4 text-left text-slate-400 font-medium text-sm">Confidence</th>
                    <th className="py-3 px-4 text-left text-slate-400 font-medium text-sm">Date & Time</th>
                    <th className="py-3 px-4 text-left text-slate-400 font-medium text-sm">Status</th>
                    <th className="py-3 px-4 text-left text-slate-400 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((match) => (
                    <tr key={match.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <div className="font-mono text-sm text-white">{match.sketch_id}</div>
                          <div className="text-xs text-slate-400">{match.case_reference}</div>
                          <div className="text-xs text-slate-500">
                            {match.features_matched} features matched
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-medium text-white">{match.suspect_name}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-24 bg-slate-800 rounded-full h-2">
                            <div 
                              className="h-2 rounded-full" 
                              style={{ 
                                width: `${match.confidence_score}%`,
                                backgroundColor: match.confidence_score >= 90 ? '#10b981' : 
                                               match.confidence_score >= 80 ? '#f59e0b' : 
                                               match.confidence_score >= 70 ? '#f97316' : '#ef4444'
                              }}
                            ></div>
                          </div>
                          <span className={`text-sm font-bold ${getConfidenceColor(match.confidence_score)}`}>
                            {match.confidence_score}%
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                          <Clock className="w-4 h-4" />
                          {match.match_date}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border ${getStatusColor(match.status)}`}>
                          {getStatusIcon(match.status)}
                          <span className="text-xs font-medium capitalize">
                            {match.status}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 rounded-lg transition-colors">
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="p-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-400">
                Showing {matches.length} match{matches.length !== 1 ? 'es' : ''}
              </div>
              <div className="text-sm text-slate-400">
                {/* Pagination would go here */}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Total Matches</span>
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div className="text-2xl font-bold text-white">24</div>
            <div className="text-xs text-slate-500 mt-1">Across all sketches</div>
          </div>

          <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Confirmed IDs</span>
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div className="text-2xl font-bold text-white">8</div>
            <div className="text-xs text-slate-500 mt-1">Positive identifications</div>
          </div>

          <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Avg. Confidence</span>
              <Eye className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white">82%</div>
            <div className="text-xs text-slate-500 mt-1">Across all matches</div>
          </div>

          <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Success Rate</span>
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="text-2xl font-bold text-white">76%</div>
            <div className="text-xs text-slate-500 mt-1">Matches leading to IDs</div>
          </div>
        </div>
      </div>
    </div>
  );
}