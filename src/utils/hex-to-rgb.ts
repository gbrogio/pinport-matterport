export function hexToRgbPercent(hex: string) {
	// Remove the hash at the start if it's there
	const newHex = hex.replace(/^#/, "");

	// Parse the r, g, b values
	const bigint = Number.parseInt(newHex, 16);
	const r = (bigint >> 16) & 255;
	const g = (bigint >> 8) & 255;
	const b = bigint & 255;

	// Convert r, g, b to percentages
	const rPercent = r / 255;
	const gPercent = g / 255;
	const bPercent = b / 255;

	return {
		r: rPercent,
		g: gPercent,
		b: bPercent,
	};
}
