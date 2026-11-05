#!/usr/bin/env python3
"""uv run --with numpy --with pillow --with pyproj --with rasterio scripts/prepare-viewshed.py
Downloads are cached outside the repository. Derived OSM database: ODbL 1.0.
"""
import argparse, datetime, heapq, json, math, pathlib, urllib.request
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image
from pyproj import Transformer
import rasterio
from rasterio.warp import reproject, Resampling
from rasterio.transform import from_origin

ROOT = pathlib.Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--route', choices=['taubensee','griesenau'], default='taubensee')
parser.add_argument('--route-only', action='store_true', help='Validate route before generating visibility assets')
args = parser.parse_args()
cycling = args.route == 'griesenau'
slug = '05-viewshed-02-griesenau' if cycling else '05-viewshed-01-taubensee'
OUT = ROOT / 'maps' / slug / 'data'
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
if cycling:
    # Narrow OSM extracts avoid the API's 50,000-node limit in wooded terrain.
    boxes += [f'{x:.3f},{y:.3f},{x+.024:.3f},{y+.019:.3f}'
              for x in (12.376,12.398) for y in (47.578,47.595,47.612,47.629,47.646)]
    boxes += [f'{x:.3f},47.570,{x+.025:.3f},47.593' for x in (12.316,12.339,12.362)]
nodes, ways = {}, {}
for i, box in enumerate(boxes):
    key = f'osm-{i}.xml' if i<4 else f'cycle-osm-{i}.xml'
    print('OSM extract',i+1,'/',len(boxes),flush=True)
    p = fetch(key, 'https://api.openstreetmap.org/api/0.6/map?bbox=' + box)
    for e in ET.parse(p).getroot():
        tags = {t.attrib['k']: t.attrib['v'] for t in e.findall('tag')}
        if e.tag == 'node':
            nodes[int(e.attrib['id'])] = (float(e.attrib['lon']), float(e.attrib['lat']), tags)
        if e.tag == 'way':
            ways[int(e.attrib['id'])] = ([int(n.attrib['ref']) for n in e.findall('nd')], tags)
project = Transformer.from_crs(4326, 32633, always_xy=True)
xy = {n: project.transform(*v[:2]) for n, v in nodes.items()}
# The tourism board explicitly describes cycling the full asphalt toll road.
# One OSM segment has vehicle=no but lacks the bicycle=yes on its continuation.
# Keep the source tags intact and record this single reviewed exception.
reviewed_cycle_access = {454081835:'https://www.kitzbueheler-alpen.com/de/stjo/touren/kaiserbachtal-radstrecke.html'}
graph, edge_sources = {}, {}
allowed = {'path', 'footway', 'steps', 'track', 'residential', 'living_street', 'service', 'unclassified', 'pedestrian', 'tertiary'}
if cycling:
    allowed = {'cycleway','residential','living_street','service','unclassified','tertiary','secondary','primary','track','path','footway','pedestrian'}
for way_id, (refs, tags) in ways.items():
    if tags.get('highway') not in allowed: continue
    mode = 'bicycle' if cycling else 'foot'
    permit = tags.get(mode) in {'yes','designated','permissive'} or (cycling and way_id in reviewed_cycle_access)
    if tags.get(mode) in {'no','private','use_sidepath'}: continue
    if tags.get('access') in {'no','private'} and not permit: continue
    if cycling and tags.get('vehicle') in {'no','private'} and not permit: continue
    if cycling and tags.get('highway') in {'track','path','footway','pedestrian'} and not permit: continue
    weight = {'primary':3,'secondary':1.6,'tertiary':1.2,'track':1.4}.get(tags.get('highway'),1) if cycling else 1
    direction = tags.get('oneway:bicycle',tags.get('oneway','yes' if tags.get('junction')=='roundabout' else 'no')) if cycling else 'no'
    if cycling and any(tags.get(k,'').startswith('opposite') for k in ('cycleway','cycleway:left','cycleway:right')): direction='no'
    for a, b in zip(refs, refs[1:]):
        if a not in xy or b not in xy: continue
        cost = math.dist(xy[a], xy[b])*weight
        graph.setdefault(a, []); graph.setdefault(b, [])
        if direction not in {'yes','1','true'}:
            graph[b].append((a,cost)); edge_sources[b,a] = way_id
        if direction != '-1':
            graph[a].append((b,cost)); edge_sources[a,b] = way_id

def named_position(name):
    if name in {'Schwendt','Griesenau'}:
        for n, value in nodes.items():
            if value[2].get('name') == name and value[2].get('place'):
                return np.array(xy[n])
    for refs, tags in ways.values():
        if tags.get('name') == name:
            return np.mean([xy[n] for n in refs if n in xy],axis=0)
    for n, value in nodes.items():
        if value[2].get('name') == name: return np.array(xy[n])
    raise ValueError(f'Missing mapped destination: {name}')

def nearest(point):
    return min(graph,key=lambda n: math.dist(xy[n],point))

