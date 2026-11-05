import * as THREE from './vendor/three.module.min.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
let renderer, scene, camera, data, visibility, marker, completed, positions;
let atlases = [];
let seconds = 0, playing = false, lastTick = 0, currentFrame = -1;
let captureSize = null;
const state = { ready: false, error: null };
const duration = 30;

function pause() {
  playing = false;
  $('play').textContent = '▶ Play';
  $('play').setAttribute('aria-label', 'Play animation');
}
function routePosition(distance) {
  const route = data.route;
  let i = 1;
  while (i < route.length - 1 && route[i][3] < distance) i++;
  const a = route[i - 1], b = route[i];
  const t = Math.max(0, Math.min(1, (distance - a[3]) / (b[3] - a[3] || 1)));
  return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t,
    elevation: a[2] + (b[2] - a[2]) * t, index: i, t };
}
function world(x, y, z = 1) { return new THREE.Vector3(x + 0.5, data.height - y - 0.5, z); }
function label(text, x, y, {size = 22, color = '#ffffff', offset = 0} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 32px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 7; ctx.strokeStyle = '#22272aee'; ctx.strokeText(text, 512, 48);
  ctx.fillStyle = color; ctx.fillText(text, 512, 48);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map: texture, depthTest: false}));
  sprite.scale.set(size * 10.66, size, 1);
  sprite.position.copy(world(x, y, 5)); sprite.position.y += offset;
  sprite.userData.label = {pixels:size >= 50 ? 14 : 11, offset,
    x:sprite.position.x, y:sprite.position.y-offset, textFraction:ctx.measureText(text).width/1024};
  sprite.renderOrder = 10; scene.add(sprite);
}
function tube(points, radius, color, z) {
  // Linear curve: do not introduce off-path Catmull-Rom smoothing.
  const curve = new THREE.CurvePath();
  for (let i = 1; i < points.length; i++) curve.add(new THREE.LineCurve3(world(...points[i-1],z),world(...points[i],z)));
  const geometry = new THREE.TubeGeometry(curve, points.length * 3, radius, 6, false);
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({color, depthTest:false}));
}
function resize() {
  if (!renderer) return;
  const width = captureSize?.width ?? $('map').clientWidth;
  const height = captureSize?.height ?? $('map').clientHeight;
  renderer.setSize(width, height, false);
  const aspect = width / height;
  // Fixed map extent, never follows the marker. North remains up.
  const spanY = Math.max(data.height, data.width / aspect) * 1.01;
  camera.left = -spanY * aspect / 2; camera.right = spanY * aspect / 2;
  camera.top = spanY / 2; camera.bottom = -spanY / 2;
  camera.position.set(data.width/2, data.height/2, 100);
  camera.updateProjectionMatrix();
  const unitsPerPixel = spanY / height;
  const placedLabels = [];
  for (const child of scene.children) {
    const labelStyle = child.userData.label;
    if (!labelStyle) continue;
    const size = labelStyle.pixels * 3 * unitsPerPixel;
    child.scale.set(size * 10.66,size,1);
    child.position.y = labelStyle.y + Math.sign(labelStyle.offset)*18*unitsPerPixel;
    const halfWidth = size*10.66*labelStyle.textFraction/2;
    const margin = halfWidth+8*unitsPerPixel;
    child.position.x = THREE.MathUtils.clamp(labelStyle.x,
      camera.position.x+camera.left+margin,camera.position.x+camera.right-margin);
    const halfHeight = labelStyle.pixels*unitsPerPixel/2;
    // Separate nearby place names in narrow compositions (e.g. the valley ends).
    for (let pass=0;pass<placedLabels.length;pass++) {
      const collision = placedLabels.find(other=>
        Math.abs(child.position.x-other.x)<halfWidth+other.halfWidth+4*unitsPerPixel &&
        Math.abs(child.position.y-other.y)<halfHeight+other.halfHeight+4*unitsPerPixel);
      if (!collision) break;
      child.position.y = collision.y+collision.halfHeight+halfHeight+6*unitsPerPixel;
    }
    placedLabels.push({x:child.position.x,y:child.position.y,halfWidth,halfHeight});
  }
  marker?.scale.setScalar(unitsPerPixel);
  renderer.render(scene,camera);
}
function draw(time) {
  if (!state.ready) throw new Error('Wait for window.viewshed.ready before rendering.');
  if (!Number.isFinite(time)) throw new TypeError('timeSeconds must be finite');
  seconds = Math.max(0, Math.min(duration, time));
  const progress = seconds/duration;
  const distance = progress * data.distance;
  const p = routePosition(distance);
  marker.position.copy(world(p.x,p.y,8));
  // The closest precomputed observer, no interpolation of visibility claims.
  const frame = Math.round(progress*(data.frameCount-1));
  if (frame !== currentFrame) {
    currentFrame = frame;
    visibility.material.uniforms.frame.value = frame % data.atlasPageSize;
    visibility.material.uniforms.atlas.value = atlases[Math.floor(frame / data.atlasPageSize)];
  }
  // A dynamic line covers precisely the traversed network vertices.
  const n = p.index;
  for (let i=0; i<n; i++) {
    const v = world(data.route[i][0],data.route[i][1],4);
    positions.set([v.x,v.y,v.z],i*3);
  }
  const v = world(p.x,p.y,4); positions.set([v.x,v.y,v.z],n*3);
  completed.geometry.attributes.position.needsUpdate = true;
  completed.geometry.setDrawRange(0,n+1);
  $('timeline').value = seconds;
  $('progress').textContent = `${Math.round(progress*100)}%`;
  $('distance').textContent = `${(distance/1000).toFixed(2)} km`;
  $('map-distance').textContent = `${(distance/1000).toFixed(2)} / ${(data.distance/1000).toFixed(2)} km`;
  $('elevation').textContent = `${Math.round(p.elevation).toLocaleString('en')} m`;
  $('area').textContent = `${(data.visibleCells[frame]*data.cellSize**2/1e6).toFixed(2)} km²`;
  const profileX = progress*1000;
  const elevations = data.route.map(r=>r[2]);
  const lo = Math.min(...elevations)-30, hi = Math.max(...elevations)+30;
  $('profile-cursor').setAttribute('x1',profileX); $('profile-cursor').setAttribute('x2',profileX);
  $('profile-dot').setAttribute('cx',profileX);
  $('profile-dot').setAttribute('cy',95-(p.elevation-lo)/(hi-lo)*90);
  renderer.render(scene,camera);
  return {time:seconds, frame, distance, elevation:p.elevation};
}
function tick(now) {
  if (playing) {
    const dt = lastTick ? (now-lastTick)/1000 : 0;
    draw(Math.min(duration, seconds+dt*Number($('speed').value)));
    if (seconds >= duration) pause();
  }
  lastTick = now;
  requestAnimationFrame(tick);
}
async function init() {
  const response = await fetch('data/manifest.json');
  if (!response.ok) throw new Error(`Terrain manifest: HTTP ${response.status}`);
  data = await response.json();
  renderer = new THREE.WebGLRenderer({antialias:true, preserveDrawingBuffer:true, alpha:false});
  renderer.setPixelRatio(1); // Same pixel output on Retina and non-Retina machines.
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor('#242728');
  if (Math.max(data.atlasColumns*data.width,data.atlasRows*data.height)>renderer.capabilities.maxTextureSize)
    throw new Error(`This GPU cannot load the visibility atlas pages (${data.width*data.atlasColumns} × ${data.height*data.atlasRows} pixels).`);
  renderer.domElement.setAttribute('aria-hidden','true');
  $('map').prepend(renderer.domElement);
  scene = new THREE.Scene(); camera = new THREE.OrthographicCamera(-1,1,1,-1,.1,200);
  const loader = new THREE.TextureLoader();
  const terrain = await loader.loadAsync('data/terrain.png');
  // One byte per atlas pixel instead of four: keep the expanded 20 m grid
  // without multiplying GPU memory use by the number of color channels.
  for (const file of data.atlasFiles) {
    const source = await loader.loadAsync(`data/${file}`);
    const canvas = document.createElement('canvas');
    canvas.width = source.image.width; canvas.height = source.image.height;
    const context = canvas.getContext('2d', {willReadFrequently:true});
    context.drawImage(source.image,0,0);
    const rgba = context.getImageData(0,0,canvas.width,canvas.height).data;
    const red = new Uint8Array(canvas.width*canvas.height);
    for (let i=0;i<red.length;i++) red[i]=rgba[i*4];
    const texture = new THREE.DataTexture(red,canvas.width,canvas.height,THREE.RedFormat);
    texture.minFilter = texture.magFilter = THREE.NearestFilter;
    texture.generateMipmaps = false; texture.needsUpdate = true;
    atlases.push(texture);
    source.dispose(); source.source.data = null;
    canvas.width = canvas.height = 0;
  }
  terrain.colorSpace = THREE.SRGBColorSpace;
  const terrainMesh = new THREE.Mesh(new THREE.PlaneGeometry(data.width,data.height),new THREE.MeshBasicMaterial({map:terrain}));
  terrainMesh.position.set(data.width/2,data.height/2,0); scene.add(terrainMesh);
  visibility = new THREE.Mesh(new THREE.PlaneGeometry(data.width,data.height),new THREE.ShaderMaterial({
    uniforms:{atlas:{value:atlases[0]},frame:{value:0},columns:{value:data.atlasColumns},rows:{value:data.atlasRows},gridSize:{value:new THREE.Vector2(data.width,data.height)}},
    transparent:true,depthWrite:false,
    vertexShader:'varying vec2 mapUV; void main(){mapUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`uniform sampler2D atlas;uniform float frame;uniform float columns;uniform float rows;uniform vec2 gridSize;varying vec2 mapUV;
      void main(){vec2 pixel=(floor(vec2(mapUV.x,1.0-mapUV.y)*gridSize)+0.5)/gridSize;
      vec2 uv=(vec2(mod(frame,columns),floor(frame/columns))+pixel)/vec2(columns,rows);
      float visible=texture2D(atlas,uv).r;gl_FragColor=vec4(0.796,0.165,0.259,visible*0.46);}`
  }));
  visibility.position.set(data.width/2,data.height/2,1); scene.add(visibility);
  const pts = data.route.map(r=>[r[0],r[1]]);
  const casing = tube(pts,3.0,'#fafafa',2); casing.renderOrder=2; scene.add(casing);
  const routeMesh = tube(pts,1.7,'#cb2a42',3); routeMesh.renderOrder=3; scene.add(routeMesh);
  const geometry = new THREE.BufferGeometry();
  positions = new Float32Array((data.route.length+1)*3);
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  completed = new THREE.Line(geometry,new THREE.LineBasicMaterial({color:'#651522',depthTest:false}));
  completed.renderOrder=4; completed.frustumCulled=false; scene.add(completed);
  marker = new THREE.Group(); marker.renderOrder=15;
  const halo = new THREE.Mesh(new THREE.CircleGeometry(7.5,32),new THREE.MeshBasicMaterial({color:'#ffffff',depthTest:false}));
  const dot = new THREE.Mesh(new THREE.CircleGeometry(4.8,32),new THREE.MeshBasicMaterial({color:'#cb2a42',depthTest:false}));
  dot.position.z=.1; halo.renderOrder=15;dot.renderOrder=16;
  marker.add(halo,dot); scene.add(marker);
  const first = data.route[0], last = data.route.at(-1);
  label('KÖSSEN · DORF',first[0],first[1],{size:40,offset:-24});
  label((data.destination ?? 'Taubenseehütte').toLocaleUpperCase('de'),last[0],last[1],{size:40,offset:25});
  for (const waypoint of data.waypointLabels ?? []) {
    label(waypoint.name,waypoint.x,waypoint.y,{size:34,offset:18});
  }
  for (const landmark of data.landmarks) {
    label(landmark.name,landmark.x,landmark.y,{size:55,offset:-34});
  }
  // Scale bar is in the same metric space as the terrain.
  const bar = new THREE.Line(new THREE.BufferGeometry().setFromPoints([world(60,data.height-130,5),world(160,data.height-130,5)]),new THREE.LineBasicMaterial({color:'#ffffff',depthTest:false}));
  scene.add(bar); label('2 km',110,data.height-130,{size:36,offset:18});
  const elevations = data.route.map(r=>r[2]), lo = Math.min(...elevations)-30, hi = Math.max(...elevations)+30;
  const profile = data.route.map(r=>`${(r[3]/data.distance*1000).toFixed(2)},${(95-(r[2]-lo)/(hi-lo)*90).toFixed(2)}`);
  $('profile-line').setAttribute('d',`M${profile.join(' L')}`);
  $('profile-area').setAttribute('d',`M0,100 L${profile.join(' L')} L1000,100 Z`);
  if (params.has('capture')) document.body.classList.add('capture');
  state.ready=true;
  resize(); draw(0);
  $('loading').hidden=true;
  for (const id of ['play','timeline','speed','reset']) $(id).disabled=false;
  $('play').addEventListener('click',()=>{
    if (playing) pause();
    else {if(seconds>=duration)draw(0);playing=true;lastTick=0;$('play').textContent='❚❚ Pause';$('play').setAttribute('aria-label','Pause animation');}
  });
  $('timeline').addEventListener('input',()=>{pause();draw(Number($('timeline').value));});
  $('reset').addEventListener('click',()=>{pause();draw(0);});
  new ResizeObserver(resize).observe($('map'));
  requestAnimationFrame(tick);
  return {duration,frameCount:data.frameCount,distance:data.distance};
}
window.viewshed = {
  state, duration,
  renderAt(timeSeconds){pause();return draw(timeSeconds);},
  setCapture({width=1200,height=900}={}){
    if(!state.ready) throw new Error('Wait for viewshed.ready');
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<100||height<100||width>4096||height>4096)throw new RangeError('Capture dimensions: integer 100–4096');
    pause();document.body.classList.add('capture');captureSize={width,height};
    $('map').style.width=`${width}px`;$('map').style.height=`${height}px`;resize();draw(seconds);
  },
  png(){if(!state.ready)throw new Error('Wait for viewshed.ready');return renderer.domElement.toDataURL('image/png');},
  get current(){return {time:seconds,frame:currentFrame,playing};}
};
window.viewshed.ready = init().catch(error=>{
  state.error=error.message;
  $('loading').hidden=false;
  $('loading').textContent=`Unable to load the map: ${error.message}. Try a browser with WebGL support.`;
  console.error(error);
  throw error;
});
