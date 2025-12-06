import { useState, useEffect } from 'react';
import { X, Download, Printer, Share2, ZoomIn, ZoomOut, RotateCcw, User, Calendar, FileText, MapPin } from 'lucide-react';

export default function SketchViewer({ sketchId, onClose }) {
  const [sketch, setSketch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (sketchId) {
      loadSketch();
    }
  }, [sketchId]);

  const loadSketch = async () => {
    try {
      setLoading(true);
      setError('');
      
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`http://localhost:3001/api/sketches/${sketchId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load sketch');
      }

      const data = await response.json();
      setSketch(data.sketch);
      
    } catch (error) {
      console.error('Error loading sketch:', error);
      setError(error.message);
      // Create mock data for demo
      setSketch({
        id: sketchId,
        case_reference: `CASE-${sketchId.substring(0, 8).toUpperCase()}`,
        image_url: null,
        features_data: [],
        created_at: new Date().toISOString(),
        officer_name: 'Detective Smith',
        department: 'Robbery Division',
        witness_notes: 'Witness described suspect with distinctive features.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!sketch?.image_url) {
      alert('No image available for download');
      return;
    }

    const link = document.createElement('a');
    link.href = sketch.image_url;
    link.download = `${sketch.case_reference || 'sketch'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Sketch: ${sketch?.case_reference || 'Unknown'}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .sketch-img { max-width: 100%; height: auto; border: 1px solid #ccc; }
            .details { margin-top: 20px; }
            .section { margin-bottom: 15px; }
            .label { font-weight: bold; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Forensic Sketch Report</h1>
            <h2>Case: ${sketch?.case_reference || 'Unknown'}</h2>
          </div>
          ${sketch?.image_url ? `<img src="${sketch.image_url}" class="sketch-img" alt="Sketch">` : '<p>No image available</p>'}
          <div class="details">
            <div class="section">
              <div class="label">Generated On:</div>
              <div>${new Date(sketch?.created_at).toLocaleDateString()}</div>
            </div>
            <div class="section">
              <div class="label">Officer:</div>
              <div>${sketch?.officer_name || 'Unknown'}</div>
            </div>
            <div class="section">
              <div class="label">Department:</div>
              <div>${sketch?.department || 'Unknown'}</div>
            </div>
            ${sketch?.witness_notes ? `
            <div class="section">
              <div class="label">Witness Notes:</div>
              <div>${sketch.witness_notes}</div>
            </div>
            ` : ''}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 rounded-xl p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-300">Loading sketch...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col border border-slate-700 shadow-2xl">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-blue-900/20">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">
                {sketch?.case_reference || 'Unknown Case'}
              </h2>
              <div className="flex items-center gap-4 text-sm text-slate-400 mt-2">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(sketch?.created_at).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {sketch?.officer_name || 'Unknown Officer'}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {sketch?.department || 'Unknown Department'}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 mb-6">
              <p className="text-red-300">{error} (Showing demo view)</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Sketch Image */}
            <div className="lg:col-span-2">
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Composite Sketch</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setZoom(prev => Math.max(0.5, prev - 0.1))}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-slate-400">{Math.round(zoom * 100)}%</span>
                    <button
                      onClick={() => setZoom(prev => Math.min(3, prev + 0.1))}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setRotation(prev => (prev + 90) % 360)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="bg-black rounded-lg p-6 flex items-center justify-center min-h-[400px]">
                  {sketch?.image_url ? (
                    <img
                      src={sketch.image_url}
                      alt="Composite Sketch"
                      className="max-w-full max-h-[500px] transition-all duration-300"
                      style={{
                        transform: `scale(${zoom}) rotate(${rotation}deg)`,
                        transformOrigin: 'center'
                      }}
                    />
                  ) : (
                    <div className="text-center">
                      <FileText className="w-32 h-32 text-slate-600 mx-auto mb-4" />
                      <p className="text-slate-400">No image available for this sketch</p>
                      <p className="text-sm text-slate-500 mt-2">
                        Sketch ID: {sketchId?.substring(0, 8)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Details Panel */}
            <div className="space-y-6">
              {/* Actions */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Actions</h3>
                <div className="space-y-3">
                  <button
                    onClick={handleDownload}
                    disabled={!sketch?.image_url}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white py-3 rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download Sketch
                  </button>
                  <button
                    onClick={handlePrint}
                    className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    Print Report
                  </button>
                  <button
                    onClick={() => alert('Share functionality would be implemented here')}
                    className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                    Share with Team
                  </button>
                </div>
              </div>

              {/* Case Details */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Case Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Case Reference</label>
                    <p className="text-white font-mono">{sketch?.case_reference || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Sketch ID</label>
                    <p className="text-white font-mono text-sm">{sketchId}</p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Features Used</label>
                    <p className="text-white">
                      {sketch?.features_data?.length || 0} facial features
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Created</label>
                    <p className="text-white">
                      {sketch?.created_at ? new Date(sketch.created_at).toLocaleString() : 'Unknown'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Witness Notes */}
              {sketch?.witness_notes && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Witness Notes</h3>
                  <div className="bg-slate-900/50 rounded-lg p-4">
                    <p className="text-slate-300 text-sm whitespace-pre-wrap">
                      {sketch.witness_notes}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <div>
              Forensic Sketch System • Official Use Only
            </div>
            <div>
              {sketch?.image_url ? 'Image stored on server' : 'No image available'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}