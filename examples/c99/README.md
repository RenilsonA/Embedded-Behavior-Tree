# C99 example

A simulated delivery robot driven by `btree-lib`, in plain C99 with only the standard library. It runs on any PC and shows the whole flow, without a board:

```bash
make run          # gcc/clang/any C99 compiler: make CC=clang run
make DEBUG=0 run  # without the [BTREE] log lines
./delivery 300    # waits 300 ms between ticks (to watch it live in BTree Studio)
```

## The tree

[`tools/btree_robot/delivery.xml`](tools/btree_robot/delivery.xml):

```
Sequence
├── Fallback
│   ├── battery_ok?           Condition
│   └── charge                Action, returns RUNNING while charging
├── RetryUntilSuccessful(3)
│   └── open_door             Action, the door is stuck on the first try
├── Sleep(200 ms)
├── Inverter
│   └── obstacle_detected?    Condition
└── deliver_package           Action
```

`main.c` runs three deliveries. The first one charges the battery (the action stays RUNNING across several ticks), the second one goes straight through, and the third one finds an obstacle, so the Inverter fails the tree.

## Files

| File | Written by | Content |
|---|---|---|
| `tools/btree_robot/` | generator | the flattened array, the RAM buffers and the tree XML |
| `include/`, `src/btree_robot/btree_robot_delivery.c` | generator, then edited | the leaf functions (the robot simulation) |
| `include/`, `src/btree_robot/btree_robot_blackboard.*` | generator, then edited | the robot state shared by the leaves |
| `btree_port.c` | hand | the two platform functions the library requires: `btree_common_delay_ms()` and `btree_common_debug_output()` |
| `main.c` | hand | the tick loop, using `btree_manager_tick()` with callbacks |

The library is used straight from [`btree-lib/`](../../btree-lib), with no copy. To regenerate the tree code after changing the XML, use **Gerar código C** in BTree Studio with this folder as output, or run from `Scripts/` (your leaf code and blackboard are kept; only new functions are added):

```python
from btree_array_creator import BTREE_ARRAY
x = BTREE_ARRAY()
x.set_archive_data("Your name", "you@mail.com", "1.0", "Your name", "robot")
x.create_trees(archive="../examples/c99/tools/btree_robot/delivery.xml", output="../examples/c99", main_tree="delivery")
```

## Watching it in BTree Studio

The `[BTREE] | Tree: ROBOT | ...` lines are the format BTree Studio reads. Open `tools/btree_robot/delivery.xml` in a Studio project named `robot` (or set its *Nome no log* to `ROBOT`), press `F3` for the Monitor, and then:

- **Live:** in the Terminal, choose the *External command* source with `/full/path/to/examples/c99/delivery 300` and click **Conectar**. The tree animates as the program runs, one tick every 300 ms.
- **Replay:** save a run with `./delivery > run.log` and replay the file (Terminal › replay log).

## On a microcontroller

The same code runs on a board. Only two things change: `btree_port.c` uses your RTOS/HAL delay and UART/RTT output, and the loop in `main.c` becomes your main loop or an RTOS task.
