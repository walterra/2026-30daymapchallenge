/* Selected contextual images only. Local JPEGs retain unfiltered colours. */
export async function createShipPhotos() {
  const $=id=>document.getElementById(id);
  const figure=$('ship-photo'),img=$('ship-photo-image'),status=$('ship-photo-status');
  let images=new Map(),metadataError=false,epoch=0,current=null,failed=false;
  try {
    const response=await fetch('data/photos.json');
    if(!response.ok)throw new Error(`photos.json: HTTP ${response.status}`);
    const data=await response.json();
    images=new Map(data.images.map(photo=>[photo.id,photo]));
  } catch(error) {metadataError=true;console.warn('Ship images unavailable:',error);}
  return {
    update(feature) {
      const id=feature?.properties.id,photo=images.get(id);
      if(current===id&&!failed&&!metadataError)return;
      const token=++epoch;current=id;failed=false;
      img.onload=null;img.onerror=null;img.hidden=true;img.removeAttribute('src');
      if(!feature?.properties.featured){figure.hidden=true;current=null;return;}
      figure.hidden=false;figure.dataset.record=id;
      if(!photo){
        status.hidden=false;status.textContent=metadataError?'Images are unavailable. The map and source records remain usable.':'No image is available for this highlight.';
        $('ship-photo-caption').hidden=true;return;
      }
      $('ship-photo-caption').hidden=false;
      $('ship-photo-kind').textContent=photo.kind;
      $('ship-photo-description').textContent=`${feature.properties.name} · ${photo.caption}`;
      $('ship-photo-author').textContent=`Image: ${photo.author}`;
      $('ship-photo-author').href=photo.source;
      $('ship-photo-license').textContent=photo.license;
      $('ship-photo-license').href=photo.licenseUrl;
      $('ship-photo-unfiltered').href=photo.src;
      $('ship-photo-unfiltered').setAttribute('aria-label',`Open unfiltered image for ${feature.properties.name}`);
      img.alt=photo.alt;img.width=photo.width;img.height=photo.height;
      status.hidden=false;status.textContent='Loading image…';
      img.onload=()=>{if(token!==epoch)return;img.hidden=false;status.hidden=true;};
      img.onerror=()=>{
        if(token!==epoch)return;
        failed=true;img.hidden=true;status.hidden=false;
        status.textContent='Image unavailable. Its source and unfiltered-image links remain available.';
      };
      img.src=photo.src;
    },
  };
}
