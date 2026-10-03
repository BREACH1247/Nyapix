const { app, BrowserWindow } = require('electron');
require('../src/main/test-graphics.cjs');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1100, height: 1000, show: false, webPreferences: { backgroundThrottling: false } });
  const errors = [];
  win.webContents.on('console-message', (_, level, message) => { if (level >= 3) errors.push(message); });
  try {
    await win.loadFile(path.join(__dirname, '../src/settings/index.html'), { query: { pet: 'dog', mode: '3d' } });
    const result = await win.webContents.executeJavaScript(`(async () => {
      const pet = window.__nyapixPreview;
      async function ready() {
        for (let i=0;i<100;i++) {
          pet.draw();
          if (pet.renderError) throw new Error(pet.renderError);
          if (pet.render3D?.rig) return;
          await new Promise(r=>setTimeout(r,50));
        }
        throw new Error('3D did not load');
      }
      await ready();
      const model = pet.render3D;
      const hit = model.hitTest(.5,.45), miss = model.hitTest(.02,.02);
      const poses = new Set();
      for (const mode of ['idle','knead','think','wave','sleep','water','stretch']) {
        pet.mode=mode; pet.stretchBlend=1; pet.draw(); poses.add(pet.canvas.toDataURL());
      }
      pet.setSettings({ petKind: 'cat' }); pet.draw();
      const cat = !model.dog;
      pet.setSettings({ furColor:'#ff9933' }); pet.draw();
      const coat = model.key.includes('#ff9933');
      model.lost = true; pet.draw();
      const fallback = pet.canvas.style.imageRendering === 'pixelated';
      model.lost = false;
      document.querySelector('[data-render-mode="pixel"]').click(); pet.draw();
      const pixel = !pet.render3D && pet.canvas.style.imageRendering === 'pixelated';
      document.querySelector('[data-render-mode="3d"]').click(); await ready();
      pet.mode='idle'; pet.stretchBlend=0; pet.draw();
      const pixels = pet.ctx.getImageData(0,0,pet.canvas.width,pet.canvas.height).data.filter((v,i)=>i%4===3 && v>20).length;
      return { hit, miss, poses:poses.size, cat, coat, pixel, fallback, pixels, restored: !!pet.render3D };
    })()`);
    assert(result.hit && !result.miss && result.poses >= 6 && result.cat && result.coat && result.pixel && result.fallback && result.pixels > 1000 && result.restored, JSON.stringify(result));
    assert.deepEqual(errors, []);
    await new Promise(resolve => setTimeout(resolve, 700));
    const output = path.join(require('node:os').tmpdir(), 'nyapix-3d.png');
    fs.writeFileSync(output, (await win.webContents.capturePage()).toPNG());
    const canvasImage = await win.webContents.executeJavaScript(`(() => { const pet = window.__nyapixPreview; pet.draw(); return pet.canvas.toDataURL(); })()`);
    fs.writeFileSync(path.join(require('node:os').tmpdir(), 'nyapix-3d-character.png'), Buffer.from(canvasImage.split(',')[1], 'base64'));
    console.log(JSON.stringify({ result:'PASS', ...result, screenshot:output }));
    app.exit(0);
  } catch (error) { console.error(error, errors); app.exit(1); }
});
