#!/usr/bin/env python3
"""uv run --with numpy --with pillow --with pyproj --with rasterio scripts/prepare-viewshed.py
Downloads are cached outside the repository. Derived OSM database: ODbL 1.0.
"""
import concurrent.futures, datetime, heapq, io, json, math, pathlib, urllib.request
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image
from pyproj import Transformer
import rasterio
from rasterio.warp import reproject, Resampling
from rasterio.transform import from_origin

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'maps/05-viewshed/data'
CACHE = pathlib.Path('/tmp/koessen-viewshed-cache')
OUT.mkdir(parents=True, exist_ok=True)
CACHE.mkdir(exist_ok=True)

def fetch(name, url):
    p = CACHE / name
    if not p.exists():
        with urllib.request.urlopen(url, timeout=120) as response:
            p.write_bytes(response.read())
    return p

boxes = ['12.399,47.666,12.418,47.681', '12.409,47.678,12.431,47.691', '12.418,47.687,12.442,47.703', '12.414,47.670,12.435,47.683']
nodes, ways = {}, {}
for i, box in enumerate(boxes):
    p = fetch(f'osm-{i}.xml', 'https://api.openstreetmap.org/api/0.6/map?bbox=' + box)
    for e in ET.parse(p).getroot():
        tags = {t.attrib['k']: t.attrib['v'] for t in e.findall('tag')}
        if e.tag == 'node':
            nodes[int(e.attrib['id'])] = (float(e.attrib['lon']), float(e.attrib['lat']), tags)
        if e.tag == 'way':
            ways[int(e.attrib['id'])] = ([int(n.attrib['ref']) for n in e.findall('nd')], tags)
project = Transformer.from_crs(4326, 32633, always_xy=True)
xy = {n: project.transform(*v[:2]) for n, v in nodes.items()}
graph = {}
allowed = {'path', 'footway', 'steps', 'track', 'residential', 'living_street', 'service', 'unclassified', 'pedestrian', 'tertiary'}
for refs, tags in ways.values():
    if tags.get('highway') not in allowed or tags.get('foot') in {'no', 'private'} or (tags.get('access') in {'no','private'} and tags.get('foot') not in {'yes','designated','permissive'}):
        continue
    for a, b in zip(refs, refs[1:]):
        if a not in xy or b not in xy: continue
        distance = math.dist(xy[a], xy[b])
        graph.setdefault(a, []).append((b, distance))
        graph.setdefault(b, []).append((a, distance))
hut_refs = next(refs for refs, tags in ways.values() if tags.get('name') == 'Taubenseehütte')
hut = np.mean([xy[n] for n in hut_refs[:-1]], axis=0)
# Dorf (the central village square), snapped to its pedestrian street network.
start_xy = project.transform(12.40535, 47.66945)
start = min(graph, key=lambda n: math.dist(xy[n], start_xy))
end = min(graph, key=lambda n: math.dist(xy[n], hut))
queue, distances, previous = [(0, start)], {start: 0}, {}
while queue:
    distance, node = heapq.heappop(queue)
    if node == end: break
    if distance != distances[node]: continue
    for nxt, length in graph[node]:
        value = distance + length
        if value < distances.get(nxt, float('inf')):
            distances[nxt], previous[nxt] = value, node
            heapq.heappush(queue, (value, nxt))
assert end in distances, 'No connected walking route; do not substitute a straight line.'
ids = [end]
while ids[-1] != start: ids.append(previous[ids[-1]])
ids.reverse()
route = np.array([xy[n] for n in ids])
cumulative = np.r_[0, np.cumsum(np.linalg.norm(np.diff(route, axis=0), axis=1))]
print('Route:', len(ids), 'nodes;', round(cumulative[-1]), 'metres; endpoints', nodes[start][:2], nodes[end][:2], flush=True)

url = ('https://gis.tirol.gv.at/arcgis/services/Service_Public/terrain/MapServer/WCSServer?'
       'service=WCS&version=1.0.0&request=GetCoverage&coverage=Gelaendemodell_5m_M28&crs=EPSG:4326&'
       'bbox=12.36,47.63,12.49,47.74&width=1300&height=1200&format=GeoTIFF')
p = fetch('terrain.tif', url)
# 20 m metric analysis grid. Source sampled by WCS at approximately 8–10 m.
west, south = project.transform(12.37, 47.64)
east, north = project.transform(12.48, 47.73)
west, south = math.floor(west/20)*20, math.floor(south/20)*20
width, height = math.ceil((east-west)/20), math.ceil((north-south)/20)
north = south + height*20
transform = from_origin(west, north, 20, 20)
dem = np.zeros((height, width), dtype=np.float32)
with rasterio.open(p) as src:
    reproject(src.read(1), dem, src_transform=src.transform, src_crs=src.crs,
              src_nodata=0, dst_transform=transform, dst_crs='EPSG:32633', dst_nodata=0, resampling=Resampling.bilinear)
