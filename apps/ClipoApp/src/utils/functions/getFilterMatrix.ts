export const getFilterMatrix = (activeFilter: any) => {
  switch (activeFilter) {
    case 'vintage':
      return [
        0.9, 0.5, 0.1, 0, 0,
        0.3, 0.8, 0.1, 0, 0,
        0.2, 0.3, 0.7, 0, 0,
        0,   0,   0,   1, 0,
      ];
      
    case 'blackwhite':
    case 'grayscale':
      return [
        0.21, 0.72, 0.07, 0, 0,
        0.21, 0.72, 0.07, 0, 0,
        0.21, 0.72, 0.07, 0, 0,
        0,    0,    0,    1, 0,
      ];
      
    case 'sepia':
      return [
        0.393, 0.769, 0.189, 0, 0,
        0.349, 0.686, 0.168, 0, 0,
        0.272, 0.534, 0.131, 0, 0,
        0,     0,     0,     1, 0,
      ];
    
    case 'bright':
      const C = 1.5; // Contrast
      const B = 0.1; // Brightness
      return [
        C, 0, 0, 0, B - 0.5 * (C - 1),
        0, C, 0, 0, B - 0.5 * (C - 1),
        0, 0, C, 0, B - 0.5 * (C - 1),
        0, 0, 0, 1, 0,
      ];
      
    case 'dark':
      const darkC = 0.8;
      const darkB = -0.1;
      return [
        darkC, 0, 0, 0, darkB - 0.5 * (darkC - 1),
        0, darkC, 0, 0, darkB - 0.5 * (darkC - 1),
        0, 0, darkC, 0, darkB - 0.5 * (darkC - 1),
        0, 0, 0, 1, 0,
      ];
      
    case 'cool':
      return [
        1, 0, 0, 0, 0,
        0, 1, 0, 0, 0,
        0, 0, 1, 0, 0.2, // Add blue
        0, 0, 0, 1, 0,
      ];
      
    case 'warm':
      return [
        1, 0, 0, 0, 0.15, // Add red
        0, 1, 0, 0, 0.1,  // Add green
        0, 0, 1, 0, 0,
        0, 0, 0, 1, 0,
      ];
      
    case 'blur':
      return [
        0.8, 0.1, 0.1, 0, 0,
        0.1, 0.8, 0.1, 0, 0,
        0.1, 0.1, 0.8, 0, 0,
        0,   0,   0,   1, 0,
      ];
      
    case 'sharpen':
      return [
        1.5, -0.2, -0.2, 0, 0,
        -0.2, 1.5, -0.2, 0, 0,
        -0.2, -0.2, 1.5, 0, 0,
        0,    0,    0,   1, 0,
      ];
      
    case 'invert':
      return [
        -1, 0,  0, 0, 1,
        0, -1,  0, 0, 1,
        0,  0, -1, 0, 1,
        0,  0,  0, 1, 0,
      ];
      
    default:
      return null;
  }
};


export const getFilterOpacity = (activeFilter: any) => {
  switch (activeFilter) {
    // Strong effect filters - need lower opacity
    case 'invert':
      return { rectOpacity: 0.8, paintOpacity: 0.8 }; // Full invert needs high opacity

    case 'sepia':
      return { rectOpacity: 0.1, paintOpacity: 0.01 }; // Sepia is naturally strong
    
    case 'vintage':
      return { rectOpacity: 0.7, paintOpacity: 0.6 }; // Vintage has warm tones
    
    // Medium effect filters
    case 'blackwhite':
    case 'grayscale':
      return { rectOpacity: 1.0, paintOpacity: 0.9 }; // Grayscale needs high opacity for full effect
    
    case 'sharpen':
      return { rectOpacity: 0.3, paintOpacity: 0.4 }; // Sharpening is subtle
    
    case 'blur':
      return { rectOpacity: 0.4, paintOpacity: 0.5 }; // Blur effect needs medium opacity
    
    // Brightness/Contrast filters - need careful opacity
    case 'bright':
      return { rectOpacity: 0.6, paintOpacity: 0.7 }; // Brightness can be overwhelming
    
    case 'dark':
      return { rectOpacity: 0.8, paintOpacity: 0.7 }; // Dark filter needs good opacity
    
    // Color temperature filters - subtle effects
    case 'cool':
      return { rectOpacity: 0.4, paintOpacity: 0.5 }; // Cool tone is subtle
    
    case 'warm':
      return { rectOpacity: 0.4, paintOpacity: 0.5 }; // Warm tone is subtle
    
    default:
      return { rectOpacity: 0.5, paintOpacity: 0.6 }; // Default fallback
  }
};

export const getFilterBlendMode = (activeFilter: any) => {
  switch (activeFilter) {
    case 'vintage':
    case 'sepia':
    case 'warm':
      return 'overlay'; // Good for warm/vintage effects
    
    case 'bright':
    case 'cool':
      return 'screen'; // Good for brightening effects
    
    case 'dark':
      return 'multiply'; // Good for darkening effects
    
    case 'blackwhite':
    case 'grayscale':
    case 'invert':
      return 'normal'; // Use normal for color replacement
    
    case 'sharpen':
    case 'blur':
      return 'overlay'; // Good for texture effects
    
    default:
      return 'overlay';
  }
};
