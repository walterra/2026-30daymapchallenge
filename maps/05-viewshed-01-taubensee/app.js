import * as THREE from './vendor/three.module.min.js';
import {appearance,rgb} from './appearance.mjs';
import {createPhotoPanel,createPhotoMarkers} from './photos.mjs';
let updatePhoto = () => {};
let photoData = {photos:[],radius:0};
let photoMarkers;

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
let renderer, scene, camera, data, visibility, marker, completed, positions;
let atlases = [];
let view = null;
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
function label(text, x, y, {size = 22, color = appearance.contextInk, offset = 0, weight = 'bold'} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 3072; canvas.height = 288;
  const ctx = canvas.getContext('2d');
  ctx.font = `${weight} 96px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 12; ctx.strokeStyle = appearance.contextHalo; ctx.strokeText(text, 1536, 144);
  ctx.fillStyle = color; ctx.fillText(text, 1536, 144);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map: texture, depthTest: false}));
  sprite.scale.set(size * 10.66, size, 1);
  sprite.position.copy(world(x, y, 5)); sprite.position.y += offset;
  sprite.userData.label = {pixels:size >= 50 ? 14 : 11, offset,
    x:sprite.position.x, y:sprite.position.y-offset, textFraction:ctx.measureText(text).width/canvas.width};
  sprite.renderOrder = 10; scene.add(sprite);
}
function contextLabel(feature, kind = 'region') {
  // Quiet basemap context: the same monospace family, lighter weight and wider tracking.
  // Rasterize well above display density; no external font dependency.
  const canvas = document.createElement('canvas');
  canvas.width = 3072; canvas.height = 768;
  const ctx = canvas.getContext('2d');
  const fontSize = 220, tracking = kind === 'range' ? 88 : 54;
  const rise = kind === 'range' ? 70 : 88;
  ctx.font = `600 ${fontSize}px monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = appearance.contextInk; ctx.strokeStyle = appearance.contextHalo; ctx.lineWidth = 18;
  ctx.lineJoin = 'round';
  const glyphs = [...feature.name];
  const advances = glyphs.map(glyph=>ctx.measureText(glyph).width);
  const length = advances.reduce((sum,value)=>sum+value,0)+tracking*(glyphs.length-1);
  let distance = -length/2;
  glyphs.forEach((glyph,i)=>{
    const x = distance+advances[i]/2;
    const u = x/(length/2);
    const y = canvas.height/2+rise*u*u;
    const tangent = 2*rise*u/(length/2);
    ctx.save(); ctx.translate(canvas.width/2+x,y); ctx.rotate(Math.atan(tangent));
    ctx.strokeText(glyph,0,0); ctx.fillText(glyph,0,0); ctx.restore();
    distance += advances[i]+tracking;
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map:texture,depthTest:false,depthWrite:false,opacity:1,
    rotation:THREE.MathUtils.degToRad(kind === 'range' ? 3 : 8)
  }));
  sprite.name = feature.name;
  // Region sits in open valley; range lettering follows the northern ridge face.
  sprite.position.copy(kind === 'range'
    ? world(feature.x+60,feature.y-70,5)
    : world(feature.x-35,feature.y+20,5));
  sprite.userData.contextLabel = {kind,fontSize,width:canvas.width,height:canvas.height,
    x:sprite.position.x,y:sprite.position.y};
  // Preserve text contrast above the tint, but below routes and place names.
  sprite.renderOrder = 2.5; scene.add(sprite);
}
function tube(points, radius, color, z) {
  // Linear curve: do not introduce off-path Catmull-Rom smoothing.
  const curve = new THREE.CurvePath();
  for (let i = 1; i < points.length; i++) curve.add(new THREE.LineCurve3(world(...points[i-1],z),world(...points[i],z)));
  const geometry = new THREE.TubeGeometry(curve, points.length * 3, radius, 6, false);
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({color,depthTest:false,depthWrite:false,transparent:true}));
}
function resize() {
  if (!renderer) return;
  if (!document.body.classList.contains('capture') && innerWidth > 900) {
    const stage = document.querySelector('.experience');
    // Document coordinates keep sizing stable while scrolling the method notes.
    const top = stage.getBoundingClientRect().top + scrollY;
    const size = Math.max(320, Math.floor(innerHeight - top - 24));
    stage.style.setProperty('--map-size', `${size}px`);
  }
  const photoPanel = $('route-photos');
  if (innerWidth > 900 && !document.body.classList.contains('capture')) {
    const photoTop = photoPanel.getBoundingClientRect().top + scrollY;
    photoPanel.style.setProperty('--photo-height', `${Math.max(64, Math.min(170, innerHeight - photoTop - 196))}px`);
  } else photoPanel.style.removeProperty('--photo-height');
  const width = captureSize?.width ?? $('map').clientWidth;
  const height = captureSize?.height ?? $('map').clientHeight;
  const capturing = captureSize || document.body.classList.contains('capture');
  renderer.setPixelRatio(capturing ? 1 : Math.min(window.devicePixelRatio || 1,3));
  renderer.setSize(width, height, false);
  const aspect = width / height;
  // Fixed map extent, never follows the marker. North remains up.
  const spanY = view
    ? Math.max(view.height,view.width/aspect)
    : Math.max(data.height,data.width/aspect)*1.01;
  camera.left = -spanY * aspect / 2; camera.right = spanY * aspect / 2;
  camera.top = spanY / 2; camera.bottom = -spanY / 2;
  if (view) camera.position.copy(world(view.centerX,view.centerY,100));
  else camera.position.set(data.width/2,data.height/2,100);
  camera.updateProjectionMatrix();
  const unitsPerPixel = spanY / height;
  const placedLabels = [];
  for (const child of scene.children) {
    const context = child.userData.contextLabel;
    if (context) {
      const isRange = context.kind === 'range';
      const fontPixels = isRange
        ? THREE.MathUtils.clamp(width/24,15,24)
        : THREE.MathUtils.clamp(width/32,14,20);
      const scale = fontPixels/context.fontSize*unitsPerPixel;
      child.scale.set(context.width*scale,context.height*scale,1);
      child.position.y = isRange
        ? Math.max(context.y,camera.position.y+camera.bottom+(width<500?130:105)*unitsPerPixel)
        : context.y;
      // Keep the longer range name inside the visible ridge window.
      const halfTextWidth = child.scale.x*.46;
      child.position.x = THREE.MathUtils.clamp(context.x,
        camera.position.x+camera.left+halfTextWidth+8*unitsPerPixel,
        camera.position.x+camera.right-halfTextWidth-8*unitsPerPixel);
      continue;
    }
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
  photoMarkers?.layout();
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
  updatePhoto(distance);
  photoMarkers?.update(distance);
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
  const bootStart = performance.now();
  const response = await fetch('data/manifest.json');
  if (!response.ok) throw new Error(`Terrain manifest: HTTP ${response.status}`);
  data = await response.json();
  // Photographs are supplementary: a metadata failure must not disable the map.
  try {
    photoData = await createPhotoPanel();
    updatePhoto = photoData.update;
  }
  catch (error) {
    const message = document.querySelector('.photo-empty');
    message.hidden = false;
    message.textContent = 'Photographs unavailable. The terrain map remains usable.';
    console.warn('Photo panel:', error);
  }
  view = $('map').dataset.view ? JSON.parse($('map').dataset.view) : null;
  renderer = new THREE.WebGLRenderer({antialias:true, preserveDrawingBuffer:true, alpha:false});
  // resize() uses native density interactively and density 1 for exact-size exports.
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(appearance.noData);
  if (Math.max(data.atlasColumns*data.width,data.atlasRows*data.height)>renderer.capabilities.maxTextureSize)
    throw new Error(`This GPU cannot load the visibility atlas pages (${data.width*data.atlasColumns} × ${data.height*data.atlasRows} pixels).`);
  renderer.domElement.setAttribute('aria-hidden','true');
  $('map').prepend(renderer.domElement);
  scene = new THREE.Scene(); camera = new THREE.OrthographicCamera(-1,1,1,-1,.1,200);
  const loader = new THREE.TextureLoader();
  const loadTexture = async path => {
    try { return await loader.loadAsync(path); }
    catch { throw new Error(`Image failed to load: ${new URL(path,location.href).pathname}. Check the preview server and refresh.`); }
  };
  const [terrain,coverage] = await Promise.all([
    loadTexture('data/relief.png'),loadTexture('data/coverage.png')
  ]);
  coverage.minFilter = coverage.magFilter = THREE.NearestFilter;
  coverage.generateMipmaps = false;
  const pageWidth = data.width*data.atlasColumns;
  const pageHeight = data.height*data.atlasRows;
  const compressedAtlases = typeof DecompressionStream === 'function' && params.get('atlas') !== 'png';
  let loadedPages = 0;
  const loadAtlas = async file => {
    let red;
    if (compressedAtlases) {
      // Inflate directly to one byte per pixel: no image decode, canvas readback
      // or full-atlas JavaScript channel-copy loop.
      const path = `data/${file.replace(/\.png$/,'.bin.gz')}`;
      const response = await fetch(path);
      if (!response.ok) throw new Error(`Atlas ${path}: HTTP ${response.status}`);
      const packed = await response.arrayBuffer();
      const signature = new Uint8Array(packed,0,Math.min(2,packed.byteLength));
      // Some static hosts transparently decompress gzip responses.
      const raw = signature[0]===31 && signature[1]===139
        ? await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
        : packed;
      if (raw.byteLength!==pageWidth*pageHeight) throw new Error(`Invalid atlas byte length: ${path}`);
      red = new Uint8Array(raw);
    } else {
      // Compatibility fallback for browsers without native gzip streams.
      const source = await loadTexture(`data/${file}`);
      const canvas = document.createElement('canvas');
      canvas.width = source.image.width; canvas.height = source.image.height;
      const context = canvas.getContext('2d', {willReadFrequently:true});
      context.drawImage(source.image,0,0);
      const rgba = context.getImageData(0,0,canvas.width,canvas.height).data;
      red = new Uint8Array(canvas.width*canvas.height);
      for (let i=0;i<red.length;i++) red[i]=rgba[i*4];
      source.dispose(); source.source.data=null;
      canvas.width=canvas.height=0;
    }
    const texture = new THREE.DataTexture(red,pageWidth,pageHeight,THREE.RedFormat);
    texture.minFilter=texture.magFilter=THREE.NearestFilter;
    texture.generateMipmaps=false; texture.needsUpdate=true;
    $('loading').textContent=`Preparing visibility ${++loadedPages}/${data.atlasFiles.length}…`;
    return texture;
  };
  // Two in flight balances startup latency against memory pressure on Safari.
  for (let i=0;i<data.atlasFiles.length;i+=2) {
    atlases.push(...await Promise.all(data.atlasFiles.slice(i,i+2).map(loadAtlas)));
  }
  state.atlasFormat = compressedAtlases ? 'gzip-red8' : 'png-fallback';
  // Work in stored display-space gray values, matching the tested palette math.
  terrain.colorSpace = THREE.NoColorSpace;
  const terrainMesh = new THREE.Mesh(new THREE.PlaneGeometry(data.width,data.height),new THREE.ShaderMaterial({
    uniforms:{terrain:{value:terrain},coverage:{value:coverage},
      paper:{value:new THREE.Vector3(...rgb(appearance.basePaper))},
      shadow:{value:new THREE.Vector3(...rgb(appearance.reliefShadow))},
      reliefStrength:{value:appearance.reliefStrength},
      missing:{value:new THREE.Vector3(...rgb(appearance.noData))},
      hatchInk:{value:new THREE.Vector3(...rgb(appearance.noDataHatch))},
      gridSize:{value:new THREE.Vector2(data.width,data.height)}},
    vertexShader:'varying vec2 mapUV;void main(){mapUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`uniform sampler2D terrain;uniform sampler2D coverage;
      uniform vec3 paper;uniform vec3 shadow;uniform float reliefStrength;uniform vec3 missing;uniform vec3 hatchInk;
      uniform vec2 gridSize;varying vec2 mapUV;
      void main(){
        float known=step(0.5,texture2D(coverage,mapUV).r);
        float slopeShade=texture2D(terrain,mapUV).r;
        vec3 relief=mix(paper,shadow,(1.0-slopeShade)*reliefStrength);
        vec2 cell=floor(mapUV*gridSize);
        float hatch=1.0-step(1.0,mod(cell.x+cell.y,14.0));
        gl_FragColor=vec4(mix(mix(missing,hatchInk,hatch),relief,known),1.0);
      }`
  }));
  terrainMesh.position.set(data.width/2,data.height/2,0); scene.add(terrainMesh);
  visibility = new THREE.Mesh(new THREE.PlaneGeometry(data.width,data.height),new THREE.ShaderMaterial({
    uniforms:{atlas:{value:atlases[0]},coverage:{value:coverage},frame:{value:0},
      fillColor:{value:new THREE.Vector3(...rgb(appearance.visibleFill))},
      boundary:{value:new THREE.Vector3(...rgb(appearance.visibleBoundary))},
      ink:{value:new THREE.Vector3(...rgb(appearance.unlitShade))},
      fillOpacity:{value:appearance.fillOpacity},shadeOpacity:{value:appearance.shadeOpacity},
      columns:{value:data.atlasColumns},rows:{value:data.atlasRows},gridSize:{value:new THREE.Vector2(data.width,data.height)}},
    transparent:true,depthWrite:false,
    vertexShader:'varying vec2 mapUV; void main(){mapUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`uniform sampler2D atlas;uniform sampler2D coverage;
      uniform float frame;uniform float columns;uniform float rows;uniform vec2 gridSize;varying vec2 mapUV;
      uniform vec3 fillColor;uniform vec3 boundary;uniform vec3 ink;uniform float fillOpacity;uniform float shadeOpacity;
      float maskAt(vec2 offset){
        vec2 cell=clamp(floor(vec2(mapUV.x,1.0-mapUV.y)*gridSize)+offset,vec2(0.0),gridSize-1.0);
        vec2 uv=(vec2(mod(frame,columns),floor(frame/columns))+(cell+0.5)/gridSize)/vec2(columns,rows);
        return step(0.5,texture2D(atlas,uv).r);
      }
      void main(){
        float known=step(0.5,texture2D(coverage,mapUV).r);
        float visible=maskAt(vec2(0.0));
        vec4 adjacent=vec4(maskAt(vec2(-1.0,0.0)),maskAt(vec2(1.0,0.0)),maskAt(vec2(0.0,-1.0)),maskAt(vec2(0.0,1.0)));
        float edge=visible*(1.0-min(min(adjacent.x,adjacent.y),min(adjacent.z,adjacent.w)));
        // Outline inside the mask only. Isolated cells retain the light fill.
        edge*=step(1.5,dot(adjacent,vec4(1.0)));
        gl_FragColor=vec4(mix(ink,mix(fillColor,boundary,edge),visible),known*mix(shadeOpacity,mix(fillOpacity,1.0,edge),visible));
      }`
  }));
  visibility.position.set(data.width/2,data.height/2,1);
  visibility.renderOrder = 2; scene.add(visibility);
  const pts = data.route.map(r=>[r[0],r[1]]);
  const casing = tube(pts,3.0,'#fafafa',2); casing.renderOrder=3; scene.add(casing);
  const routeMesh = tube(pts,1.7,'#cb2a42',3); routeMesh.renderOrder=4; scene.add(routeMesh);
  const geometry = new THREE.BufferGeometry();
  positions = new Float32Array((data.route.length+1)*3);
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  completed = new THREE.Line(geometry,new THREE.LineBasicMaterial({color:'#651522',depthTest:false,depthWrite:false,transparent:true}));
  completed.renderOrder=5; completed.frustumCulled=false; scene.add(completed);
  marker = new THREE.Group(); marker.renderOrder=15;
  const halo = new THREE.Mesh(new THREE.CircleGeometry(7.5,32),new THREE.MeshBasicMaterial({color:'#ffffff',depthTest:false,depthWrite:false,transparent:true}));
  const dot = new THREE.Mesh(new THREE.CircleGeometry(4.8,32),new THREE.MeshBasicMaterial({color:'#cb2a42',depthTest:false,depthWrite:false,transparent:true}));
  dot.position.z=.1; halo.renderOrder=15;dot.renderOrder=16;
  marker.add(halo,dot); scene.add(marker);
  const first = data.route[0], last = data.route.at(-1);
  label('KÖSSEN · DORF',first[0],first[1],{size:40,offset:-24});
  label((data.destination ?? 'Taubenseehütte').toLocaleUpperCase('de'),last[0],last[1],{size:40,offset:25});
  for (const waypoint of data.waypointLabels ?? []) {
    label(waypoint.name,waypoint.x,waypoint.y,{size:34,offset:18});
  }
  for (const region of data.regionLabels ?? []) {
    contextLabel(region);
  }
  for (const landmark of data.landmarks) {
    if (landmark.name === 'WILDER KAISER') contextLabel(landmark,'range');
    else label(landmark.name,landmark.x,landmark.y,{size:55,offset:view?34:-34});
  }
  // Scale bar is in the same metric space as the terrain.
  const barX = view ? view.centerX+view.width/2-160 : 60;
  const barY = view ? view.centerY+view.height/2-130 : data.height-130;
  const bar = new THREE.Line(new THREE.BufferGeometry().setFromPoints([world(barX,barY,5),world(barX+100,barY,5)]),new THREE.LineBasicMaterial({color:appearance.contextInk,depthTest:false,depthWrite:false,transparent:true}));
  bar.renderOrder = 10; scene.add(bar); label('2 km',barX+50,barY,{size:36,offset:18});
  const elevations = data.route.map(r=>r[2]), lo = Math.min(...elevations)-30, hi = Math.max(...elevations)+30;
  const profile = data.route.map(r=>`${(r[3]/data.distance*1000).toFixed(2)},${(95-(r[2]-lo)/(hi-lo)*90).toFixed(2)}`);
  $('profile-line').setAttribute('d',`M${profile.join(' L')}`);
  $('profile-area').setAttribute('d',`M0,100 L${profile.join(' L')} L1000,100 Z`);
  photoMarkers = createPhotoMarkers({
    ...photoData,map:$('map'),profile:$('profile'),
    onSelect(distance) {pause();draw(distance/data.distance*duration);},
    pointAt(distance) {
      const p=routePosition(distance);
      return {
        map:{x:(p.x+.5-camera.position.x-camera.left)/(camera.right-camera.left),
          y:(camera.position.y+camera.top-(data.height-p.y-.5))/(camera.top-camera.bottom)},
        profile:{x:distance/data.distance,y:(95-(p.elevation-lo)/(hi-lo)*90)/100}
      };
    }
  });
  if (params.has('capture')) document.body.classList.add('capture');
  state.ready=true;
  resize(); draw(0);
  state.startupMs = Math.round(performance.now()-bootStart);
  $('loading').hidden=true;
  for (const id of ['play','timeline','speed','reset']) $(id).disabled=false;
  $('play').addEventListener('click',()=>{
    if (playing) pause();
    else {if(seconds>=duration)draw(0);playing=true;lastTick=0;$('play').textContent='❚❚ Pause';$('play').setAttribute('aria-label','Pause animation');}
  });
  $('timeline').addEventListener('input',()=>{pause();draw(Number($('timeline').value));});
  $('reset').addEventListener('click',()=>{pause();draw(0);});
  const layoutObserver = new ResizeObserver(resize);
  layoutObserver.observe($('map'));
  layoutObserver.observe(document.querySelector('.intro'));
  window.addEventListener('resize',resize);
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
  get current(){return {time:seconds,frame:currentFrame,playing};},
  get framing(){
    if(!state.ready) return null;
    return {centerX:camera.position.x-.5,centerY:data.height-camera.position.y-.5,
      width:camera.right-camera.left,height:camera.top-camera.bottom};
  }
};
window.viewshed.ready = init();
// Attach UI handling without creating another unhandled rejected promise.
// Callers awaiting ready still receive the original rejection.
window.viewshed.ready.catch(error=>{
  state.ready=false;
  state.error=error instanceof Error ? error.message : String(error);
  $('loading').hidden=false;
  $('loading').setAttribute('role','alert');
  $('loading').textContent=`Unable to load the map: ${state.error}`;
  for (const id of ['play','timeline','speed','reset']) $(id).disabled=true;
  console.error('Viewshed initialization failed:',error);
});