start_xy = project.transform(12.40535, 47.66945)
start = nearest(start_xy)
end = nearest(named_position('Griesner Alm' if cycling else 'Taubenseehütte'))
via = []
if cycling:
    assert start == 2064921082, 'Cycling must use the exact same Kössen start'
    # The valley entrance is a real named OSM place, not an invented connector.
    through_nodes = {n for refs,tags in ways.values()
                     if tags.get('highway') in {'residential','unclassified','tertiary','secondary','primary','cycleway'}
                     for n in refs if n in graph}
    for name in ('Schwendt','Griesenau'):
        point = named_position(name)
        via.append(min(through_nodes,key=lambda n: math.dist(xy[n],point)))

def shortest(a,b):
    queue, distances, previous = [(0,a)], {a:0}, {}
    while queue:
        distance,node = heapq.heappop(queue)
        if node == b: break
        if distance != distances[node]: continue
        for nxt,cost in graph[node]:
            value = distance+cost
            if value < distances.get(nxt,float('inf')):
                distances[nxt],previous[nxt] = value,node
                heapq.heappush(queue,(value,nxt))
    assert b in distances, 'No connected permitted route; do not substitute a straight line.'
    result = [b]
    while result[-1] != a: result.append(previous[result[-1]])
    return result[::-1]

ids = [start]
for target in via+[end]: ids.extend(shortest(ids[-1],target)[1:])
route_way_ids = [edge_sources[a,b] for a,b in zip(ids,ids[1:])]
print('Route roads:',sorted({ways[way_id][1].get('name','(unnamed)') for way_id in route_way_ids}),flush=True)
route = np.array([xy[n] for n in ids])
cumulative = np.r_[0, np.cumsum(np.linalg.norm(np.diff(route, axis=0), axis=1))]
print('Route:', len(ids), 'nodes;', round(cumulative[-1]), 'metres; endpoints', nodes[start][:2], nodes[end][:2], flush=True)
if args.route_only: raise SystemExit(0)

url = ('https://gis.tirol.gv.at/arcgis/services/Service_Public/terrain/MapServer/WCSServer?'
       'service=WCS&version=1.0.0&request=GetCoverage&coverage=Gelaendemodell_5m_M28&crs=EPSG:4326&'
       'bbox=12.15,47.49,12.48,47.72&width=2600&height=2600&format=GeoTIFF')
p = fetch('terrain-kaiser.tif', url)
# Extend southwest to the full Wilder Kaiser; keep the hike in the upper right.
# 20 m metric analysis grid. WCS extraction is approximately 10 m spacing.
west, south = project.transform(12.17, 47.505)
east, north = project.transform(12.46, 47.708)
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
sample_spacing = 150 if cycling else 50
count = math.ceil(cumulative[-1]/sample_spacing)+1
sample_distances = np.linspace(0, cumulative[-1], count)
observers = np.column_stack([np.interp(sample_distances, cumulative, route[:,i]) for i in range(2)])
observer_grid = grid(observers)
# Dense radial horizon sweep. A 32 km radius reaches beyond the Kaiser range.
# Batch rays to bound memory use. Unknown terrain terminates the rest of a ray.
ray_count, radius = 16384, 32000
angles = np.arange(ray_count)*2*np.pi/ray_count
radii = np.arange(10, radius+1, 10, dtype=np.float32)
# Separate atlas pages avoid exceeding common 8192-pixel GPU texture limits.
cols = rows = 5
page_size = cols*rows
atlases = [Image.new('L', (cols*width, rows*height)) for _ in range(math.ceil(count/page_size))]
visible_counts = []
# Named landmark anchors, not invented mountain observations.
landmarks = [{'name':'WILDER KAISER', 'lon':12.30306, 'lat':47.56222,
              'source':'https://en.wikipedia.org/wiki/Ellmauer_Halt', 'anchor':'Ellmauer Halt'}]
for landmark in landmarks:
    point = grid(np.array([project.transform(landmark['lon'],landmark['lat'])]))[0]
    landmark['x'], landmark['y'] = map(float, point)
    landmark['elevation'] = round(float(dem[round(point[1]),round(point[0])]),1)
