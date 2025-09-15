import React from 'react';
import { StyleSheet } from 'react-native';
import {
  Canvas,
  Rect,
  Paint,
  ColorMatrix,
  Skia,
  Shader,
  Blur,
  BackdropFilter,
} from '@shopify/react-native-skia';

// Define all possible filter names for type safety
export type FilterType =
  | 'none'
  | 'vintage'
  | 'blackwhite'
  | 'sepia'
  | 'bright'
  | 'dark'
  | 'cool'
  | 'warm'
  | 'invert'
  | 'blur'
  | 'sharpen';

// --- Centralized Filter Configuration ---
const FILTER_CONFIG = {
  vintage: {
    matrix: [
      0.9, 0.5, 0.1, 0, 0,
      0.3, 0.8, 0.1, 0, 0,
      0.2, 0.3, 0.7, 0, 0,
      0,   0,   0,   1, 0,
    ],
  },
  blackwhite: {
    matrix: [
      0.21, 0.72, 0.07, 0, 0,
      0.21, 0.72, 0.07, 0, 0,
      0.21, 0.72, 0.07, 0, 0,
      0,    0,    0,    1, 0,
    ],
  },
  sepia: {
    matrix: [
      0.393, 0.769, 0.189, 0, 0,
      0.349, 0.686, 0.168, 0, 0,
      0.272, 0.534, 0.131, 0, 0,
      0,     0,     0,     1, 0,
    ],
  },
  bright: {
    matrix: (() => {
      const C = 1.3; // Contrast
      const B = 0.05; // Brightness
      const offset = B - 0.5 * (C - 1);
      return [
        C, 0, 0, 0, offset,
        0, C, 0, 0, offset,
        0, 0, C, 0, offset,
        0, 0, 0, 1, 0,
      ];
    })(),
  },
  dark: {
    matrix: (() => {
      const C = 0.9; // Contrast
      const B = -0.05; // Brightness
      const offset = B - 0.5 * (C - 1);
      return [
        C, 0, 0, 0, offset,
        0, C, 0, 0, offset,
        0, 0, C, 0, offset,
        0, 0, 0, 1, 0,
      ];
    })(),
  },
  cool: {
    matrix: [
      1, 0, 0, 0, 0,
      0, 1, 0, 0, 0,
      0, 0, 1, 0.1, 0, // Adds a bit of blue
      0, 0, 0, 1, 0,
    ],
  },
  warm: {
    matrix: [
      1, 0, 0, 0.15, 0, // Adds a bit of red
      0, 1, 0, 0.07, 0, // Adds a bit of green
      0, 0, 1, 0, 0,
      0, 0, 0, 1, 0,
    ],
  },
  invert: {
    matrix: [
      -1, 0,  0, 0, 1,
      0, -1,  0, 0, 1,
      0,  0, -1, 0, 1,
      0,  0,  0, 1, 0,
    ],
  },
  // A basic sharpening convolution kernel approximation
  sharpen: {
    matrix: [
       0, -1,  0, 0, 0,
      -1,  5, -1, 0, 0,
       0, -1,  0, 0, 0,
       0,  0,  0, 1, 0,
    ]
  }
};


/**
 * This is the shader that allows us to "see" the native video component.
 * It samples the pixels from whatever is rendered BEHIND the Skia canvas.
 */
const backdropShader = Skia.RuntimeEffect.Make(`
  uniform shader backdrop;
  half4 main(vec2 xy) {
    return backdrop.eval(xy);
  }
`)!;

interface VideoFilterProps {
  activeFilter: FilterType;
  // This component now takes the layout dimensions instead of children
  videoLayout: { width: number; height: number };
}

export const VideoFilter: React.FC<VideoFilterProps> = ({ activeFilter, videoLayout }) => {
  // If no filter is active or the video's layout hasn't been measured, do nothing.
  if (activeFilter === 'none' || videoLayout.width === 0) {
    return null;
  }

  // --- Handle Special Filters (like Blur) ---
  // Blur is an ImageFilter, not a ColorFilter, and is best applied with a BackdropFilter.
  if (activeFilter === 'blur') {
    return (
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <BackdropFilter filter={<Blur blur={10} />} />
      </Canvas>
    );
  }

  // --- Handle All Matrix-Based Filters ---
  // @ts-ignore - We safely access the config based on the activeFilter type
  const matrix = FILTER_CONFIG[activeFilter]?.matrix;

  // If the filter isn't in our config, don't render anything
  if (!matrix) {
    return null;
  }

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Draw a rectangle that covers the entire video area */}
      <Rect x={0} y={0} width={videoLayout.width} height={videoLayout.height} opacity={0.1}>
        {/* The Paint is where the magic happens */}
        <Paint opacity={0.1}>
          <ColorMatrix matrix={matrix} />
          <Shader source={backdropShader} />
        </Paint>
      </Rect>
    </Canvas>
  );
};
