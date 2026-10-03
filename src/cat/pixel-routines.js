import { drawPixelEye } from "./pixel-eyes.js";

export function drawCurledPet(ctx, pet) {
  const s=pet.settings, dog=s.petKind==="dog", ink="#302b3c";
  const rect=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h);};
  const oval=(x,y,rx,ry,c)=>{
    for(let yy=Math.ceil(y-ry);yy<=y+ry;yy++){
      const dx=rx*Math.sqrt(Math.max(0,1-((yy-y)/ry)**2));
      rect(Math.ceil(x-dx),yy,Math.floor(x+dx)-Math.ceil(x-dx)+1,1,c);
    }
  };
  ctx.clearRect(0,0,32,32);
  const breath=Math.sin(pet.tailT*1.6)*.3;
  oval(17,24,12,6+breath,ink);oval(17,24,11,5+breath,s.furColor);
  if(s.pattern!=="solid")oval(22,23,4,3,s.markColor);
  oval(18,27,6,2,s.bellyColor);
  if(!dog){
    rect(5,16,3,5,ink);rect(14,16,3,5,ink);
    rect(6,17,1,3,s.innerEarColor);rect(15,17,1,3,s.innerEarColor);
  }
  oval(11,23,7,5,ink);oval(11,23,6,4,s.furColor);
  if(dog){oval(5,23,2,5,s.markColor);oval(17,22,2,4,s.markColor);}
  oval(11,26,4,2,s.bellyColor);
  drawPixelEye(ctx,8,23,{closed:true},{outline:ink,white:s.eyeColor,pupil:s.pupilColor});
  drawPixelEye(ctx,14,23,{closed:true},{outline:ink,white:s.eyeColor,pupil:s.pupilColor});
  rect(10,25,2,1,s.noseColor);
  for(let i=0;i<10;i++){
    const a=i/9*Math.PI;
    oval(21+Math.cos(a)*7,25+Math.sin(a)*4,2,1.5,ink);
    oval(21+Math.cos(a)*7,25+Math.sin(a)*4,1,1,i>7?s.bellyColor:s.furColor);
  }
}
