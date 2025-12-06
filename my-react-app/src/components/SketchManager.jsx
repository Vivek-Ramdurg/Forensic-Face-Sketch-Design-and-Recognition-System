import { useState, useEffect } from 'react';
import { Save, FileText, Search, AlertCircle } from 'lucide-react';
import html2canvas from 'html2canvas';

export default function SketchManager({ currentSketch, onSave, onMatch, canvasId }) {
  const [caseReference, setCaseReference] = useState('');
  const [witnessNotes, setWitnessNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [isMatching, setIsMatching] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        const response = await fetch('http://localhost:3001/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const userData = await response.json();
          setUser(userData.user);
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    }
  };

  const handleSave = async () => {
    setError('');
    
    if (!caseReference.trim()) {
      setError('Please enter a case reference number');
      return;
    }

    if (currentSketch.features.length === 0) {
      setError('Please add at least one feature to the sketch');
      return;
    }

    if (!user) {
      setError('Please sign in to save sketches');
      return;
    }

    const canvasElement = document.getElementById(canvasId);
    if (!canvasElement) {
      setError('Could not find the sketch canvas to save.');
      return;
    }

    setIsSaving(true);
    try {
      // Capture canvas as image
      const canvas = await html2canvas(canvasElement, {
        backgroundColor: null,
        logging: false,
        useCORS: true,
        scale: 2 // Higher resolution
      });
      
      const image = canvas.toDataURL('image/png');
      
      // Create download link
      const link = document.createElement('a');
      link.download = `${caseReference.trim().replace(/\s+/g, '-')}-sketch-${Date.now()}.png`;
      link.href = image;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Call the parent's onSave function to save to database
      const success = await onSave(caseReference, witnessNotes);
      
      if (success) {
        // Clear form after successful save
        setCaseReference('');
        setWitnessNotes('');
        setError('');
      }
    } catch (error) {
      console.error('Error saving sketch:', error);
      setError('Failed to save sketch: ' + (error?.message || String(error)));
    } finally {
      setIsSaving(false);
    }
  };

const handleMatch = async () => {
  setError('');
  
  if (currentSketch.features.length === 0) {
    setError('Please add features to the sketch before matching');
    return;
  }

  if (!user) {
    setError('Please sign in to match sketches');
    return;
  }

  setIsMatching(true);
  try {
    await onMatch();
  } catch (error) {
    console.error('Error matching sketch:', error);
    setError('Failed to match sketch: ' + (error?.message || String(error)));
  } finally {
    setIsMatching(false);
  }
};


  

  return (
    <div className="flex flex-col h-full bg-slate-900">
      <div className="bg-slate-800 px-4 py-3 border-b border-slate-700">
        <h3 className="text-white font-semibold">Sketch Details</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Case Reference *
          </label>
          <input
            type="text"
            value={caseReference}
            onChange={(e) => setCaseReference(e.target.value)}
            placeholder="e.g., CASE-2024-001"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-500 mt-1">
            Required for official documentation
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Witness Notes
          </label>
          <textarea
            value={witnessNotes}
            onChange={(e) => setWitnessNotes(e.target.value)}
            placeholder="Additional descriptions, distinguishing features, clothing, voice characteristics, etc."
            rows={6}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <p className="text-xs text-slate-500 mt-1">
            Optional: Any additional information from witnesses
          </p>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-300">Sketch Statistics</span>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Features placed:</span>
              <span className="text-white font-medium bg-slate-700 px-2 py-1 rounded">
                {currentSketch.features.length}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Sketch status:</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                currentSketch.features.length > 0 
                  ? 'bg-green-900/30 text-green-400' 
                  : 'bg-yellow-900/30 text-yellow-400'
              }`}>
                {currentSketch.features.length > 0 ? 'Ready' : 'In Progress'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Last saved:</span>
              <span className="text-slate-400 text-xs">
                {currentSketch.id ? 'Saved to database' : 'Not saved yet'}
              </span>
            </div>
          </div>
        </div>

        {currentSketch.id && (
          <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-300">Sketch Information</span>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-blue-400">Sketch ID:</span>
                <span className="text-white font-mono text-xs">{currentSketch.id}</span>
              </div>
              <p className="text-xs text-blue-400 mt-2">
                This sketch has been saved to the database. You can now match it with suspects.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-slate-800 border-t border-slate-700 space-y-3">
        <button
          onClick={handleSave}
          disabled={isSaving || !user}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Save Sketch'}
        </button>

       <button
  onClick={handleMatch}
  disabled={currentSketch.features.length === 0 || !user || isMatching}
  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
>
  {isMatching ? (
    <>
      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
      Matching...
    </>
  ) : (
    <>
      <Search className="w-4 h-4" />
      Match with Database
    </>
  )}
</button>
        {!user && (
          <div className="bg-yellow-900/30 border border-yellow-800 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-400" />
              <p className="text-xs text-yellow-300">
                Sign in to save and match sketches
              </p>
            </div>
          </div>
        )}

        {user && !currentSketch.id && currentSketch.features.length > 0 && (
          <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-3">
            <p className="text-xs text-blue-300 text-center">
              Save the sketch first before matching with database
            </p>
          </div>
        )}
      </div>
    </div>
  );
}