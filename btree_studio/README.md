# BTree Studio

> **Made with AI.** BTree Studio is the only part of this repository developed with the help of AI (Claude).
> The C library (`btree-lib/`), the code generator (`Scripts/`) and the examples were not made with AI.

Visual editor and debugger for the **Embedded Behavior Tree**, based on Groot2 but aimed at **embedded
systems**: instead of talking to a ROS/ZeroMQ runtime, it reads the log the firmware itself prints over UART or
SWD. Create projects and trees, edit with drag and drop, save/export the XML used by
`Scripts/btree_array_creator.py`, generate the C code and follow the execution **in real time**, or go back in time
on the timeline to see how the tree looked at any event.

![colors](https://img.shields.io/badge/running-yellow-f6c744) ![](https://img.shields.io/badge/success-green-3ccf7a) ![](https://img.shields.io/badge/fail-red-f05252) ![](https://img.shields.io/badge/standby-gray-6b7483)

## Running

Requires only **Python 3.8+** (Windows, Linux or macOS) and a modern browser.

```bash
cd btree_studio
python3 studio.py          # or ./start.sh  (Windows: start.bat)
```

The browser opens at `http://localhost:8765`. Options: `--port`, `--workspace <folder>`, `--no-browser`,
`--scripts <Scripts folder>`, `--host`.

- `pip install pyserial` is **optional**: only needed to read the UART through the server.
- `pip install pylink-square` is **optional**: only needed to read the J-Link directly over SWD.
- Without the server, `frontend/index.html` can be opened directly in Chrome/Edge: editing, Web Serial,
  simulation and export work; projects are stored in the browser.

### Executable (optional)

```bash
pip install pyinstaller pyserial
pyinstaller --onefile --name btree-studio --add-data "frontend:frontend" studio.py   # Windows: "frontend;frontend"
```

The executable uses `~/BTreeStudio` as its workspace. To generate C code from it, pass
`--scripts /path/Embedded-Behavior-Tree/Scripts` (requires a Python on the PATH).

## Workspace, projects and trees

- The **workspace** (left panel) holds several **projects**. On disk each project becomes
  `workspace/<project>/<project>.xml` + `<project>.btproj` (Groot2 compatible) + `studio.json`.
- Every project has a **main tree** (★), created as `main` with `Root → Action`. It can be renamed and can only
  be deleted after another tree is **set as main**.
- **Subtrees**: create as many as you like (`+` button on the tabs or on the project). A **SubTree** node has no
  children in the diagram: **expand** it (⤢ icon or the `E` key) to see the branch inline, or **double-click** it
  to open it in a tab. Renaming a tree updates its SubTrees automatically.
- The project name is the prefix of the generated C code and appears **in upper case** in the `Tree:` field of the log.

## Supported nodes

| Category | Node | XML | Field |
|---|---|---|---|
| Control (1 parent, ≥1 child) | Sequence, Fallback, Reactive Sequence, Reactive Fallback | `Sequence`, `Fallback`, `ReactiveSequence`, `ReactiveFallback` | optional label (`name`) |
| Action (1 parent, no children) | Action, Condition | `Script`, `ScriptCondition` | **required function** (`code`, a C identifier) |
| | Sleep | `Sleep` | `msec`: digits only, 0 – 4 294 967 295 ms (uint32) |
| Decorator (1 parent, 1 child) | Retry Until Success, Repeat | `RetryUntilSuccessful`, `Repeat` | `num_attempts` / `num_cycles`: digits only, 1 – 65 535 (firmware uint16) |
| | Keep Running Until Success, Inverter, Force Success, Force Fail | `KeepRunningUntilFailure`, `Inverter`, `ForceSuccess`, `ForceFailure` | — |
| Subtree | SubTree | `SubTree ID="…"` | called tree |

Child rules are enforced while editing, and the **Problems** tab lists anything that would block
generation (empty or invalid C function, control node without children, decorator without a child, broken SubTree,
cycles…).

## Editing

- **Drag** a node from the palette onto another: center = child, edges = before/after. Dropping a **decorator** on a
  leaf wraps it. Clicking a palette item adds it to the selected node.
- Drag existing nodes to move them (hold `Ctrl` to copy). The `+` below a node adds children.
- **Loose nodes (Groot2 style)**: drop a palette node on **empty space** (or right-click the canvas ›
  *New loose node here*) and it stays loose, with a dashed border. To link it, drag the child's
  **top handle** to the parent, or drag the parent's **`+`** to the child. Dragging a linked node sideways only
  **reorders** it among its siblings (order is the tree's behavior); it is never unlinked that way. To
  **disconnect**, drag the top handle to empty space, use *Disconnect from parent* or
  right-click the **edge**. While there are loose nodes the project **cannot be saved/exported** (the draft stays in
  the browser).
- **Selection**: click selects; `Ctrl`+click adds/removes; `Shift`+drag on empty space draws a box;
  `Ctrl+A` selects all. Clicking an **edge** selects it.
- **`Del`** removes only the selected nodes (their children stay loose in place) or disconnects the selected edge.
  *Delete branch* (right-click) removes the node and everything below it.
- **`Ctrl+C` / `Ctrl+X` / `Ctrl+D`** copy/cut/duplicate **only the selected nodes**; links between selected nodes are
  kept. *Copy branch* (right-click, only on nodes with children) copies the node and everything
  below. `Ctrl+V` pastes inside the selected node when it fits; otherwise the nodes are placed loose beside it.
- **Right-click**: add child/sibling, wrap with, change type, copy/paste, duplicate, convert to subtree, disconnect,
  delete.
- **Clean screen**: New/Open/Export/Generate C live in the **File** menu. The buttons at the corners of the
  bar (or `Ctrl+B` / `Ctrl+I`) hide the side panels. The terminal is closed in the Editor and opens by itself in the
  Monitor. Secondary information in the right panel sits in collapsible sections (▸).
- Shortcuts: `Ctrl+S` save, `Ctrl+Z`/`Ctrl+Y`, `Del`, `Ctrl+C/X/V/D`, arrows to navigate, `Alt+←/→` reorder,
  `Enter` edit, `Ctrl+K` commands, `Space`/`Tab` add, `F` fit to screen, `F2`/`F3` Editor/Monitor, `F1` help.
- **Quick add**: `Space`/`Tab` with a node selected, **double-click on empty space** or a click on a node's **`+`**
  opens a type search. The field can be given right away: `action open_door`, `condition battery_ok`, `sleep 500`,
  `retry 3`. `Enter` does what makes sense (child, wrap or sibling); `Shift+Enter` forces a sibling. Chain with `Tab`.
- **`Ctrl+K`** (or *Buscar…*, "search", in the bar): command palette — go to a node by its function, open trees,
  simulate, export, switch theme, etc.
- The tree is **animated**: nodes glide to their new place, new nodes "grow" out of their parent and removed ones fade
  out; `F`, zoom and centering glide the camera; a fast canvas drag keeps going with inertia. Hovering a node
  highlights the path from the Root. On large trees a **minimap** appears while the camera moves (click/drag on it to
  navigate; toggle it with the map button). Animations respect the system's "reduce motion" setting and can be turned
  off with `Ctrl+K` › *Turn animations off*.
- **Corner hints** show the shortcuts that apply right now (nothing selected, node selected, loose nodes, Monitor).
  The `×` hides them; `Ctrl+K` › *Show hints* brings them back.
- **File › Export**: XML, `.btproj + .xml` (Groot2) or **Generate C code** (runs
  `Scripts/`). The generation dialog has the same options as the Python script:
  - file header: author, e-mail, version and copyright;
  - code: the C project name (`btree_<project>_…`) and an optional symbol prefix (`<prefix>_btree_…`). If the C
    project differs from the Studio project, the Monitor's log name follows it automatically;
  - destination: the output folder, typed or picked with **Browse…** (navigate, create folders);
  - a preview of every file that will be written, marking which ones are new, which already exist and are kept
    (your code) and which are replaced.

  The output folder gets three folders, each with a `btree_<project>/` subfolder: `tools/` (array, common and the
  tree XML, always regenerated), `include/` and `src/` (your leaf functions and blackboard). Generating again into
  the same folder never overwrites your code: only the functions of new leaves are appended. The settings are saved
  with the project (`studio.json`).

## Debugging (Monitor mode)

> **Timeline**: in the Monitor, the bottom bar shows every `[BTREE]` event of the open project (yellow = running,
> green = success, red = fail; gray ticks = new run). With no events, it offers **Simulate** and
> **Connect…**.
>
> | To… | Do |
> |---|---|
> | see the tree **as it was** at an instant | click/drag on the bar, or click a `[BTREE]` line in the terminal |
> | step event by event | `,` / `.` (or ◀ ▶) |
> | go to the previous/next failure | `Shift+,` / `Shift+.` (or Shift+click ◀ ▶) |
> | pause / play the animated history | `Space` |
> | return to live | `End` or *Live* |
> | see more/fewer events | mouse wheel over the bar; `Shift`+wheel scrolls; the thin strip below is the whole history (failures in red) |
>
> Data keeps arriving while you look at the past, and the right panel (running now, last transitions, node counters)
> shows the values for that instant. Live, every state change makes the node "pulse" and a spark runs along the edge:
> **down** when the child starts running (the tick) and **up** in the color of the result.

In the **Terminal** panel, choose the source and click **Connect**:

| Source | When to use |
|---|---|
| Serial (browser / Web Serial) | Chrome/Edge, no server. |
| Serial UART (server) | Any browser; requires `pyserial`. |
| J-Link direct – SWD/RTT (server) | Reads RTT straight from the J-Link, without J-Link Commander/RTT Viewer: enter the device (e.g. `STM32F411RE`); the `_SEGGER_RTT` address is optional. Requires `pip install pylink-square` + SEGGER's J-Link software. |
| SWD via RTT – TCP (server) | OpenOCD: `rtt setup <addr> <size> "SEGGER RTT"; rtt start; rtt server start 9090 0` → port 9090. J-Link: port 19021. |
| External command (server) | Reads a program's output: `pyocd rtt -t <target>`, `probe-rs attach --chip <chip> fw.elf`, `JLinkRTTClient`… |
| Simulation | Runs the main tree with random results (great for validating the tree). |
| Replay log | Replays a saved or pasted `.log`/text. |

Other tools can also send lines: `curl -d '{"line":"[BTREE] | ..."}' localhost:8765/api/log`.

The terminal shows everything the device sends; lines in the format

```
[BTREE] | Tree: %s | Node: %d | Status: %s | Type: %s | Function: %s
```

animate the tree: **yellow** = running, **green** = success, **red** = fail/error, **gray** = standby.
Sequence/Fallback do not exist in the compiled array, so their state is inferred from the most recently executed
child; expanded subtrees show the state **of each instance**. When a node starts running (`Running`), every node
**after it** in the array goes back to gray: those belong to the previous pass (tree restart, new Retry/Repeat attempt,
another branch). Exceptions: re-evaluations of *Reactive* nodes and a decorator re-entered from its own child.

- `Node` is the index in the generated array. Turn on **#** (bottom-right corner) to see the indices on the nodes.
  The order is the same as `btree_array_creator.py` (checked by a test on every example tree).
- `Tree` is the project name in upper case; it can be changed in *Name in log* in the project
  properties.
- Click a `[BTREE]` line in the terminal to locate the node and see the tree at that instant. Lines whose
  index/type do not match the tree are marked with ⚠ (XML differs from the firmware).
- For the firmware to emit the log, build with `BTREE_COMMON_DEBUG` non-zero and define
  `void btree_common_debug_output(const char *line)` in your firmware, sending `line` to the UART/RTT. The library builds
  each line in the format above.

## Structure

```
studio.py               local server (standard library only; pyserial optional)
frontend/index.html     interface (plain HTML/CSS/JS, no build step)
frontend/js/model.js    node types, XML, validation, firmware order, log parser
frontend/js/canvas.js   layout, drawing, pan/zoom, drag and drop, editing actions
frontend/js/debug.js    data sources, terminal, node states, history (time travel), simulator
frontend/js/timeline.js Monitor timeline
frontend/js/command.js  command palette (Ctrl+K) and quick add
frontend/js/hints.js    contextual hints in the canvas corner
tests/                  tests (node tests/test_model.js · python3 tests/test_order.py · python3 tests/test_server.py)
tests/ui/               browser tests: full flow, usage scenarios, dynamic features (dynamics.js) and a "monkey" test
                        (thousands of random actions checking tree integrity). cd tests/ui && npm i playwright-core && ./run.sh
```
