// Fixed 5x5 silhouettes keep gaze pixels inside the eye at every blink stage.
export function pixelEyePixels({ blink = 0, closed = false, happy = false, lookX = 0, lookY = 0 } = {}) {
  if (closed || blink >= .75) return happy
    ? [[-1,0,1],[0,-1,1],[1,0,1]]
    : [[-1,0,1],[0,1,1],[1,0,1]];
  const half = blink >= .25;
  const rows = half ? ["01110", "12221", "01110"] : ["01110", "12221", "12221", "12221", "01110"];
  const pixels = [];
  const gaze = Number.isFinite(lookX) ? Math.max(-1, Math.min(1, Math.round(lookX))) : 0;
  const top = Number.isFinite(lookY) && lookY > .35 ? 0 : -1;
  for (let row = 0; row < rows.length; row++) for (let col = 0; col < 5; col++) {
    let color = Number(rows[row][col]);
    if (!color) continue;
    const x = col - 2, y = row - (half ? 1 : 2);
    if (color === 2 && x === gaze && (half || (y >= top && y < top + 2))) color = 3;
    pixels.push([x,y,color]);
  }
  return pixels;
}

export function drawPixelEye(ctx, x, y, pose, colors) {
  const palette = [null, colors.outline, colors.white, colors.pupil];
  for (const [dx,dy,color] of pixelEyePixels(pose)) {
    ctx.fillStyle = palette[color];
    ctx.fillRect(Math.round(x) + dx, Math.round(y) + dy, 1, 1);
  }
}
