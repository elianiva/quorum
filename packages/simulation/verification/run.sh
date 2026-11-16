#!/usr/bin/env bash
# Checks every TLA+ model in this folder with the statechart skill and writes each report and chart
# to a new folder under $OUT (default: a fresh temp folder). Prints each report. Exits 1 when a rule breaks.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
statechart="$here/../../../.agents/skills/statechart/scripts/statechart"
out="${OUT:-$(mktemp -d)}"
failed=0
export PATH="$HOME/.local/bin:$PATH"

for model in runway/Runway node-life/NodeLife incident/Incident quarter/Quarter drill/Drill era-round/EraRound; do
  dir="${model%%/*}"
  name="${model##*/}"
  echo "=== $name"
  "$statechart" "$here/$model.tla" --config "$here/$model.cfg" --view "$here/$dir/view.mjs" --out "$out/$dir" || failed=1
done
echo "Reports and charts: $out"
exit "${failed:-0}"
