---
title: 19. Parts
summary: The CPU, memory, and IOPS Parts that fill a Node's Slots, and the two shop modes that sell them.
section: design
order: 19
---

An [App Server](/design/05-components#app-server) and a [Database](/design/07-data-tier#relational-database) have three **Slots**: CPU, Memory, and IOPS. A **Part** fills one Slot, and the card draws it as a cartridge that seats into the Node card. The Slots are a preview until **Custom instances** is researched. Before then, a new Node buys a fixed instance type, and the Slots show the CPU, memory, and IOPS that type includes. The **Instance catalog** is the shop in this phase: it lists each family and size, the GB per vCPU, the network, the switching price, and the Burn.

After the research, the shop has two modes. The **Instance catalog** sells a preset and installs the CPU, memory, and IOPS Parts that the chosen family and size need, at the current Part prices. The **Parts catalog** sells each Slot on its own. A mode switch in the shop header moves between them. The Instance catalog keeps its family rail and size cards, and the Parts catalog keeps its one tab per Slot. A new Node can use either mode.

Selecting an instance buys only the Parts that are missing, so a Node that already has a CPU and memory kit pays only for the change. The preset never downgrades an installed CPU. Once a CPU is installed, the cards below its size are hidden, and the card footer remains the way to shrink the Node.

The families keep real CPU-to-memory ratios: Burstable 2 GB per vCPU, General 4, Compute 2, Memory 8, and ARM 4. These match the AWS T4g.medium, M7g, C7g, R7g, and Graviton shapes. The ratios are a property of the instance type before the research and of the memory kit after it.

The design borrows two shapes. A Factorio machine has slots that accept modules, and a rack server has separate CPU, DIMM, and drive bays. The game keeps the slot and the separate purchase, and it leaves out real compatibility. Any CPU Part fits any Slot, and any memory kit fits any CPU.

Starter Nodes come with their Parts already installed, and the guided Sandboxes place equipped Nodes, so their exercises keep running. A Node placed after the research begins empty and stays inert until its CPU and Memory are installed. A Database also needs its IOPS.

## The three Parts

| Slot   | Part     | What it sets                                            | Sold as                                                 |
| ------ | -------- | ------------------------------------------------------- | ------------------------------------------------------- |
| CPU    | A size   | vCPU, network, and the CPU share of Burn                | Nine sizes, from `nano` to `metal`                      |
| Memory | A kit    | GB per vCPU, and the family multiplier on the CPU price | Five kits: Burstable, General, Compute, Memory, and ARM |
| IOPS   | A volume | The IOPS class of a Database                            | General purpose or Provisioned IOPS                     |

The CPU Part carries the size. A size step doubles vCPU, doubles the network limit, and doubles the CPU share of Burn. The first size is `nano` at 0.5 vCPU. `metal` is 96 vCPU, and its last step is 1.5× rather than a double. A CPU swap restarts the Node.

The memory kit carries the family. It does not carry a fixed GB number. The kit says GB per vCPU, so a General kit gives 8 GB at 2 vCPU and 16 GB at 4 vCPU. The family multiplier scales the CPU price: Burstable 0.4×, Compute 0.85×, General 1×, Memory 1.3×, ARM 0.8×. The family model becomes a Part. A kit swap restarts the Node, and ARM needs research `arm-instances`. The RAM Slot stays empty until a CPU is installed, because the kit has no capacity without one.

ARM is the one kit that also costs Dev Hours. Moving an App Server to ARM ports its runtime, at the language's rate: Go 4, Rust 6, Java, C# and Zig 8, Node and Elixir 12, PHP 16, Ruby and Python 24, Haskell 32. A Database ports for free because it has no runtime, and a Sandbox ports for free. ARM's speed also depends on the language, from 0.93× a General box's CPU for Haskell to 1.03× for Go and Rust. The shop names the porting cost on the ARM card and disables the card until the Company has the Dev Hours.

The volume kit exists only on a Database. General purpose gives 3,000 IOPS at 1× the box. Provisioned IOPS gives 64,000 at 1.5×. The App Server has an IOPS Slot with no Part for sale, because swap has no IOPS choice in the model. The Slot shows **Swap**, so the card does not pretend the server has no disk.

## The card

The card has a light faceplate, a tinted header, engraved row separators, and a dark footer key. The three Slots sit in a strip under the rows, each one a 58 px cartridge in a recessed well. The Part body takes a muted tint of its group color, the label sits at the top, and the value is centered. A connector edge seats the cartridge in the well. An empty Slot shows a plus and a dashed edge.

A click on a Slot opens the shop on the Parts catalog for that Slot. The header also switches to the Instance catalog. A Node with a missing Part also gets an **Install parts** footer. Its Inspector has an **Open parts catalog** button and an **Open instance catalog** link. The rest of the Inspector stays about the Node, not the shop.

The tint follows the Slot's limiting resource. A Slot's outline turns amber at 70% utilization and red at 90%, so a saturated RAM Part is visible without opening the Inspector. The Part body uses `mix(hue, colors.muted, 0.35)`, which keeps the Part from outshining the card around it. A Database shows `3k` or `64k` on its IOPS Part, and an App Server shows **Swap** on its IOPS Slot.

## The shop

The shop is a modal with two modes. The header switches between **Instances** and **Parts**. A Slot opens the Parts catalog on that Slot. The footer's **Install parts** button also opens the Parts catalog. The Inspector has a button for each mode. Before Custom instances, only the Instance catalog is available and the Parts mode is locked.

The Instance catalog has a family rail and the size cards for the selected family. It shows the CPU, memory, network, switch price, and Burn for each size. Selecting a card installs the matching Parts in one action with one Undo. If the Node already has a Part, the preset keeps it and buys only what is missing. A Database also gets a general purpose volume if it has none. The preset does not downgrade an installed CPU, so the cards below the installed size are hidden.

The Parts catalog has one tab per Slot. The header names the Node and the Slot, and shows the installed Part or **Empty slot**.

- **CPU** shows nine cards from `0.5c` to `96c`. Each names the size, vCPU, network, and price. Installing a larger CPU restarts the Node.
- **Memory** shows five kit cards. Each names the kit, GB per vCPU, the GB it gives this CPU, its Burn multiplier, and its price. The ARM card also names the porting Dev Hours. The cards are disabled until a CPU is installed, and ARM waits for the research and the Dev Hours.
- **IOPS** shows the two volume classes on a Database. Each names its IOPS, Burn multiplier, and price. An App Server says that swap is built in and no IOPS Part is for sale.

Each card has one **Install** button. In the Instance catalog, a card says **Select** before the research and **Install** after it. The installed card gets a check and says **Current** and **Installed**. A purchase changes the Node in place, and Undo puts the old Part back with the rest of the Node's state. The shop does not keep an inventory of owned Parts.

The prices are one-time, then the Part's Burn follows from its installed value. A CPU costs `2 × component cost × vCPU × era cost index × market`. A memory kit costs `40 × family multiplier × era cost index × market`. A volume costs `24` for general purpose or `72` for provisioned IOPS, times the era index and market. The first CPU in an empty Slot costs the sum of the sizes from `micro` to the target, and `nano` costs its own size. Once a CPU is installed, a larger one costs the sum of the size steps from the installed size to the target, so a direct jump costs the same as walking those sizes. The Parts catalog and the post-research Instance catalog both charge these Part prices. The pre-research Instance catalog, the card footer, and the bulk resize use the instance resize price instead.

Selling a Node refunds half of its placement price and half of its installed Parts at the current market, so Parts are not stranded value.

## The weekly market

Part prices move on a seven-calendar-day cycle. A market multiplier swings between 0.85× and 1.15×, and CPU, Memory, and IOPS each have their own phase, so the shelves do not all rise together. The Parts catalog shows the multiplier as a signed percentage and an arrow, and the week strip marks today. The Parts catalog and the post-research Instance catalog use the market at the current game time. The pre-research Instance catalog uses the instance resize schedule.

In a Sandbox the cards show the reference price and the install is free. The shop says **Free in Sandbox** so the price is not mistaken for a bill.

## Where it stops

A real server lets an engineer keep a Part after removing it, pair a 4 vCPU CPU with 24 GB of RAM, and move a kit between Nodes. The game does not model a parts bin. The memory kit is a ratio, so the RAM moves with the CPU, and the solver reads one family instead of a list of DIMMs. A parts bin and arbitrary vCPU/RAM pairs need a module list in the Game state and a solver ABI that takes that list. The card and the shop would read the same list, so their shape would not change.

The shop uses the existing `size`, `family`, and `iops` fields plus the `parts` flags that say whether each Slot is filled. A new Part is a catalog row and a solver that understands it. The three Slots are the place to add it.
