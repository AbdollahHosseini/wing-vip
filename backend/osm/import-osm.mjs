#!/usr/bin/env node
/**
 * Imports the campus's outdoor walking network from OpenStreetMap (OSM) into
 * WING's nodes and edges tables. See README.md in this folder.
 *
 *   node backend/osm/import-osm.mjs fetch    download a fresh snapshot of the campus
 *   node backend/osm/import-osm.mjs build    snapshot -> outdoor-import.sql + entrances-to-survey.csv
 *
 * Options for fetch:
 *   --campus "University of Bath"            name of the campus's amenity=university outline
 *   --bbox south,west,north,east             use this box instead of looking the campus up
 *
 * The snapshot is committed, so every build is reproducible and a change in
 * OSM shows up as a reviewable diff. Plain Node, no dependencies (Node 18+).
 *
 * How OSM becomes a graph:
 * - OSM ways are lists of points. A point becomes a WING node only where
 *   something happens: a way ends, two paths meet, or it's an entrance or a
 *   kerb. Everything between two such nodes becomes one edge, with its bends
 *   kept in `shape` for drawing.
 * - Steps become 'stairs' edges (never step-free). Everything else walkable
 *   becomes 'outdoor'. OSM rarely records step-free access, so unless a path
 *   is tagged wheelchair=yes/no its `accessible` stays null (= not surveyed).
 * - Building entrances become 'exit' nodes. Linking each one to the door
 *   node inside its building is done by hand — entrances-to-survey.csv lists
 *   them with what OSM knows about each door.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = path.join(DIR, 'campus-snapshot.json');
const SQL_PATH = path.join(DIR, 'outdoor-import.sql');
const CSV_PATH = path.join(DIR, 'entrances-to-survey.csv');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const DEFAULT_CAMPUS = 'University of Bath';
const MARGIN_M = 100; // pavements and bus stops often sit just outside the campus outline
const ENTRANCE_LINK_MAX_M = 25; // how far an entrance may be from a path and still get joined to it

// highway=* values people can walk along. Roads are included because many
// campus routes have no separate pavement; their edges stay unsurveyed.
const WALKABLE = new Set([
  'footway', 'path', 'pedestrian', 'steps', 'living_street', 'service',
  'residential', 'unclassified', 'track', 'cycleway', 'corridor',
]);
const FOOT_ALLOWED = new Set(['yes', 'designated', 'permissive']);

// ---------------------------------------------------------------------------
// fetch

async function overpass(query) {
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      // Overpass refuses requests without a descriptive User-Agent
      'User-Agent': 'WING campus wayfinding (University of Bath student project)',
    },
    body: new URLSearchParams({ data: query }),
  });
  if (!res.ok) throw new Error(`Overpass answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function campusBbox(campusName) {
  const name = campusName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const data = await overpass(`[out:json][timeout:60];nwr["amenity"="university"]["name"="${name}"];out bb;`);
  const boxes = data.elements.map((el) =>
    el.bounds ?? { minlat: el.lat, minlon: el.lon, maxlat: el.lat, maxlon: el.lon }
  );
  if (boxes.length === 0) {
    throw new Error(`No amenity=university named "${campusName}" in OSM. Pass --campus or --bbox.`);
  }
  const s = Math.min(...boxes.map((b) => b.minlat));
  const w = Math.min(...boxes.map((b) => b.minlon));
  const n = Math.max(...boxes.map((b) => b.maxlat));
  const e = Math.max(...boxes.map((b) => b.maxlon));
  const dLat = MARGIN_M / 111320;
  const dLon = MARGIN_M / (111320 * Math.cos(((s + n) / 2) * (Math.PI / 180)));
  return [s - dLat, w - dLon, n + dLat, e + dLon].map((v) => Number(v.toFixed(6)));
}

async function fetchSnapshot(options) {
  const bbox = options.bbox ?? (await campusBbox(options.campus ?? DEFAULT_CAMPUS));
  console.log(`Fetching OSM data for bbox ${bbox.join(',')} …`);

  // Every highway and building in the box, every entrance, and all of their
  // points with tags (kerbs and crossings are tags on points).
  const data = await overpass(`[out:json][timeout:180][bbox:${bbox.join(',')}];
(
  way["highway"];
  way["building"];
  node["entrance"];
);
(._; >;);
out body qt;`);

  // One element per line, sorted, so a re-fetch diffs cleanly in review.
  const elements = [...data.elements].sort((a, b) => a.type.localeCompare(b.type) || a.id - b.id);
  const header = { bbox, osm_base: data.osm3s?.timestamp_osm_base ?? null, copyright: data.osm3s?.copyright ?? null };
  const body = elements.map((el) => JSON.stringify(el)).join(',\n');
  fs.writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(header).slice(0, -1)},"elements":[\n${body}\n]}\n`);
  console.log(`Saved ${elements.length} elements to ${path.relative(process.cwd(), SNAPSHOT_PATH)}`);
}

// ---------------------------------------------------------------------------
// convert: OSM elements -> WING nodes, edges and an entrance list

export function convert(elements) {
  const points = new Map(); // OSM node id -> element
  const ways = [];
  for (const el of elements) {
    if (el.type === 'node') points.set(el.id, el);
    else if (el.type === 'way') ways.push(el);
  }

  const walkways = ways.filter(isWalkable);
  const buildingOf = new Map(); // OSM node id -> building way (for entrances)
  for (const w of ways) {
    if (!w.tags?.building) continue;
    for (const id of w.nodes) if (!buildingOf.has(id)) buildingOf.set(id, w);
  }

  // A point splits ways when 2+ walkways use it, or it matters on its own.
  const useCount = new Map();
  for (const w of walkways) {
    for (const id of new Set(w.nodes)) useCount.set(id, (useCount.get(id) ?? 0) + 1);
  }
  const splitsAt = (id) => (useCount.get(id) ?? 0) > 1 || isSignificant(points.get(id)?.tags);

  const edges = [];
  for (const w of walkways) {
    const ids = w.nodes.filter((id) => points.has(id));
    let start = 0;
    for (let i = 1; i < ids.length; i++) {
      if (i === ids.length - 1 || splitsAt(ids[i])) {
        for (const segment of withoutLoops(ids.slice(start, i + 1))) {
          edges.push(toEdge(w, segment, points));
        }
        start = i;
      }
    }
  }

  // Kerbs: a raised or rolled kerb blocks wheelchairs through that point;
  // a kerb of unknown height makes the edges unsurveyed.
  for (const e of edges) {
    for (const end of [e.from, e.to]) {
      const kerb = kerbType(points.get(end)?.tags);
      if (kerb === 'blocking') e.accessible = false;
      else if (kerb === 'unknown' && e.accessible === true) e.accessible = null;
    }
  }

  const graphNodes = new Set(edges.flatMap((e) => [e.from, e.to]));
  const pathNodes = new Set(graphNodes); // entrances only ever join a path, not each other

  // Entrances: import each usable one as a node, joined to the nearest
  // path if it isn't already on one.
  const entrances = [];
  for (const point of points.values()) {
    const type = point.tags?.entrance;
    if (!type || type === 'no') continue;
    const building = buildingOf.get(point.id);
    const entrance = {
      osmId: point.id,
      nodeId: nodeId(point.id),
      building: buildingName(building?.tags),
      tags: point.tags,
      imported: false,
      note: '',
    };
    entrances.push(entrance);

    if (type === 'emergency' || ['private', 'no'].includes(point.tags.access)) {
      entrance.note = type === 'emergency' ? 'Emergency exit: not used for routing' : `access=${point.tags.access}: not used for routing`;
      continue;
    }
    entrance.imported = true;
    if (graphNodes.has(point.id)) continue;

    const nearest = nearestNode(point, pathNodes, points);
    if (nearest && nearest.distance <= ENTRANCE_LINK_MAX_M) {
      edges.push({
        from: nearest.id, to: point.id, kind: 'outdoor', weight: nearest.distance,
        oneWay: false, accessible: null, stepCount: null, slopePct: null, wayId: null,
        shape: [lonLat(points.get(nearest.id)), lonLat(point)],
      });
      entrance.note = `Joined to the nearest path (${Math.round(nearest.distance)} m) with a straight line: check it on site`;
    } else {
      entrance.note = `No path within ${ENTRANCE_LINK_MAX_M} m: map the path in OSM, then rebuild`;
    }
    graphNodes.add(point.id);
  }

  const nodes = [...graphNodes].map((id) => {
    const point = points.get(id);
    const isEntrance = entrances.some((e) => e.osmId === id && e.imported);
    return {
      id: nodeId(id),
      osmId: id,
      type: isEntrance ? 'exit' : 'junction',
      label: isEntrance ? entranceLabel(entrances.find((e) => e.osmId === id)) : junctionLabel(id, walkways),
      lng: point.lon,
      lat: point.lat,
    };
  });

  return { nodes, edges: dedupe(edges), entrances };
}

function isWalkable(way) {
  const t = way.tags ?? {};
  if (!WALKABLE.has(t.highway) || t.area === 'yes') return false;
  if (t.foot === 'no') return false;
  if (['no', 'private'].includes(t.access) && !FOOT_ALLOWED.has(t.foot)) return false;
  return true;
}

function isSignificant(tags) {
  if (!tags) return false;
  return Boolean(tags.entrance || tags.kerb || tags.barrier || tags.highway === 'crossing' || tags.crossing);
}

// A closed loop path would start and end at the same node; split it at its
// middle point so it becomes two real edges.
function withoutLoops(segment) {
  if (segment[0] !== segment[segment.length - 1]) return [segment];
  if (segment.length < 4) return [];
  const mid = Math.floor(segment.length / 2);
  return [segment.slice(0, mid + 1), segment.slice(mid)];
}

function toEdge(way, segment, points) {
  const t = way.tags ?? {};
  let ids = segment;
  let slopePct = parseIncline(t.incline);
  let oneWay = false;

  // Escalators and one-way footpaths. Ignore plain oneway=* on roads: that's for cars.
  const footOneway = t['oneway:foot'] ?? (['footway', 'path', 'pedestrian', 'steps'].includes(t.highway) ? t.oneway : undefined);
  if (t.conveying === 'forward' || footOneway === 'yes') oneWay = true;
  if (t.conveying === 'backward' || footOneway === '-1') {
    oneWay = true;
    ids = [...segment].reverse();
    if (slopePct !== null) slopePct = -slopePct;
  }

  const shape = ids.map((id) => lonLat(points.get(id)));
  const weight = shape.slice(1).reduce((sum, p, i) => sum + distanceM(shape[i], p), 0);
  const isSteps = t.highway === 'steps';
  const withRamp = isSteps && t['ramp:wheelchair'] === 'yes';

  return {
    from: ids[0],
    to: ids[ids.length - 1],
    kind: isSteps && !withRamp ? 'stairs' : withRamp ? 'ramp' : 'outdoor',
    weight,
    oneWay,
    accessible: isSteps && !withRamp ? false : wheelchair(t.wheelchair),
    stepCount: isSteps && /^\d+$/.test(t.step_count ?? '') ? Number(t.step_count) : null,
    slopePct,
    wayId: way.id,
    shape,
  };
}

function wheelchair(value) {
  if (value === 'yes') return true;
  if (value === 'no') return false;
  return null; // missing, or 'limited': needs a survey
}

function kerbType(tags) {
  if (!tags) return null;
  const kerb = tags.kerb ?? (tags.barrier === 'kerb' ? 'yes' : undefined);
  if (!kerb || ['flush', 'lowered', 'no'].includes(kerb)) return null;
  if (['raised', 'rolled'].includes(kerb)) return 'blocking';
  return 'unknown';
}

/** OSM incline -> signed percent along the way, or null if it has no number. */
export function parseIncline(value) {
  if (!value) return null;
  const match = /^(-?\d+(?:\.\d+)?)\s*(%|°)?$/.exec(value.trim());
  if (!match) return null; // 'up', 'down', or something odd
  const n = Number(match[1]);
  const pct = match[2] === '°' ? Math.tan((n * Math.PI) / 180) * 100 : n;
  return Math.abs(pct) <= 100 ? Number(pct.toFixed(2)) : null;
}

