/* Keep the whole working dashboard in the desktop viewport; notes remain below. */
export function setupDashboardLayout() {
  const atlas=document.querySelector('.atlas');
  const query=matchMedia('(min-width:1000px) and (min-height:600px)');
  let frame;
  const fit=()=>{
    frame=undefined;
    document.body.classList.toggle('dashboard-mode',query.matches);
    if(!query.matches){atlas.style.removeProperty('--dashboard-height');return;}
    const top=atlas.getBoundingClientRect().top+scrollY;
    atlas.style.setProperty('--dashboard-height',`${Math.max(220,Math.floor(innerHeight-top-18))}px`);
  };
  const schedule=()=>{if(frame===undefined)frame=requestAnimationFrame(fit);};
  const observer=new ResizeObserver(schedule);
  for(const selector of ['.site-header','.intro','.view-controls','#filters','.result-line','#status']){
    const element=document.querySelector(selector);if(element)observer.observe(element);
  }
  window.addEventListener('resize',schedule);query.addEventListener('change',schedule);
  document.fonts.ready.then(schedule);fit();
}
