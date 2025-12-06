import { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle, FileText, Calendar, Shield, User, Eye, Download, Link, MapPin, Clock } from 'lucide-react';
import SketchViewer from './SketchViewer';

export default function MatchResults({ onClose }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newSketchInfo, setNewSketchInfo] = useState({ id: '', case: '' });
  const [viewingSketchId, setViewingSketchId] = useState(null);

  useEffect(() => {
    loadMatchData();
  }, []);

  const loadMatchData = async () => {
    setLoading(true);
    try {
      const matchData = JSON.parse(localStorage.getItem('last_match_data') || '{}');
      
      if (matchData.success && matchData.matches && matchData.matches.length > 0) {
        // Filter to show only cases (not sketches) and remove any sketch references
        const criminalCases = matchData.matches.filter(match => {
          const caseRef = match.case_reference || '';
          const isCriminalCase = caseRef.startsWith('CASE-');
          const isNotSketch = !caseRef.includes('SKETCH-') && !caseRef.includes('sketch-');
          return isCriminalCase && isNotSketch;
        });
        
        setMatches(criminalCases);
        setNewSketchInfo({
          id: matchData.your_sketch?.id || '',
          case: matchData.your_sketch?.case_reference || ''
        });
        
        if (criminalCases.length === 0) {
          setError('No matching criminal cases found. Your sketch appears unique.');
        }
      } else {
        setMatches([]);
        setError('No criminal matches found. Database may be empty.');
      }
    } catch (error) {
      console.error('Error loading match data:', error);
      setError('Failed to load criminal case matches');
      setMatches([]);
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (score) => {
    if (score >= 85) return 'bg-gradient-to-r from-green-900/40 to-green-800/20 border-green-700';
    if (score >= 75) return 'bg-gradient-to-r from-yellow-900/40 to-yellow-800/20 border-yellow-700';
    return 'bg-gradient-to-r from-red-900/40 to-red-800/20 border-red-700';
  };

  const getConfidenceTextColor = (score) => {
    if (score >= 85) return 'text-green-400';
    if (score >= 75) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getStatusColor = (status) => {
    if (!status) return 'bg-slate-800 text-slate-400 border-slate-700';
    
    const statusLower = status.toLowerCase();
    if (statusLower.includes('solved') || statusLower.includes('closed')) {
      return 'bg-green-900/30 text-green-400 border-green-800';
    } else if (statusLower.includes('active') || statusLower.includes('investigation')) {
      return 'bg-blue-900/30 text-blue-400 border-blue-800';
    } else if (statusLower.includes('pending') || statusLower.includes('evidence') || statusLower.includes('review')) {
      return 'bg-yellow-900/30 text-yellow-400 border-yellow-800';
    } else if (statusLower.includes('warrant') || statusLower.includes('identified')) {
      return 'bg-purple-900/30 text-purple-400 border-purple-800';
    } else if (statusLower.includes('court') || statusLower.includes('proceeding')) {
      return 'bg-indigo-900/30 text-indigo-400 border-indigo-800';
    }
    return 'bg-slate-800 text-slate-400 border-slate-700';
  };

  const handleViewSketch = (caseId) => {
    if (caseId) {
      alert(`Criminal Case: ${caseId}\n\nFull case details would be available in the police database.`);
    }
  };

  const handleDownloadReport = () => {
    const reportData = {
      your_sketch_id: newSketchInfo.id,
      your_case_reference: newSketchInfo.case,
      match_count: matches.length,
      matches: matches.map(match => ({
        criminal_case: match.case_reference,
        crime_type: match.criminal_details?.crime_type || 'Unknown',
        confidence_score: match.confidence_score,
        location: match.criminal_details?.location || 'Unknown',
        investigating_officer: match.criminal_details?.investigating_officer || 'Unknown',
        department: match.criminal_details?.department || 'Unknown',
        status: match.criminal_details?.status || 'Unknown'
      })),
      generated_at: new Date().toISOString(),
      notes: 'Forensic Sketch Matching Report - Confidential'
    };
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `criminal-match-report-${newSketchInfo.id || 'unknown'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const refreshMatches = async () => {
    setLoading(true);
    setTimeout(() => {
      loadMatchData();
    }, 1000);
  };

  // Show SketchViewer if viewing a sketch
  if (viewingSketchId) {
    return (
      <SketchViewer
        sketchId={viewingSketchId}
        onClose={() => setViewingSketchId(null)}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-700 shadow-2xl">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-blue-900/20">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-900/30 rounded-lg">
                  <FileText className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Criminal Case Matches</h3>
                  <p className="text-slate-400 text-sm">
                    {newSketchInfo.case ? `Your Sketch: ${newSketchInfo.case}` : 'New Composite Sketch'}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && !loading && (
            <div className="mb-4 bg-red-900/30 border border-red-800 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-red-300">{error}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-16">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-6"></div>
              <p className="text-slate-400 text-lg">Searching criminal database...</p>
              <p className="text-slate-500 text-sm mt-2">Comparing with known criminal patterns</p>
            </div>
          ) : matches.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-slate-800/50 rounded-xl p-8 max-w-md mx-auto">
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-6" />
                <h4 className="text-xl font-semibold text-white mb-2">No Criminal Matches Found</h4>
                <p className="text-slate-400 mb-4">
                  Your sketch does not match any known criminal cases in our database.
                </p>
                <div className="bg-slate-900/50 rounded-lg p-4 text-sm text-slate-300">
                  <p className="mb-2">✅ This could mean:</p>
                  <ul className="list-disc list-inside space-y-1 text-left">
                    <li>New criminal pattern detected</li>
                    <li>Suspect not previously documented</li>
                    <li>Unique facial characteristics</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Summary Card */}
              <div className="bg-slate-800/50 rounded-xl p-6 mb-6 border border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-2">Match Summary</h4>
                    <div className="flex items-center gap-6 text-sm">
                      <div>
                        <div className="text-slate-400">Criminal Cases Found</div>
                        <div className="text-2xl font-bold text-white">{matches.length}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">Highest Match</div>
                        <div className={`text-2xl font-bold ${getConfidenceTextColor(matches[0]?.confidence_score || 0)}`}>
                          {matches[0]?.confidence_score || 0}%
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400">Your Sketch ID</div>
                        <div className="text-white font-mono">{newSketchInfo.id?.substring(0, 12) || 'N/A'}</div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-400 text-sm">Database Search</div>
                    <div className="text-slate-300">Complete</div>
                  </div>
                </div>
              </div>

              {/* Criminal Cases Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {matches.map((match) => (
                  <div
                    key={match.match_id}
                    className={`bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl border ${
                      match.confidence_score >= 85 
                        ? 'border-green-800/50 hover:border-green-700/70' 
                        : match.confidence_score >= 75
                        ? 'border-yellow-800/50 hover:border-yellow-700/70'
                        : 'border-red-800/50 hover:border-red-700/70'
                    } transition-all duration-300 hover:shadow-xl`}
                  >
                    {/* Case Header */}
                    <div className={`p-6 border-b ${getConfidenceColor(match.confidence_score)}`}>
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`p-2 rounded-lg ${getConfidenceColor(match.confidence_score)}`}>
                              <Shield className={`w-5 h-5 ${getConfidenceTextColor(match.confidence_score)}`} />
                            </div>
                            <div>
                              <h4 className="text-lg font-bold text-white">
                                {match.case_reference}
                              </h4>
                              <p className="text-slate-300 text-sm">
                                {match.criminal_details?.crime_type || 'Criminal Case'} • {match.criminal_details?.location || 'Various Locations'}
                              </p>
                            </div>
                          </div>
                          
                          {/* Case Status Badge */}
                          <div className="flex items-center gap-2 mt-3">
                            <span className={`px-3 py-1 text-xs rounded-full border ${getStatusColor(match.criminal_details?.status)}`}>
                              {match.criminal_details?.status || 'Under Investigation'}
                            </span>
                            <span className="text-xs text-slate-400">
                              {match.criminal_details?.department || 'Major Crimes'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className={`text-4xl font-bold ${getConfidenceTextColor(match.confidence_score)} mb-1`}>
                            {match.confidence_score}%
                          </div>
                          <div className="text-xs text-slate-400">
                            Match Confidence
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Case Details */}
                    <div className="p-6">
                      {/* Description */}
                      <div className="mb-4">
                        <p className="text-slate-300 text-sm mb-3">
                          {match.criminal_details?.description || 'Criminal activity involving similar facial characteristics.'}
                        </p>
                        
                        {/* Investigation Details */}
                        <div className="bg-slate-900/30 rounded-lg p-3 mb-4">
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3 h-3 text-slate-500" />
                              <span className="text-slate-400">Date:</span>
                              <span className="text-slate-300">
                                {match.criminal_details?.created_at 
                                  ? new Date(match.criminal_details.created_at).toLocaleDateString()
                                  : 'Multiple dates'
                                }
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <User className="w-3 h-3 text-slate-500" />
                              <span className="text-slate-400">Investigator:</span>
                              <span className="text-slate-300">{match.criminal_details?.investigating_officer || 'Assigned Detective'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Shield className="w-3 h-3 text-slate-500" />
                              <span className="text-slate-400">Department:</span>
                              <span className="text-slate-300">{match.criminal_details?.department || 'Major Crimes'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3 h-3 text-slate-500" />
                              <span className="text-slate-400">Location:</span>
                              <span className="text-slate-300">{match.criminal_details?.location || 'Various'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Feature Matches */}
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-3">
                            <CheckCircle className="w-4 h-4 text-blue-400" />
                            <h5 className="font-semibold text-white text-sm">Matching Features</h5>
                          </div>
                          
                          <div className="grid grid-cols-4 gap-2">
                            {match.matching_features && Object.entries(match.matching_features)
                              .filter(([_, score]) => score > 0)
                              .map(([feature, score]) => (
                                <div key={feature} className="text-center">
                                  <div className="bg-slate-800 rounded-lg p-2">
                                    <div className={`text-sm font-bold ${
                                      score >= 85 ? 'text-green-400' :
                                      score >= 75 ? 'text-yellow-400' : 'text-red-400'
                                    }`}>
                                      {score}%
                                    </div>
                                    <div className="text-xs text-slate-400 capitalize mt-1">
                                      {feature.replace('_', ' ')}
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleViewSketch(match.matched_case_id)}
                            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                          >
                            <Eye className="w-4 h-4" />
                            View Case Details
                          </button>
                          <button
                            onClick={() => alert(`Added ${match.case_reference} to your investigation`)}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
                            title="Add to Investigation"
                          >
                            <Link className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-slate-800 bg-slate-900/80">
          <div className="flex items-center justify-between">
            <div className="text-slate-400 text-sm">
              {matches.length > 0 ? (
                <>
                  Found {matches.length} criminal case matches • {new Date().toLocaleDateString()}
                </>
              ) : (
                'Forensic Sketch Analysis Complete'
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={refreshMatches}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-sm flex items-center gap-2"
              >
                <Clock className="w-4 h-4" />
                Refresh
              </button>
              <button
                onClick={handleDownloadReport}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-sm flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export Report
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                Close Results
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}