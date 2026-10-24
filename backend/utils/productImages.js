export const normalizeColorImageSelections = (
  value,
  images,
  colors,
) => {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      const error = new Error("Color image selection is invalid.");
      error.statusCode = 400;
      throw error;
    }
  }
  if (value === undefined || value === null || value === "") return [];
  if (!Array.isArray(value)) {
    const error = new Error("Color image selection is invalid.");
    error.statusCode = 400;
    throw error;
  }

  const groups = new Map();
  const assignedImageIndexes = new Set();
  for (const selection of value) {
    const imageIndex = Number(selection?.imageIndex);
    const color =
      typeof selection?.color === "string" ? selection.color.trim() : "";
    if (
      !Number.isInteger(imageIndex) ||
      imageIndex < 0 ||
      imageIndex >= images.length ||
      !color ||
      !colors.includes(color)
    ) {
      const error = new Error("Each color image must match an uploaded image and product color.");
      error.statusCode = 400;
      throw error;
    }
    assignedImageIndexes.add(imageIndex);
    if (!groups.has(color)) groups.set(color, []);
    groups.get(color).push(images[imageIndex]);
  }
  const hasSharedImages = images.some(
    (_, imageIndex) => !assignedImageIndexes.has(imageIndex),
  );
  if (
    groups.size > 0 &&
    !hasSharedImages &&
    colors.some((color) => !groups.has(color))
  ) {
    const error = new Error(
      "Assign at least one image to every product color, or leave an image shared across all colors.",
    );
    error.statusCode = 400;
    throw error;
  }
  return [...groups].map(([color, colorImages]) => ({
    color,
    images: [...new Set(colorImages)],
  }));
};
