import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { Shield, User, LogOut, Database, FileImage, Search } from 'lucide-react';
import FeatureLibrary from './components/FeatureLibrary.jsx';
import SketchCanvas from './components/SketchCanvas.jsx';
import SketchManager from './components/SketchManager.jsx';
import MatchResults from './components/MatchResults.jsx';
import AuthModal from './components/AuthModal.jsx';
import SuspectDatabase from './components/SuspectDatabase.jsx';
import MatchHistory from './components/MatchHistory.jsx'; // Add this import
import api from './config/database.js';

function App() {
  const [activeTab, setActiveTab] = useState('compose');
  const [placedFeatures, setPlacedFeatures] = useState([]);
  const [showMatchResults, setShowMatchResults] = useState(false);
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentSketchId, setCurrentSketchId] = useState(null);

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
          setUser(userData);
        } else {
          localStorage.removeItem('auth_token');
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFeatureDrop = (e) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    if (!data) return;

    const feature = JSON.parse(data);
    const canvas = e.currentTarget.getBoundingClientRect();

    const x = e.clientX - canvas.left - canvas.width / 2;
    const y = e.clientY - canvas.top - canvas.height / 2;

    const newFeature = {
      id: `${feature.id}-${Date.now()}`,
      type: feature.type,
      src: feature.src,
      x,
      y,
      scale: 1,
      rotation: 0
    };

    setPlacedFeatures([...placedFeatures, newFeature]);
  };
const handleSave = async (caseReference, witnessNotes) => {
  if (!user) {
    alert('Please sign in to save sketches');
    return false;
  }

  if (!caseReference || !caseReference.trim()) {
    alert('Please enter a case reference number');
    return false;
  }

  if (placedFeatures.length === 0) {
    alert('Please add at least one feature to the sketch');
    return false;
  }

  try {
    // Capture canvas as image
    const canvasElement = document.getElementById('sketch-canvas-main');
    if (!canvasElement) {
      alert('Could not find canvas element');
      return false;
    }

    // Import html2canvas dynamically
    const html2canvas = (await import('html2canvas')).default;
    
    const canvas = await html2canvas(canvasElement, {
      backgroundColor: null,
      logging: false,
      useCORS: true,
      scale: 2
    });

    const imageData = canvas.toDataURL('image/png');

    const token = localStorage.getItem('auth_token');
    const response = await fetch('http://localhost:3001/api/sketches', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        case_reference: caseReference,
        witness_notes: witnessNotes,
        features_data: placedFeatures,
        image_data: imageData, // Send image data to backend
        total_features: placedFeatures.length
      })
    });

    if (response.ok) {
      const data = await response.json();
      setCurrentSketchId(data.sketch.id);
      
      // Download the image locally too
      const link = document.createElement('a');
      link.download = `${caseReference.trim().replace(/\s+/g, '-')}-${Date.now()}.png`;
      link.href = imageData;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      alert(`Sketch saved successfully!\nSketch ID: ${data.sketch.id}\nImage saved to server.`);
      return true;
    } else {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to save sketch');
    }
  } catch (error) {
    console.error('Error saving sketch:', error);
    alert(`Failed to save sketch: ${error.message}`);
    return false;
  }
};

// Add this function to download canvas image
const downloadCanvasImage = (caseReference) => {
  const canvasElement = document.getElementById('sketch-canvas-main');
  if (!canvasElement) {
    console.warn('Canvas element not found for download');
    return;
  }

  // Use html2canvas to capture the canvas
  import('html2canvas').then(({ default: html2canvas }) => {
    html2canvas(canvasElement, {
      backgroundColor: null,
      logging: false,
      useCORS: true,
      scale: 2
    }).then(canvas => {
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${caseReference.trim().replace(/\s+/g, '-')}-${Date.now()}.png`;
      link.href = image;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  });
};

const handleMatch = async () => {
  if (placedFeatures.length === 0) {
    alert('Please add features to the sketch before matching');
    return;
  }

  console.log('Starting criminal sketch matching...');

  try {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      alert('Please sign in to match sketches');
      return;
    }

    // Use the correct endpoint
    const response = await fetch('http://localhost:3001/api/criminal-sketches/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        features: placedFeatures
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Criminal match response:', data);

    if (data.success) {
      // Store match data
      localStorage.setItem('last_match_data', JSON.stringify(data));
      
      // Update current sketch ID
      if (data.your_sketch?.id) {
        setCurrentSketchId(data.your_sketch.id);
      }
      
      // Show match results
      setShowMatchResults(true);
      
    } else {
      alert(`❌ Criminal match failed: ${data.error}`);
    }
    
  } catch (error) {
    console.error('Error matching with criminal database:', error);
    alert(`❌ Criminal Database Error!\n\nPlease make sure:\n1. Backend server is running\n2. You are signed in\n3. Database is connected\n\nError: ${error.message}`);
  }
};

  const handleSignOut = async () => {
    localStorage.removeItem('auth_token');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <header className="bg-slate-900 border-b border-slate-800 shadow-lg">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Forensic Face Sketch System</h1>
                <p className="text-xs text-slate-400">Law Enforcement Composite & Identification Platform</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {user ? (
                <>
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg border border-slate-700">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-300">{user.email}</span>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <User className="w-4 h-4" />
                  Sign In
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setActiveTab('compose')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === 'compose'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
              }`}
            >
              <FileImage className="w-4 h-4" />
              Compose Sketch
            </button>
            <button
              onClick={() => setActiveTab('database')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === 'database'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
              }`}
            >
              <Database className="w-4 h-4" />
              Suspect Database
            </button>
            <button
              onClick={() => setActiveTab('matches')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === 'matches'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
              }`}
            >
              <Search className="w-4 h-4" />
              Match History
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        {activeTab === 'compose' ? (
          <div className="h-full grid grid-cols-12 gap-0">
            <div className="col-span-3 border-r border-slate-800">
              <FeatureLibrary onFeatureDragStart={() => {}} />
            </div>

            <div className="col-span-6 border-r border-slate-800">
              <SketchCanvas
                placedFeatures={placedFeatures}
                onUpdateFeatures={setPlacedFeatures}
                onDrop={handleFeatureDrop}
                canvasId="sketch-canvas-main"
              />
            </div>

            <div className="col-span-3">
              <SketchManager
                currentSketch={{ features: placedFeatures, id: currentSketchId }}
                onSave={handleSave}
                onMatch={handleMatch}
                canvasId="sketch-canvas-main"
              />
            </div>
          </div>
        ) : activeTab === 'database' ? (
          <SuspectDatabase />
        ) : (
          <MatchHistory />
        )}
      </main>

     {showMatchResults && (
  <MatchResults
    onClose={() => setShowMatchResults(false)}
  />
)}

      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={(userData) => {
            setUser(userData);
            setShowAuthModal(false);
          }}
        />
      )}
    </div>
  );
}

export default App;