# Broad rectangular terrain window around the Kaiser, for coverage regressions.
kx, ky = landmarks[0]['x'], landmarks[0]['y']
kaiser_slice = (slice(round(ky)-70,round(ky)+70),slice(round(kx)-200,round(kx)+200))
kaiser_visible_counts = []
for i, (ox, oy) in enumerate(observer_grid):
    ix, iy = round(ox), round(oy)
    assert valid[iy,ix], f'Observer {i} has no terrain'
    mask = np.zeros_like(dem,dtype=np.uint8)
    for batch in range(0, ray_count, 512):
        theta = angles[batch:batch+512,None]
        x = np.rint(ox+np.cos(theta)*radii/20).astype(np.int32)
        y = np.rint(oy+np.sin(theta)*radii/20).astype(np.int32)
        inside = (x>=0)&(y>=0)&(x<width)&(y<height)
        x = np.clip(x,0,width-1); y = np.clip(y,0,height-1)
        known = inside & valid[y,x]
        unbroken = np.logical_and.accumulate(known,axis=1)
        slopes = (dem[y,x] - (dem[iy,ix]+1.7))/radii
        horizon = np.maximum.accumulate(np.where(known,slopes,np.inf),axis=1)
        preceding = np.column_stack((np.full(len(theta),-np.inf),horizon[:,:-1]))
        visible = unbroken & (slopes >= preceding-1e-6)
        mask[y[visible],x[visible]] = 255
    mask[iy,ix] = 255
    slot = i % page_size
    atlases[i//page_size].paste(Image.fromarray(mask), ((slot%cols)*width,(slot//cols)*height))
    visible_counts.append(int(np.count_nonzero(mask)))
    kaiser_visible_counts.append(int(np.count_nonzero(mask[kaiser_slice])))
    if i%20 == 0: print('Viewshed', i, '/', count, flush=True)
atlas_files = [f'viewsheds-{i}.png' for i in range(len(atlases))]
for atlas, name in zip(atlases, atlas_files):
    atlas.save(OUT/name, optimize=True)
(OUT/'viewsheds.png').unlink(missing_ok=True)
# Neutral grayscale hillshade/height tint; red is reserved for visibility and route.
safe = np.where(valid,dem,700)
gy,gx = np.gradient(safe,20)
light = np.clip((-.5*gx+.6*gy+1)/np.sqrt(gx*gx+gy*gy+1),0,1)
t = np.clip((dem-550)/1900,0,1)
low, high = np.array([159,159,159]), np.array([241,241,241])
rgb = (low[None,None,:]*(1-t[:,:,None])+high[None,None,:]*t[:,:,None])*(.45+.55*light[:,:,None])
rgb[~valid]=[36,39,40]
Image.fromarray(rgb.astype('uint8')).save(OUT/'terrain.png')
Image.fromarray((valid*255).astype('uint8')).save(OUT/'coverage.png')
profile = [round(float(dem[round(y),round(x)]),1) for x,y in route_grid]
destination = 'Griesner Alm' if cycling else 'Taubenseehütte'
method = 'Cycle-permitted network via Schwendt and Griesenau, weighted to prefer quieter roads; not a recorded ride' if cycling else 'Shortest permitted walking-network path; not a recorded hike'
feature = {'type':'Feature','properties':{'name':f'Kössen Dorf → {destination}','method':method,'license':'ODbL-1.0','osm_node_ids':ids,'osm_way_ids':route_way_ids},'geometry':{'type':'LineString','coordinates':[list(nodes[n][:2]) for n in ids]}}
if cycling:
    (OUT/'route-ways.json').write_text(json.dumps({str(i):ways[i][1] for i in dict.fromkeys(route_way_ids)},separators=(',',':'))+'\n')
(OUT/'route.geojson').write_text(json.dumps(feature,separators=(',',':'))+'\n')
meta = {'width':width,'height':height,'cellSize':20,'crs':'EPSG:32633','west':west,'north':north,
        'duration':30,'eyeHeight':1.7,'atlasColumns':cols,'atlasRows':rows,'frameCount':count,
        'mode':'cycling' if cycling else 'walking','destination':destination,'sampleSpacing':sample_spacing,
        'viaNodes':via,'reviewedCycleAccess':{str(k):v for k,v in reviewed_cycle_access.items()} if cycling else {},
        'waypointLabels':[{'name':name,'x':round(float(grid(np.array([xy[n]]))[0,0]),3),
                           'y':round(float(grid(np.array([xy[n]]))[0,1]),3)}
                          for name,n in zip(('SCHWENDT','GRIESENAU'),via)],
        'route':[[round(x,3),round(y,3),z,round(d,2)] for (x,y),z,d in zip(route_grid,profile,cumulative)],
        'observers':[[round(x,3),round(y,3),round(float(dem[round(y),round(x)]),1),round(float(d),2)] for (x,y),d in zip(observer_grid,sample_distances)],
        'atlasFiles':atlas_files,'atlasPageSize':page_size,'analysisRadius':radius,'rayCount':ray_count,
        'landmarks':landmarks,'kaiserVisibleCells':kaiser_visible_counts,
        'kaiserWindow':{'x':round(kx)-200,'y':round(ky)-70,'width':400,'height':140},
        'visibleCells':visible_counts,'distance':round(float(cumulative[-1]),2),
        'generated':datetime.date.today().isoformat(),'terrainURL':url,'osmURLs':['https://api.openstreetmap.org/api/0.6/map?bbox='+b for b in boxes]}
(OUT/'manifest.json').write_text(json.dumps(meta,separators=(',',':'))+'\n')
print('Saved',width,height,count,'frames;',len(atlases),'atlas pages',atlases[0].size, flush=True)
print('Kaiser visible cells at start / middle / end:',*[kaiser_visible_counts[i] for i in (0,count//2,count-1)],flush=True)
