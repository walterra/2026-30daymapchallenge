// Shared presentation colors. RGB channels are display-space values for the
// custom shader (not THREE.Color's automatically linearized hex channels).
export const appearance = Object.freeze({
  contextInk: '#34434d',
  contextHalo: '#f4f6f7',
  // sRGB samples from the user-provided green-bubble map reference.
  basePaper: '#e8e7e8',
  reliefShadow: '#87958e',
  reliefStrength: 0.72,
  noData: '#fbfbfb',
  noDataHatch: '#d9dfdd',
  visibleFill: '#8dc98f',
  visibleBoundary: '#294a34',
  unlitShade: '#fafafa',
  fillOpacity: 0.68,
  shadeOpacity: 0,
});

export function rgb(hex) {
  return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
}
