# Outdoor paths from OpenStreetMap

`import-osm.mjs` turns the campus's footpaths, steps, roads and building
entrances from OpenStreetMap (OSM) into WING `nodes` and `edges`. Indoor
data still comes from our own floor plans: OSM has almost none.

Needs Node 18+ and migrations `0002` and `0003`. No `npm install`.

## Updating the outdoor data

Run these from the repo root:

```bash
node backend/osm/import-osm.mjs fetch   # download the campus into campus-snapshot.json
node backend/osm/import-osm.mjs build   # write outdoor-import.sql and entrances-to-survey.csv
```

Then paste `outdoor-import.sql` into the Supabase SQL editor.

- **Commit all three files** in one pull request. The snapshot makes every
  build reproducible, and its diff shows what changed in OSM since last time.
- **Re-running replaces the previous import.** Rows the import made have
  `source = 'osm'`. Never edit those by hand: fix the data in OSM and
  re-import, or add a `'manual'` row. Hand-made rows are never touched.
- **The import stops, changing nothing,** if an OSM node it would remove
  is still used by a hand-made edge or a QR code. Re-link that first.
- **It also stops if any closure points at an OSM edge,** active or ended,
  because re-importing gives every OSM edge a new id. Before re-importing,
  list them:
  `select c.*, e.from_node, e.to_node from closures c join edges e on e.id = c.edge_id where e.source = 'osm';`
  Delete those rows, run the import, then add the still-active ones again,
  finding the new `edge_id` by `from_node` and `to_node`.

`fetch` finds the campus by its OSM outline (`--campus "University of Bath"`
is the default) and adds 100 m around it. Use `--bbox south,west,north,east`
to choose the area yourself.

## What gets imported

| OSM | WING |
|---|---|
| A point where paths meet, a path ends, or a kerb or crossing | `junction` node |
| A building entrance (`entrance=*`) | `exit` node |
| Footpath, path, pedestrian area, road (between two nodes) | `outdoor` edge, with its bends in `shape` |
| Steps | `stairs` edge, never step-free |
| Steps with `ramp:wheelchair=yes` | `ramp` edge |
| `incline=8%` / `-5%` / `10°` | `slope_pct`, signed along the edge |
| `wheelchair=yes` / `no` | `accessible` true / false; otherwise null (not surveyed) |
| Raised or rolled kerb | edges on both sides marked not step-free |
| `oneway=yes` on a footpath, escalators | `one_way` |

Not imported: private roads and paths (`access=private` with no foot
access), emergency-only exits, and private entrances.

An entrance that isn't on a mapped path gets a straight line to the nearest
path within 25 m. Check those on site: the line may cross a wall or a road.

## After importing

1. **Link each entrance to its building's indoor graph.** For each row in
   `entrances-to-survey.csv` that you need, add a `'manual'` edge from the
   entrance's `node_id` to the door node inside, with `kind = 'door'`.
2. **Survey.** OSM rarely says whether a path or door is step-free, so most
   imported edges start with `accessible` empty. The CSV shows what OSM knows
   about each door, with a link to it on openstreetmap.org.
3. **Put what you learn back into OSM,** such as `wheelchair=*`, `door=*`,
   `automatic_door=*`, `width=*` and `incline=*`, then re-import. Before the
   team edits OSM together, post the notice the
   [Organised Editing Guidelines](https://wiki.osmfoundation.org/wiki/Organised_Editing_Guidelines)
   ask for, at least 2 weeks ahead.

OSM data is © OpenStreetMap contributors under the
[ODbL](https://www.openstreetmap.org/copyright). The app must show that
credit wherever it shows the map or a route built from it.
