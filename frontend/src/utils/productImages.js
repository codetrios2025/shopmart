export const hasCompleteColorImageAssignments = (colors, imageColors) => {
  const assignedColors = new Set(imageColors.filter(Boolean));
  if (assignedColors.size === 0 || imageColors.some((color) => !color)) {
    return true;
  }
  return colors.every((color) => assignedColors.has(color));
};
