import { criminalDatabase } from '../data/criminalDatabase';

export const matchSketch = (userFeatures) => {
  const matches = [];
  
  criminalDatabase.forEach(criminal => {
    let score = 0;
    let matchedFeatures = 0;
    const totalFeatures = Math.min(userFeatures.length, criminal.features.length);
    
    // Compare each feature
    userFeatures.forEach(userFeature => {
      const criminalFeature = criminal.features.find(
        f => f.type === userFeature.type
      );
      
      if (criminalFeature) {
        // Basic matching logic - compare file paths
        if (criminalFeature.src === userFeature.src) {
          score += 20; // Exact match
          matchedFeatures++;
        } else {
          // Partial match (same feature type but different variant)
          score += 10;
          matchedFeatures++;
        }
      }
    });
    
    // Calculate confidence percentage
    if (matchedFeatures > 0) {
      const confidence = Math.min(100, score + Math.random() * 20); // Add some randomness
      
      if (confidence > 60) { // Only include matches above 60% confidence
        matches.push({
          ...criminal,
          confidence: Math.round(confidence),
          matchedFeatures,
          totalCompared: totalFeatures
        });
      }
    }
  });
  
  // Sort by confidence (highest first)
  matches.sort((a, b) => b.confidence - a.confidence);
  
  return matches;
};

// Simulate API call delay
export const findMatches = async (userFeatures) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const matches = matchSketch(userFeatures);
      resolve({
        success: matches.length > 0,
        matches: matches,
        count: matches.length,
        highestConfidence: matches.length > 0 ? Math.max(...matches.map(m => m.confidence)) : 0
      });
    }, 1500); // Simulate 1.5 second delay
  });
};