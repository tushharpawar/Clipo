import { ColorMatrix, Blur } from "@shopify/react-native-skia";
import React from "react";
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
  | 'sharpen'; // We'll handle sharpen specially

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
    // This matrix increases contrast (C) and brightness (B)
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
    // This matrix decreases contrast (C) and brightness (B)
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
};