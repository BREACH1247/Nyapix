const clamp=(v,a,b)=>Math.max(a,Math.min(Math.max(a,b),v));

// Coordinates are overlay-local, so a throw never leaves the selected monitor.
export class FetchGame {
  constructor(pet){this.pet=pet;this.phase='ready';this.origin={x:pet.x,y:pet.y};this.place();}
  get radius(){return clamp(this.pet.bodyW()*.085,9,24);}
  point(x,y){const p=this.pet,r=this.radius,d=p.display;return {x:clamp(x,(d.insetLeft||0)+r,d.w-(d.insetRight||0)-r),y:clamp(y,(d.insetTop||0)+r,d.h-(d.insetBottom||0)-r)};}
  place(){const p=this.pet;Object.assign(this,this.point(p.x+p.bodyW()*.82,p.y+p.bodyH()*.78));}
  hit(x,y){return this.phase==='ready'&&Math.hypot(x-this.x,y-this.y)<=this.radius+7;}
  grab(x,y,now=performance.now()){
    if(!this.hit(x,y))return false;
    this.phase='held';this.origin={x:this.pet.x,y:this.pet.y};this.vx=this.vy=0;
    this.last={x,y,now};return true;
  }
  move(x,y,now=performance.now()){
    if(this.phase!=='held')return;
    const dt=Math.max(.008,(now-this.last.now)/1000),q=this.point(x,y);
    this.vx=clamp((q.x-this.x)/dt,-1500,1500);this.vy=clamp((q.y-this.y)/dt,-1500,1500);
    this.x=q.x;this.y=q.y;this.last={x:q.x,y:q.y,now};
  }
  release(now=performance.now()){
    if(this.phase!=='held')return;
    if(now-this.last.now>120)this.vx=this.vy=0;
    this.target=this.point(this.x+this.vx*.22,this.y+this.vy*.22);
    this.from={x:this.x,y:this.y};this.elapsed=0;this.phase='flight';
    this.pet.say('Fetch!');
  }
  cancel(){const p=this.pet;if(this.phase!=='ready'){p.x=this.origin.x;p.y=this.origin.y;p.clampPos();}p.fetch=null;if(p.mode==='fetch')p.mode='idle';}
  step(dt){
    const p=this.pet;
    if(p.settings.paused||p.quiet||p.drag||p.mode!=='fetch'){this.cancel();return;}
    p.idleT=0;
    if(this.phase==='flight'){
      this.elapsed+=dt;const t=Math.min(1,this.elapsed/.55),q=this.point(this.from.x+(this.target.x-this.from.x)*t,this.from.y+(this.target.y-this.from.y)*t-Math.sin(t*Math.PI)*Math.min(100,p.bodyH()*.6));
      this.x=q.x;this.y=q.y;if(t===1)this.phase='chase';
    }
    if(this.phase==='flight'||this.phase==='chase'||this.phase==='return'){
      const destination=this.phase==='return'?this.origin:{x:this.x-p.bodyW()*.5,y:this.y-p.bodyH()*.65};
      // Compute a reachable pet position, including work-area insets.
      const old={x:p.x,y:p.y};p.x=destination.x;p.y=destination.y;p.clampPos();const goal={x:p.x,y:p.y};p.x=old.x;p.y=old.y;
      const dx=goal.x-p.x,dy=goal.y-p.y,d=Math.hypot(dx,dy),step=Math.min(d,Math.max(180,p.bodyW()*2.8)*dt);
      if(d){p.x+=dx/d*step;p.y+=dy/d*step;}
      if(d<3&&this.phase==='chase'){this.phase='pickup';this.elapsed=0;}
      if(d<3&&this.phase==='return'){p.x=goal.x;p.y=goal.y;this.phase='ready';this.place();p.say('Again? Drag the toy and release!');}
    }else if(this.phase==='pickup'){
      this.elapsed+=dt;if(this.elapsed>.3)this.phase='return';
    }
  }
  draw(ctx){
    if(this.phase==='return')return; // Carried by the character renderer.
    const r=this.radius;ctx.save();ctx.translate(Math.round(this.x),Math.round(this.y));
    if(this.pet.settings.renderMode==='3d'){
      const g=ctx.createRadialGradient(-r*.35,-r*.4,1,0,0,r);g.addColorStop(0,'#e9c5ff');g.addColorStop(1,'#8656a5');ctx.fillStyle=g;
      ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffd48c';ctx.fillRect(-r*.17,-r*.85,r*.34,r*1.7);
    }else{
      ctx.fillStyle='#593771';ctx.fillRect(-r,-r*.65,r*2,r*1.3);ctx.fillRect(-r*.65,-r,r*1.3,r*2);
      ctx.fillStyle='#b18ccd';ctx.fillRect(-r*.75,-r*.65,r*1.5,r*1.3);ctx.fillStyle='#ffd48c';ctx.fillRect(-r*.18,-r*.65,r*.36,r*1.3);
    }
    ctx.restore();
  }
}

// Capture-phase listeners keep a toy grab separate from dragging the pet.
export function bindFetch(canvas,pet,ignore=()=>{}){
  let pointer=null;
  const finish=(e,cancel=false)=>{
    if(pointer===null||e.pointerId!==pointer)return;
    e.stopImmediatePropagation();const id=pointer;pointer=null;
    if(cancel)pet.fetch?.cancel();else pet.fetch?.release();
    if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
    ignore(!pet.hitTest(e.clientX,e.clientY));
  };
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0||pet.settings.paused||pet.quiet||!pet.fetch?.grab(e.clientX,e.clientY))return;
    e.stopImmediatePropagation();pointer=e.pointerId;canvas.setPointerCapture(pointer);ignore(false);
  },true);
  canvas.addEventListener('pointermove',e=>{if(pointer!==e.pointerId)return;e.stopImmediatePropagation();pet.fetch?.move(e.clientX,e.clientY);},true);
  canvas.addEventListener('pointerup',e=>finish(e),true);
  canvas.addEventListener('pointercancel',e=>finish(e,true),true);
  canvas.addEventListener('lostpointercapture',e=>finish(e,true),true);
  window.addEventListener('blur',()=>{if(pointer!==null){const id=pointer;pointer=null;pet.fetch?.cancel();if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);ignore(true);}});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'){pet.fetch?.cancel();ignore(true);}});
  return ()=>{
    if(pointer!==null&&!pet.fetch){const id=pointer;pointer=null;if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);ignore(true);}
    return pointer!==null;
  };
}
