/* Run on the loaded atlas at desktop/mobile sizes. */
(async()=>{
  const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
  const pause=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  await pause();
  const wide=innerWidth>=1000&&innerHeight>=600;
  assert(document.body.classList.contains('dashboard-mode')===wide,'Responsive dashboard mode');
  assert(document.documentElement.scrollWidth<=innerWidth+1,'No horizontal page overflow');
  if(wide){
    window.scrollTo(0,0);await pause();
    for(const view of ['europe','north','med']){
      document.querySelector(`[data-view="${view}"]`).click();await pause();
      const panels=[...document.querySelector('.atlas').children].map(e=>e.getBoundingClientRect());
      assert(panels.length===3,'Three dashboard columns');
      assert(panels.every(p=>p.top>=0&&p.bottom<=innerHeight+1),'Every working panel fits the viewport');
      assert(panels[0].right<panels[1].left&&panels[1].right<panels[2].left,'Map, register, inspector are horizontal');
      const pager=document.querySelector('.pagination').getBoundingClientRect();
      assert(pager.bottom<=innerHeight+1,'Pagination always visible');
    }
    const inspector=document.querySelector('.inspect-panel');inspector.scrollTop=9999;
    const first=document.querySelector('#register button');first.click();await pause();
    const next=document.querySelectorAll('#register button')[1];next?.click();await pause();
    assert(inspector.scrollTop===0,'New selection reveals the image at top of inspector');
  }else{
    const map=document.querySelector('.chart').getBoundingClientRect(),reg=document.querySelector('.register-panel').getBoundingClientRect();
    assert(reg.top>=map.bottom-1,'Mobile panels stack');
  }
  return {pass:true,horizontal:wide,viewport:[innerWidth,innerHeight]};
})();
