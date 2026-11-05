/* Block **/relief.png in an isolated browser session, load either entry, then:
   agent-browser eval --stdin < scripts/check-viewshed-load-error.js
   Remove the network interception afterwards. */
(async () => {
  const api=window.viewshed;
  const assert=(condition,message)=>{if(!condition)throw new Error(message);};
  let rejected=false;
  try {await api.ready;} catch {rejected=true;}
  assert(rejected && !api.state.ready,'Asset failure must reject readiness');
  const message=document.querySelector('#loading').textContent;
  assert(message.includes('relief.png'),'Message must identify the missing texture');
  assert(!message.includes('undefined') && !message.includes('WebGL support'),'Do not misdiagnose an image failure as WebGL');
  assert(document.querySelector('#loading').getAttribute('role')==='alert','Failure must be announced');
  for(const id of ['play','timeline','speed','reset'])assert(document.getElementById(id).disabled,'Keep controls disabled after load failure');
  return {result:'pass',message};
})();
