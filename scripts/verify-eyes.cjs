const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../src/cat/pixel-eyes.js'),'utf8');
const eyes = import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('pupils stay within the whites through all gaze and blink positions', async()=>{
  const {pixelEyePixels}=await eyes;
  for(const blink of [0,.24,.25,.5,.74,.75,1]) for(const lookX of [-9,-1,-.5,0,.5,1,9,NaN]) for(const lookY of [-9,-1,0,1,9,NaN]) {
    const pixels=pixelEyePixels({blink,lookX,lookY});
    assert.equal(new Set(pixels.map(([x,y])=>`${x},${y}`)).size,pixels.length);
    for(const [x,y,c] of pixels) {
      assert(Number.isInteger(x)&&Number.isInteger(y));
      if(c===3) {
        assert(Math.abs(x)<=1);
        assert(blink<.75);
        assert(blink>=.25 ? y===0 : Math.abs(y)<=1);
      }
    }
    assert.equal(pixels.filter(p=>p[2]===3).length,blink>=.75?0:blink>=.25?1:2);
  }
});
test('closed and happy eyes have no detached highlights or pupils',async()=>{
  const {pixelEyePixels}=await eyes;
  for(const happy of [true,false]) for(const blink of [0,.5,1]) {
    const pixels=pixelEyePixels({closed:true,happy,blink});
    assert.equal(pixels.length,3);assert(pixels.every(p=>p[2]===1));
  }
});
