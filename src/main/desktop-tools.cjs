function selectDisplay(displays, primary, saved) {
  return displays.find(d => String(d.id) === saved) || primary;
}
function petMenu(s, displays, {patch, routine, settings, quit}) {
  return [
    {label:s.petName || "Your companion",enabled:false},
    {label:"Style",submenu:["pixel","3d"].map(mode=>({label:mode==="3d"?"3D":"Pixel",type:"radio",checked:s.renderMode===mode,click:()=>patch({renderMode:mode})}))},
    {label:"Pause reactions",type:"checkbox",checked:!!s.paused,click:item=>patch({paused:item.checked})},
    {label:"Mute sounds",type:"checkbox",checked:!s.soundEnabled,click:item=>patch({soundEnabled:!item.checked})},
    {label:s.pomodoroEnabled?"Stop focus timer":"Start focus timer",click:()=>patch({pomodoroEnabled:!s.pomodoroEnabled})},
    {label:"Quiet mode",type:"checkbox",checked:!!s.quietManual,click:item=>patch({quietManual:item.checked})},
    {label:"Little routines",submenu:["groom","chase","toy","sleep"].map(name=>({label:{groom:"Groom",chase:"Chase tail",toy:"Bring a toy",sleep:"Curl up"}[name],click:()=>routine(name)}))},
    {label:"Home screen",submenu:[{label:"Primary screen",type:"radio",checked:s.homeDisplay==="primary",click:()=>patch({homeDisplay:"primary"})},...displays.map(d=>({label:d.label,type:"radio",checked:s.homeDisplay===d.id,click:()=>patch({homeDisplay:d.id})}))]},
    {label:"Home corner",submenu:["top-left","top-right","bottom-left","bottom-right"].map(c=>({label:c.replace("-"," "),type:"radio",checked:s.homeCorner===c,click:()=>patch({homeCorner:c})}))},
    {type:"separator"},{label:"Settings",click:settings},{label:"Quit Nyapix",click:quit}
  ];
}
module.exports={selectDisplay,petMenu};
