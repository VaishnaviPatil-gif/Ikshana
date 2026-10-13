import urllib.request
import json
import math

url = 'https://raw.githubusercontent.com/datameet/maps/master/Country/india-composite.geojson'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode('utf-8'))

feature = data['features'][0]
coords_list = feature['geometry']['coordinates']

def rdp(points, epsilon):
    if len(points) <= 2:
        return points
    dmax = 0
    index = 0
    end = len(points) - 1
    x1, y1 = points[0][0], points[0][1]
    x2, y2 = points[end][0], points[end][1]
    dx = x2 - x1
    dy = y2 - y1
    denom = dx * dx + dy * dy
    for i in range(1, end):
        x, y = points[i][0], points[i][1]
        dist = math.hypot(x - x1, y - y1) if denom == 0 else abs(dy * x - dx * y + x2 * y1 - y2 * x1) / math.sqrt(denom)
        if dist > dmax:
            index = i
            dmax = dist
    if dmax > epsilon:
        rec1 = rdp(points[:index + 1], epsilon)
        rec2 = rdp(points[index:], epsilon)
        return rec1[:-1] + rec2
    else:
        return [points[0], points[end]]

# 1. Mainland
mainland_raw = coords_list[0][0]
mainland_simplified = rdp(mainland_raw, 0.035)
print(f"Mainland simplified to {len(mainland_simplified)} points")

# Round coordinates to 3 decimal places for optimal file size and sub-pixel SVG accuracy
mainland_clean = [[round(p[0], 3), round(p[1], 3)] for p in mainland_simplified]
if mainland_clean[0] != mainland_clean[-1]:
    mainland_clean.append(mainland_clean[0])

# 2. Significant Islands (Andaman & Nicobar, Lakshadweep, Sundarbans)
islands_clean = []
for i in range(1, len(coords_list)):
    ring = coords_list[i][0]
    lons = [p[0] for p in ring]
    lats = [p[1] for p in ring]
    min_lon, max_lon = min(lons), max(lons)
    min_lat, max_lat = min(lats), max(lats)
    bbox_size = (max_lon - min_lon) * (max_lat - min_lat)
    if bbox_size > 0.004 or len(ring) > 180:
        simp = rdp(ring, 0.02)
        if len(simp) >= 4:
            clean_ring = [[round(p[0], 3), round(p[1], 3)] for p in simp]
            if clean_ring[0] != clean_ring[-1]:
                clean_ring.append(clean_ring[0])
            islands_clean.append(clean_ring)

print(f"Processed {len(islands_clean)} island polygons")

# 3. Read existing SRI_LANKA_COASTLINE, INDIAN_PORTS, MARINE_SANCTUARIES
with open('frontend/src/components/map/indiaMapData.js', 'r', encoding='utf-8') as f:
    orig = f.read()

# Extract Sri Lanka
sl_match = re = None
import re
sl_part = re.search(r'export const SRI_LANKA_COASTLINE = \[.*?\];', orig, re.DOTALL)
sl_code = sl_part.group(0) if sl_part else "export const SRI_LANKA_COASTLINE = [];"

ports_part = re.search(r'export const INDIAN_PORTS = \[.*?\];', orig, re.DOTALL)
ports_code = ports_part.group(0) if ports_part else "export const INDIAN_PORTS = [];"

sanc_part = re.search(r'export const MARINE_SANCTUARIES = \[.*?\];', orig, re.DOTALL)
sanc_code = sanc_part.group(0) if sanc_part else "export const MARINE_SANCTUARIES = [];"

# Now construct the updated indiaMapData.js
out_code = f"""// High-precision authentic Indian coastline, national sovereign boundaries & maritime geometry
// Official sovereign boundary of India (Survey of India / DataMeet GIS Composite)
// Complete boundary: Jammu & Kashmir, Ladakh, Rajasthan, Gujarat, entire Peninsula & Eastern Seaboard, Northeast

export const INDIA_MAINLAND_POLYGON = {json.dumps(mainland_clean, indent=2)};

export const INDIA_ISLANDS_POLYGONS = {json.dumps(islands_clean, indent=2)};

{sl_code}

{ports_code}

{sanc_code}
"""

with open('frontend/src/components/map/indiaMapData.js', 'w', encoding='utf-8') as f:
    f.write(out_code)

print("indiaMapData.js updated successfully!")
