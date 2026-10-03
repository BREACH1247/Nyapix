const {test}=require('node:test');
const assert=require('node:assert/strict');
const {selectDisplay,petMenu}=require('../src/main/desktop-tools.cjs');
const {normalize}=require('../src/main/agent-relay.cjs');
test('display selection handles negative origins and missing screens',()=>{
  const primary={id:1,bounds:{x:0,y:0,width:1920,height:1080}};
  const secondary={id:2,bounds:{x:-1600,y:0,width:1600,height:900}};
  assert.equal(selectDisplay([primary,secondary],primary,'2'),secondary);
  assert.equal(selectDisplay([primary],primary,'2'),primary);
  assert.equal(selectDisplay([primary,secondary],primary,'primary'),primary);
});
test('quick menu actions update only their own preferences',()=>{
  const state={renderMode:'pixel',soundEnabled:true,homeDisplay:'primary'};
  let routine;
  const menu=petMenu(state,[{id:'2',label:'Second screen'}],{patch:p=>Object.assign(state,p),routine:n=>routine=n,settings(){},quit(){}});
  menu.find(m=>m.label==='Style').submenu[1].click();assert.equal(state.renderMode,'3d');
  menu.find(m=>m.label==='Mute sounds').click({checked:true});assert.equal(state.soundEnabled,false);
  menu.find(m=>m.label==='Pause reactions').click({checked:true});assert.equal(state.paused,true);
  menu.find(m=>m.label==='Start focus timer').click();assert.equal(state.pomodoroEnabled,true);
  menu.find(m=>m.label==='Home screen').submenu[1].click();assert.equal(state.homeDisplay,'2');
  menu.find(m=>m.label==='Home corner').submenu[0].click();assert.equal(state.homeCorner,'top-left');
  menu.find(m=>m.label==='Little routines').submenu[2].click();assert.equal(routine,'toy');
});
test('activity labels do not expose tool commands',()=>{
  for(const [tool,cmd,activity] of [['apply_patch','private path','editing'],['Bash','npm run test -- private','testing'],['Read','private','thinking']]) {
    const event=normalize('codex',{hook_event_name:'PreToolUse',tool_name:tool,tool_input:{command:cmd}});
    assert.equal(event.activity,activity);assert(!JSON.stringify(event).includes('private'));
  }
});