// Two paths between the same two nodes would break the unique edge index in
// migration 0002. Keep the shortest.
function dedupe(edges) {
  const best = new Map();
  for (const e of edges) {
    if (e.from === e.to) continue;
    const key = e.oneWay
      ? `${e.kind}|${e.from}>${e.to}`
      : `${e.kind}|${[e.from, e.to].sort().join('|')}`;
    const kept = best.get(key);
    if (!kept || e.weight < kept.weight) best.set(key, e);
  }
  return [...best.values()];
}

function nearestNode(point, candidates, points) {
  let nearest = null;
  for (const id of candidates) {
    const d = distanceM(lonLat(point), lonLat(points.get(id)));
    if (!nearest || d < nearest.distance) nearest = { id, distance: d };
  }
  return nearest;
}

function entranceLabel(entrance) {
  const which = entrance.tags.name ?? entrance.tags.ref ?? (entrance.tags.entrance === 'main' ? 'main' : '');
  const place = entrance.building ? `${entrance.building} entrance` : 'Entrance';
  return which ? `${place} (${which})` : place;
}

// Many campus buildings (halls of residence especially) have only an address in OSM.
function buildingName(tags) {
  if (!tags) return '';
  if (tags.name || tags.ref) return tags.name ?? tags.ref;
  const address = [tags['addr:housename'] ?? tags['addr:housenumber'], tags['addr:street']].filter(Boolean);
  return address.join(' ');
}

