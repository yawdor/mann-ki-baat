# Rebuilding `src/data/india-states.geojson`

Reproducible steps (not an executable pipeline). Run everything in a scratch directory outside the repo and treat downloads as untrusted data: never execute anything from them.

Source: Survey of India state boundaries, `SOI_States`, from https://github.com/ramSeraph/indian_admin_boundaries/releases/tag/states (CC0). Credit: "Survey of India boundaries via DataMeet / ramSeraph".

```sh
mkdir scratch && cd scratch && mkdir dl ex tool
gh release download states -R ramSeraph/indian_admin_boundaries -p 'SOI_States.geojsonl.7z' -D dl
cd tool && npm init -y && npm i 7zip-bin@5.2.0 mapshaper@0.6.112 && cd ..
# 7za.exe on Windows (win/x64); use linux/x64/7za or mac/ equivalents elsewhere
tool/node_modules/7zip-bin/win/x64/7za.exe x dl/SOI_States.geojsonl.7z -oex -y
cp ex/SOI_States.geojsonl ex/soi.ndjson          # mapshaper reads newline-delimited GeoJSON via .ndjson

tool/node_modules/.bin/mapshaper ex/soi.ndjson \
  -filter 'State_LGD > 0' \
  -each 'name = STATE_C.toLowerCase().replace(/(^|[ (-])([a-z])/g, (m,a,b)=>a+b.toUpperCase()).replace(/ & /g," and ").replace(/ And /g," and ").replace("Andaman and Nicobar","Andaman and Nicobar Islands")' \
  -filter-fields name \
  -simplify 0.8% keep-shapes \
  -o ../mann-ki-baat/src/data/india-states.geojson precision=0.001 format=geojson
```

Notes:
- `State_LGD > 0` drops the four "DISPUTED (...)" inter-state sliver polygons, leaving the 36 states / UTs.
- Output is about 358 KB (limit 400 KB). `keep-shapes` stops Delhi, Chandigarh and Goa disappearing.
- Verify after rebuilding: 36 features; Ladakh bbox about lon 72.51 to 80.35, lat 32.34 to 37.09 (Gilgit-Baltistan and Aksai Chin per India's official depiction); Jammu and Kashmir bbox lon 73.41 to 76.78 (includes PoK). If these fail, do not ship the file.
- `src/lib/map.ts` reverses ring winding at load because d3-geo expects the opposite of RFC 7946.