valid = dem > 100

def grid(points):
    return np.column_stack(((points[:,0]-west)/20-.5, (north-points[:,1])/20-.5))
route_grid = grid(route)
count = math.ceil(cumulative[-1]/50)+1
sample_distances = np.linspace(0, cumulative[-1], count)
observers = np.column_stack([np.interp(sample_distances, cumulative, route[:,i]) for i in range(2)])
observer_grid = grid(observers)
# Dense radial horizon sweep: 8192 rays, 10 m steps, nearest-cell terrain.
# Unknown terrain blocks the rest of a ray; never treats cross-border gaps as flat ground.
angles = np.arange(8192)*2*np.pi/8192
radii = np.arange(10, 12001, 10, dtype=np.float32)
dx = np.cos(angles)[:,None]*radii/20
dy = np.sin(angles)[:,None]*radii/20
cols = math.ceil(math.sqrt(count)); rows = math.ceil(count/cols)
atlas = Image.new('L', (cols*width, rows*height))
visible_counts = []
for i, (ox, oy) in enumerate(observer_grid):
    ix, iy = round(ox), round(oy)
    assert valid[iy,ix], f'Observer {i} has no terrain'
    x = np.rint(ox+dx).astype(np.int32); y = np.rint(oy+dy).astype(np.int32)
    inside = (x>=0)&(y>=0)&(x<width)&(y<height)
    x = np.clip(x,0,width-1); y = np.clip(y,0,height-1)
    known = inside & valid[y,x]
    unbroken = np.logical_and.accumulate(known,axis=1)
    slopes = (dem[y,x] - (dem[iy,ix]+1.7))/radii
    horizon = np.maximum.accumulate(np.where(known,slopes,np.inf),axis=1)
    preceding = np.column_stack((np.full(len(angles),-np.inf),horizon[:,:-1]))
    visible = unbroken & (slopes >= preceding-1e-6)
    mask = np.zeros_like(dem,dtype=np.uint8)
    mask[y[visible],x[visible]] = 255
    mask[iy,ix] = 255
    atlas.paste(Image.fromarray(mask), ((i%cols)*width,(i//cols)*height))
    visible_counts.append(int(np.count_nonzero(mask)))
    if i%20 == 0: print('Viewshed', i, '/', count, flush=True)
atlas.save(OUT/'viewsheds.png', optimize=True)
# Hillshaded hypsometric tint; unknown terrain is visually distinct.
safe = np.where(valid,dem,700)
gy,gx = np.gradient(safe,20)
light = np.clip((-.5*gx+.6*gy+1)/np.sqrt(gx*gx+gy*gy+1),0,1)
t = np.clip((dem-550)/1100,0,1)
low, high = np.array([102,134,111]), np.array([205,197,163])
rgb = (low[None,None,:]*(1-t[:,:,None])+high[None,None,:]*t[:,:,None])*(.45+.55*light[:,:,None])
rgb[~valid]=[34,45,51]
Image.fromarray(rgb.astype('uint8')).save(OUT/'terrain.png')
Image.fromarray((valid*255).astype('uint8')).save(OUT/'coverage.png')
profile = [round(float(dem[round(y),round(x)]),1) for x,y in route_grid]
feature = {'type':'Feature','properties':{'name':'Kössen Dorf → Taubenseehütte','method':'Shortest permitted walking-network path; not a recorded hike','license':'ODbL-1.0','osm_node_ids':ids},'geometry':{'type':'LineString','coordinates':[list(nodes[n][:2]) for n in ids]}}
(OUT/'route.geojson').write_text(json.dumps(feature,separators=(',',':'))+'\n')
meta = {'width':width,'height':height,'cellSize':20,'crs':'EPSG:32633','west':west,'north':north,
        'duration':30,'eyeHeight':1.7,'atlasColumns':cols,'atlasRows':rows,'frameCount':count,
        'route':[[round(x,3),round(y,3),z,round(d,2)] for (x,y),z,d in zip(route_grid,profile,cumulative)],
        'observers':[[round(x,3),round(y,3),round(float(dem[round(y),round(x)]),1),round(float(d),2)] for (x,y),d in zip(observer_grid,sample_distances)],
        'visibleCells':visible_counts,'distance':round(float(cumulative[-1]),2),
        'generated':datetime.date.today().isoformat(),'terrainURL':url,'osmURLs':['https://api.openstreetmap.org/api/0.6/map?bbox='+b for b in boxes]}
(OUT/'manifest.json').write_text(json.dumps(meta,separators=(',',':'))+'\n')
print('Saved',width,height,count,'frames;', 'atlas',atlas.size, flush=True)