function junctionLabel(id, walkways) {
  const named = walkways.find((w) => w.nodes.includes(id) && w.tags?.name);
  return named ? named.tags.name : 'Path';
}

const nodeId = (osmId) => `osm-n${osmId}`;
const lonLat = (point) => [point.lon, point.lat];

function distanceM([lon1, lat1], [lon2, lat2]) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(a));
}

// ---------------------------------------------------------------------------
// output

export function toSql({ nodes, edges }, header = {}) {
  const str = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
  const num = (v) => (v === null || v === undefined ? 'null' : String(v));
  const bool = (v) => (v === null || v === undefined ? 'null' : v ? 'true' : 'false');
  const ids = nodes.map((n) => str(n.id)).join(', ');

  const nodeRows = nodes.map((n) =>
    `  (${str(n.id)}, null, ${str(n.type)}, ${str(n.label)}, 0, 0, ${num(n.lng)}, ${num(n.lat)}, 'osm', ${n.osmId})`
  );
  const edgeRows = edges.map((e) =>
    `  (${str(nodeId(e.from))}, ${str(nodeId(e.to))}, ${str(e.kind)}, ${e.weight.toFixed(2)}, ${bool(e.oneWay)}, ` +
    `${bool(e.accessible)}, ${num(e.stepCount)}, ${num(e.slopePct)}, 'osm', ${num(e.wayId)}, ` +
    `${str(JSON.stringify(e.shape.map(([lng, lat]) => [Number(lng.toFixed(7)), Number(lat.toFixed(7))])))}::jsonb)`
  );

  return `-- Outdoor walking network imported from OpenStreetMap.
-- Generated by backend/osm/import-osm.mjs from campus-snapshot.json: do not edit
-- by hand. Re-run the script and paste this file again to update.
-- Snapshot: ${header.osm_base ?? 'unknown date'}, bbox ${header.bbox?.join(',') ?? 'unknown'}
-- Data (c) OpenStreetMap contributors, available under the ODbL: openstreetmap.org/copyright
--
-- Needs migrations 0002 and 0003. Rows with source = 'osm' are replaced on
-- every run; rows the team made by hand (source = 'manual') are left alone.

begin;

delete from edges where source = 'osm';

${nodes.length ? `insert into nodes (id, floor_id, type, label, x, y, lng, lat, source, osm_id) values
${nodeRows.join(',\n')}
on conflict (id) do update set
  type = excluded.type, label = excluded.label, lng = excluded.lng, lat = excluded.lat,
  source = excluded.source, osm_id = excluded.osm_id;` : '-- (no nodes)'}

-- Nodes that are no longer in OSM. If this fails, a hand-made edge or a QR
-- code still points at one of them: re-link it to a current node first.
delete from nodes where source = 'osm' and id <> all (array[${ids}]::text[]);

${edges.length ? `insert into edges (from_node, to_node, kind, weight, one_way, accessible, step_count, slope_pct, source, osm_way_id, shape) values
${edgeRows.join(',\n')};` : '-- (no edges)'}

commit;
`;
}

