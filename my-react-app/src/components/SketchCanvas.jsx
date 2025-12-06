import { useState, useRef } from 'react';
import { Trash2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

export default function SketchCanvas({ placedFeatures, onUpdateFeatures, onDrop, canvasId }) {
  const [selectedFeatureId, setSelectedFeatureId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleCanvasDrop = (e) => {
    e.preventDefault();
    onDrop(e);
  };

  const handleFeatureMouseDown = (e, featureId) => {
    e.stopPropagation();
    setSelectedFeatureId(featureId);
    setIsDragging(true);

    const feature = placedFeatures.find(f => f.id === featureId);
    if (feature && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left - feature.x,
        y: e.clientY - rect.top - feature.y
      });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && selectedFeatureId && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const newX = e.clientX - rect.left - dragOffset.x;
      const newY = e.clientY - rect.top - dragOffset.y;

      onUpdateFeatures(
        placedFeatures.map(f =>
          f.id === selectedFeatureId
            ? { ...f, x: newX, y: newY }
            : f
        )
      );
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDeleteSelected = () => {
    if (selectedFeatureId) {
      onUpdateFeatures(placedFeatures.filter(f => f.id !== selectedFeatureId));
      setSelectedFeatureId(null);
    }
  };

  const handleScaleChange = (delta) => {
    if (selectedFeatureId) {
      onUpdateFeatures(
        placedFeatures.map(f =>
          f.id === selectedFeatureId
            ? { ...f, scale: Math.max(0.5, Math.min(2, f.scale + delta)) }
            : f
        )
      );
    }
  };

  const handleRotationChange = (delta) => {
    if (selectedFeatureId) {
      onUpdateFeatures(
        placedFeatures.map(f =>
          f.id === selectedFeatureId
            ? { ...f, rotation: (f.rotation + delta) % 360 }
            : f
        )
      );
    }
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear all features?')) {
      onUpdateFeatures([]);
      setSelectedFeatureId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-slate-800 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-white font-semibold">Composite Canvas</h3>
        <div className="flex items-center gap-2">
          {selectedFeatureId && (
            <>
              <button
                onClick={() => handleScaleChange(-0.1)}
                className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleScaleChange(0.1)}
                className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleRotationChange(-15)}
                className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
                title="Rotate Left"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleRotationChange(15)}
                className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
                title="Rotate Right"
              >
                <RotateCcw className="w-4 h-4 scale-x-[-1]" />
              </button>
              <button
                onClick={handleDeleteSelected}
                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors"
                title="Delete Feature"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="w-px h-6 bg-slate-700 mx-1"></div>
            </>
          )}
          <button
            onClick={handleClear}
            className="px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>

      <div
        id={canvasId}
        ref={canvasRef}
        className="flex-1 bg-slate-900 relative overflow-hidden cursor-crosshair"
        onDragOver={handleDragOver}
        onDrop={handleCanvasDrop}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={() => setSelectedFeatureId(null)}
      >
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-slate-700 text-sm">Drag features here to build composite</div>
        </div>

        <div className="w-full h-full relative">
          {placedFeatures.map((feature) => (
            <div
              key={feature.id}
              onMouseDown={(e) => handleFeatureMouseDown(e, feature.id)}
              className={`absolute cursor-move ${selectedFeatureId === feature.id ? 'opacity-100' : 'opacity-90'}`}
              style={{
                left: `calc(50% + ${feature.x}px)`,
                top: `calc(50% + ${feature.y}px)`,
                transform: `translate(-50%, -50%) scale(${feature.scale}) rotate(${feature.rotation}deg)`,
                transformOrigin: 'center',
              }}
            >
              <img src={feature.src} alt={feature.type} className={`w-48 h-48 object-contain ${selectedFeatureId === feature.id ? 'drop-shadow-lg' : ''}`} />
              {selectedFeatureId === feature.id && (
                <div className="absolute inset-0 border-2 border-dashed border-blue-500 pointer-events-none"></div>
              )}
            </div>
          ))}
        </div>
      </div>

      {selectedFeatureId && (
        <div className="bg-slate-800 px-4 py-2 border-t border-slate-700 text-xs text-slate-400 text-center">
          Feature selected: Use controls above to adjust, click elsewhere to deselect
        </div>
      )}
    </div>
  );
}