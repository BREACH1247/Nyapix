const {app,BrowserWindow}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
app.whenReady().then(async()=>{
  const win=new BrowserWindow({show:false});
  try {
    await win.loadFile(path.join(__dirname,'../src/settings/index.html'));
    const png=await win.webContents.executeJavaScript(`(async()=>{
      const {drawDogArt}=await import('../cat/dog-art.js');
      const {drawCatArt}=await import('../cat/art.js');
      const {DEFAULTS,PET_DEFAULTS}=await import('../shared/defaults.js');
      const pet=window.__nyapixPreview;
      const sheet=document.createElement('canvas');sheet.width=960;sheet.height=400;
      const ctx=sheet.getContext('2d');ctx.fillStyle='#242b28';ctx.fillRect(0,0,960,400);ctx.imageSmoothingEnabled=false;
      const tile=document.createElement('canvas');tile.width=tile.height=32;
      const poses=[['Center',0,0,0],['Left',-1,0,0],['Right',1,0,0],['Up',0,-1,0],['Down',0,1,0],['Half blink',1,0,.5],['Closed',0,0,1],['Happy',0,0,0]];
      for(let row=0;row<2;row++)for(let col=0;col<poses.length;col++){
        const [label,x,y,blink]=poses[col];pet.settings={...DEFAULTS,...PET_DEFAULTS[row?'cat':'dog']};pet.mode='idle';pet.tailT=1;pet.lookX=x;pet.lookY=y;pet.blink=blink;pet.pet=label==='Happy'?1:0;
        (row?drawCatArt:drawDogArt)(tile.getContext('2d'),pet);
        ctx.drawImage(tile,col*120,row*200+32,120,120);ctx.fillStyle='#e8eee6';ctx.font='12px Segoe UI';ctx.fillText(label,col*120+20,row*200+178);
      }
      return sheet.toDataURL();
    })()`);
    const output=path.join(require('node:os').tmpdir(),'nyapix-eye-poses.png');
    fs.writeFileSync(output,Buffer.from(png.split(',')[1],'base64'));console.log(output);app.exit(0);
  }catch(e){console.error(e);app.exit(1);}
});