export function toCsv(entrances) {
  const cols = ['osm_node', 'node_id', 'building', 'entrance', 'used_for_routing', 'wheelchair',
    'door', 'automatic_door', 'width', 'level', 'note', 'osm_link'];
  const cell = (v) => (/[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
  const rows = [...entrances]
    .sort((a, b) => a.building.localeCompare(b.building) || a.osmId - b.osmId)
    .map((e) => [e.osmId, e.nodeId, e.building, e.tags.entrance, e.imported ? 'yes' : 'no', e.tags.wheelchair,
      e.tags.door, e.tags.automatic_door, e.tags.width, e.tags.level, e.note,
      `https://www.openstreetmap.org/node/${e.osmId}`].map(cell).join(','));
  return [cols.join(','), ...rows].join('\n') + '\n';
}

function build() {
  if (!fs.existsSync(SNAPSHOT_PATH)) throw new Error('No campus-snapshot.json yet: run `fetch` first.');
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  const result = convert(snapshot.elements);
  fs.writeFileSync(SQL_PATH, toSql(result, snapshot));
  fs.writeFileSync(CSV_PATH, toCsv(result.entrances));

  const count = (pred) => result.edges.filter(pred).length;
  console.log(`${result.nodes.length} nodes, ${result.edges.length} edges ` +
    `(${count((e) => e.kind === 'stairs')} steps, ${count((e) => e.accessible === null)} not surveyed for step-free access)`);
  console.log(`${result.entrances.length} entrances, ${result.entrances.filter((e) => e.imported).length} used for routing`);
  console.log(`Wrote ${path.relative(process.cwd(), SQL_PATH)} and ${path.relative(process.cwd(), CSV_PATH)}`);
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--campus') options.campus = argv[++i];
    else if (argv[i] === '--bbox') options.bbox = argv[++i].split(',').map(Number);
  }
  if (options.bbox && (options.bbox.length !== 4 || options.bbox.some(Number.isNaN))) {
    throw new Error('--bbox needs four numbers: south,west,north,east');
  }
  return options;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, ...rest] = process.argv.slice(2);
  try {
    if (command === 'fetch') await fetchSnapshot(parseArgs(rest));
    else if (command === 'build') build();
    else {
      console.log('Usage: node backend/osm/import-osm.mjs fetch [--campus NAME | --bbox S,W,N,E]');
      console.log('       node backend/osm/import-osm.mjs build');
      process.exitCode = command ? 1 : 0;
    }
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}
