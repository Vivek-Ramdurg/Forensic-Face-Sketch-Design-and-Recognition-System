export const criminalDatabase = [
  {
    id: "CRIM001",
    name: "John Doe",
    age: 35,
    crimes: ["Burglary", "Assault"],
    features: [
      { type: 'face_shape', src: '/Face Sketch Elements/head/02.png' },
      { type: 'eyes', src: '/Face Sketch Elements/eyes/02.png' },
      { type: 'eyebrows', src: '/Face Sketch Elements/eyebrows/02.png' },
      { type: 'nose', src: '/Face Sketch Elements/nose/01.png' },
      { type: 'mouth', src: '/Face Sketch Elements/lips/01.png' }
    ],
    confidence: 94,
    image: '/criminal-profiles/001.jpg',
    lastSeen: 'New York',
    warrantStatus: 'Active'
  },
  {
    id: "CRIM002",
    name: "Robert Smith",
    age: 42,
    crimes: ["Fraud", "Forgery"],
    features: [
      { type: 'face_shape', src: '/Face Sketch Elements/head/01.png' },
      { type: 'eyes', src: '/Face Sketch Elements/eyes/03.png' },
      { type: 'eyebrows', src: '/Face Sketch Elements/eyebrows/02.png' },
      { type: 'nose', src: '/Face Sketch Elements/nose/02.png' },
      { type: 'mouth', src: '/Face Sketch Elements/lips/02.png' }
    ],
    confidence: 87,
    image: '/criminal-profiles/002.jpg',
    lastSeen: 'Chicago',
    warrantStatus: 'Pending'
  },
  {
    id: "CRIM003",
    name: "Mike Johnson",
    age: 28,
    crimes: ["Vandalism", "Theft"],
    features: [
      { type: 'face_shape', src: '/Face Sketch Elements/head/02.png' },
      { type: 'eyes', src: '/Face Sketch Elements/eyes/02.png' },
      { type: 'eyebrows', src: '/Face Sketch Elements/eyebrows/01.png' },
      { type: 'nose', src: '/Face Sketch Elements/nose/02.png' },
      { type: 'mouth', src: '/Face Sketch Elements/lips/03.png' }
    ],
    confidence: 76,
    image: '/criminal-profiles/003.jpg',
    lastSeen: 'Los Angeles',
    warrantStatus: 'Active'
  },
  {
    id: "CRIM004",
    name: "David Wilson",
    age: 39,
    crimes: ["Robbery"],
    features: [
      { type: 'face_shape', src: '/Face Sketch Elements/head/03.png' },
      { type: 'eyes', src: '/Face Sketch Elements/eyes/01.png' },
      { type: 'eyebrows', src: '/Face Sketch Elements/eyebrows/03.png' },
      { type: 'nose', src: '/Face Sketch Elements/nose/03.png' },
      { type: 'mouth', src: '/Face Sketch Elements/lips/02.png' }
    ],
    confidence: 65,
    image: '/criminal-profiles/004.jpg',
    lastSeen: 'Miami',
    warrantStatus: 'Closed'
  }
];