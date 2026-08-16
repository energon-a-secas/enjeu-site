# Stake - print-and-play boss-rush card game
PORT := 8867

.PHONY: help serve kill check sim dice lint credits

help:
	@echo "make check    - run every checker and its selftest"
	@echo "make sim      - balance simulator (20k fights per cell)"
	@echo "make dice     - regenerate the dice bridge table"
	@echo "make lint     - card data against the balance ladder"
	@echo "make credits  - build CREDITS.md from the art manifest"
	@echo "make serve    - static server on http://localhost:$(PORT)"

serve:
	python3 -m http.server $(PORT)

kill:
	@lsof -ti :$(PORT) | xargs -r kill 2>/dev/null || echo "nothing on $(PORT)"

sim:
	python3 tools/sim.py --trials 20000

dice:
	python3 tools/dice_bridge.py

lint:
	python3 tools/lint_cards.py

credits:
	python3 tools/credits.py

# Every checker, plus the selftest that proves it can still fail.
# credits.py is expected to refuse until the art manifest is filled in.
check:
	@echo "== card data =="       && python3 tools/lint_cards.py
	@echo "\n== card linter selftest ==" && python3 tools/lint_cards.py --selftest
	@echo "\n== credits selftest =="     && python3 tools/credits.py --selftest
	@echo "\n== dice bridge =="          && python3 tools/dice_bridge.py
