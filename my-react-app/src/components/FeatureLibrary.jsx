import { useState } from 'react';

// Import all images from the Face Sketch Elements folder
// Since require.context doesn't work in ES modules, we'll use a different approach

const faceFeaturesPng = {
  face_shape: [
    { id: 'head_01', name: 'Oval Face', src: '/Face Sketch Elements/head/01.png' },
    { id: 'head_02', name: 'Round Face', src: '/Face Sketch Elements/head/02.png' },
    { id: 'head_03', name: 'Square Face', src: '/Face Sketch Elements/head/03.png' },
    { id: 'head_04', name: 'Heart Face', src: '/Face Sketch Elements/head/04.png' },
  ],
  eyes: [
    { id: 'eyes_01', name: 'Round Eyes', src: '/Face Sketch Elements/eyes/01.png' },
    { id: 'eyes_02', name: 'Almond Eyes', src: '/Face Sketch Elements/eyes/02.png' },
    { id: 'eyes_03', name: 'Small Eyes', src: '/Face Sketch Elements/eyes/03.png' },
    { id: 'eyes_04', name: 'Large Eyes', src: '/Face Sketch Elements/eyes/04.png' },
  ],
  eyebrows: [
    { id: 'eyebrows_01', name: 'Straight Brows', src: '/Face Sketch Elements/eyebrows/01.png' },
    { id: 'eyebrows_02', name: 'Arched Brows', src: '/Face Sketch Elements/eyebrows/02.png' },
    { id: 'eyebrows_03', name: 'Thick Brows', src: '/Face Sketch Elements/eyebrows/03.png' },
    { id: 'eyebrows_04', name: 'Thin Brows', src: '/Face Sketch Elements/eyebrows/04.png' },
  ],
  nose: [
    { id: 'nose_01', name: 'Straight Nose', src: '/Face Sketch Elements/nose/01.png' },
    { id: 'nose_02', name: 'Roman Nose', src: '/Face Sketch Elements/nose/02.png' },
    { id: 'nose_03', name: 'Button Nose', src: '/Face Sketch Elements/nose/03.png' },
    { id: 'nose_04', name: 'Hooked Nose', src: '/Face Sketch Elements/nose/04.png' },
  ],
  mouth: [
    { id: 'mouth_01', name: 'Thin Lips', src: '/Face Sketch Elements/lips/01.png' },
    { id: 'mouth_02', name: 'Full Lips', src: '/Face Sketch Elements/lips/02.png' },
    { id: 'mouth_03', name: 'Small Mouth', src: '/Face Sketch Elements/lips/03.png' },
    { id: 'mouth_04', name: 'Wide Mouth', src: '/Face Sketch Elements/lips/04.png' },
  ],
  hair: [
    { id: 'hair_01', name: 'Short Hair', src: '/Face Sketch Elements/hair/01.png' },
    { id: 'hair_02', name: 'Long Hair', src: '/Face Sketch Elements/hair/02.png' },
    { id: 'hair_03', name: 'Curly Hair', src: '/Face Sketch Elements/hair/03.png' },
    { id: 'hair_04', name: 'Bald', src: '/Face Sketch Elements/hair/04.png' },
  ],
  mustach: [
    { id: 'mustach_01', name: 'Thin Mustache', src: '/Face Sketch Elements/mustach/01.png' },
    { id: 'mustach_02', name: 'Thick Mustache', src: '/Face Sketch Elements/mustach/02.png' },
    { id: 'mustach_03', name: 'Handlebar', src: '/Face Sketch Elements/mustach/03.png' },
    { id: 'mustach_04', name: 'Goatee', src: '/Face Sketch Elements/mustach/04.png' },
  ],
  more: [
    { id: 'more_01', name: 'Glasses', src: '/Face Sketch Elements/more/01.png' },
    { id: 'more_02', name: 'Scar', src: '/Face Sketch Elements/more/02.png' },
    { id: 'more_03', name: 'Beard', src: '/Face Sketch Elements/more/03.png' },
    { id: 'more_04', name: 'Earring', src: '/Face Sketch Elements/more/04.png' },
  ]
};

const featureTypes = [
  { id: 'face_shape', label: 'Face Shape' },
  { id: 'eyes', label: 'Eyes' },
  { id: 'eyebrows', label: 'Eyebrows' },
  { id: 'nose', label: 'Nose' },
  { id: 'mouth', label: 'Mouth' },
  { id: 'hair', label: 'Hair' },
  { id: 'mustach', label: 'Mustache' },
  { id: 'more', label: 'More Features' },
];

export default function FeatureLibrary({ onFeatureDragStart }) {
  const [selectedType, setSelectedType] = useState('face_shape');

  const currentFeatures = faceFeaturesPng[selectedType] || [];

  const handleDragStart = (e, feature) => {
    const featureData = {
      id: feature.id,
      type: selectedType,
      src: feature.src
    };
    e.dataTransfer.setData('application/json', JSON.stringify(featureData));
    onFeatureDragStart(featureData);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900">
      <div className="bg-slate-800 px-4 py-3 border-b border-slate-700">
        <h3 className="text-white font-semibold mb-3">Feature Library</h3>
        <div className="flex flex-wrap gap-1.5">
          {featureTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedType(type.id)}
              className={`px-3 py-1.5 text-xs rounded transition-all ${
                selectedType === type.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3">
          {currentFeatures.map((feature) => (
            <div
              key={feature.id}
              draggable
              onDragStart={(e) => handleDragStart(e, feature)}
              className="bg-slate-800 rounded-lg p-3 border border-slate-700 hover:border-blue-500 cursor-move transition-all hover:shadow-lg group"
            >
              <div className="bg-slate-800 rounded-md mb-2 h-24 flex items-center justify-center overflow-hidden">
                <img 
                  src={feature.src} 
                  alt={feature.name} 
                  className="w-full h-full object-contain p-2" 
                  onError={(e) => {
                    console.error(`Failed to load image: ${feature.src}`);
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = 
                      `<div class="w-full h-full flex items-center justify-center text-slate-500 text-xs">Image: ${feature.name}</div>`;
                  }}
                />
              </div>
              <p className="text-xs text-slate-300 text-center group-hover:text-white transition-colors">
                {feature.name}
              </p>
            </div>
          ))}
        </div>

        {currentFeatures.length === 0 && (
          <div className="text-center text-slate-500 py-8">
            No features available
          </div>
        )}
      </div>

      <div className="bg-slate-800 px-4 py-2 border-t border-slate-700 text-xs text-slate-400 text-center">
        Drag features onto the canvas to compose
      </div>
    </div>
  );
}