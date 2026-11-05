// Distances are anchors on the calculated track, not claims of photographic visibility.
export function nearestPhoto(photos, distance, radius) {
  return photos.reduce((nearest, photo) => {
    const delta = Math.abs(photo.distance - distance);
    return delta <= radius && (!nearest || delta < Math.abs(nearest.distance - distance)) ? photo : nearest;
  }, null);
}

export async function createPhotoPanel() {
  const panel = document.getElementById('route-photos');
  const response = await fetch('data/photos.json');
  if (!response.ok) throw new Error(`Photo metadata: HTTP ${response.status}`);
  const {photos, radius} = await response.json();
  const image = panel.querySelector('img');
  const figure = panel.querySelector('figure');
  const empty = panel.querySelector('.photo-empty');
  let selected;
  image.addEventListener('error', () => {
    image.hidden = true;
    panel.querySelector('.photo-error').hidden = false;
  });
  const update = distance => {
    const photo = nearestPhoto(photos, distance, radius);
    if (photo === selected) return;
    selected = photo;
    figure.hidden = !photo;
    empty.hidden = !!photo;
    if (!photo) return;
    image.hidden = false;
    panel.querySelector('.photo-error').hidden = true;
    image.alt = photo.alt;
    image.src = photo.src;
    panel.querySelector('.photo-title').textContent = photo.title;
    panel.querySelector('.photo-context').textContent = `${(photo.distance / 1000).toFixed(2)} km · ${photo.date} · camera ${photo.offset} m from track`;
    const source = panel.querySelector('.photo-source');
    source.textContent = `Photo: ${photo.author}`;
    source.href = photo.source;
  };
  return {photos, radius, update};
}

// Semantic DOM buttons keep the WebGL track and SVG profile keyboard accessible.
// Locations are projected from route-distance anchors, never from off-track cameras.
export function createPhotoMarkers({photos, radius, map, profile, pointAt, onSelect}) {
  if (!photos.length) return {layout() {}, update() {}};
  const layer = (className, name) => {
    const element = document.createElement('div');
    element.className = className;
    element.setAttribute('role','group');
    element.setAttribute('aria-label',name);
    return element;
  };
  const mapLayer = layer('photo-map-markers','Photo stops on the route');
  map.append(mapLayer);
  const plot = document.createElement('div');
  plot.className = 'photo-profile-plot';
  profile.before(plot);
  plot.append(profile);
  profile.setAttribute('preserveAspectRatio','none');
  const profileLayer = layer('photo-profile-markers','Photo stops on the elevation profile');
  plot.append(profileLayer);
  const stops = [...photos].sort((a,b)=>a.distance-b.distance).map((photo,index)=>{
    const button = (parent, location) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'photo-pin';
      element.dataset.photoId = photo.id;
      element.dataset.photoLocation = location;
      const description = `Photo ${index+1}: ${photo.title}, ${(photo.distance/1000).toFixed(2)} km. Jump to this route position.`;
      element.setAttribute('aria-label',description);
      element.setAttribute('aria-controls','timeline route-photos');
      element.setAttribute('aria-pressed','false');
      element.title = description;
      const badge = document.createElement('span');
      badge.className = 'photo-pin-badge';
      badge.textContent = index+1;
      badge.setAttribute('aria-hidden','true');
      element.append(badge);
      element.addEventListener('click',()=>onSelect(photo.distance));
      parent.append(element);
      return element;
    };
    return {photo, mapButton:button(mapLayer,'map'), profileButton:button(profileLayer,'profile')};
  });
  const position = (button,point) => {
    button.hidden = !Number.isFinite(point.x) || !Number.isFinite(point.y)
      || point.x<0 || point.x>1 || point.y<0 || point.y>1;
    button.style.left = `${point.x*100}%`;
    button.style.top = `${point.y*100}%`;
  };
  return {
    layout() {
      for (const stop of stops) {
        const point = pointAt(stop.photo.distance);
        position(stop.mapButton,point.map);
        position(stop.profileButton,point.profile);
      }
    },
    update(distance) {
      const active = nearestPhoto(photos,distance,radius);
      for (const stop of stops) {
        const selected = String(stop.photo.id===active?.id);
        stop.mapButton.setAttribute('aria-pressed',selected);
        stop.profileButton.setAttribute('aria-pressed',selected);
      }
    }
  };
}
