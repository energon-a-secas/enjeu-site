#!/usr/bin/env python3
"""
Stake - balance simulator.

Plays the solo boss fight many times and reports the numbers the rulebook
claims: how many rounds a fight lasts, how often the player wins, and how
much life is permanently lost getting there.

Exists because a balance claim without a run behind it is a guess. Every
number in docs/BALANCE.md comes out of this file.

    python3 tools/sim.py              # the tuned table
    python3 tools/sim.py --trials N   # more samples
    python3 tools/sim.py --verbose    # one narrated fight per level

Standard library only. No arguments needed to get the table.
"""

from __future__ import annotations

import argparse
import itertools
import random
from dataclasses import dataclass, field, replace

LIFE = 25  # one life card, in damage points

# The check ladder. Four steps, chosen because every common die maps onto
# them with little rounding - see docs/DICE-BRIDGE.md.
SURE, EVEN, HARD, WILD = 0.75, 0.50, 0.25, 0.15
LADDER = [SURE, EVEN, HARD, WILD]


def harder(p: float) -> float:
    """One step down the ladder - what Roar does to your next check."""
    i = LADDER.index(p) if p in LADDER else 0
    return LADDER[min(i + 1, len(LADDER) - 1)]


@dataclass(frozen=True)
class Attack:
    name: str
    actions: int
    bet: int  # in life cards
    damage: int
    hit: float

    @property
    def ev(self) -> float:
        return self.damage * self.hit


# Tuned so that damage-per-life-card RISES with tier (56, 75, 84, 100, 125).
# The first pass had Tier 1 as the most card-efficient attack in the game,
# which made every level-up a downgrade under careful play.
STRIKE = Attack("Strike", 1, 0, 25, 1.00)
FOCUS = Attack("Focus", 1, 1, 75, SURE)
TIER = {
    1: Attack("Tier 1", 1, 1, 100, SURE),
    2: Attack("Tier 2", 1, 2, 225, SURE),
    3: Attack("Tier 3", 1, 2, 400, EVEN),
    4: Attack("Tier 4", 1, 3, 750, EVEN),
}


def all_in(cards: int) -> Attack:
    """All In - two actions, bet what you like, triple it or lose it."""
    return Attack(f"All In x{cards}", 2, cards, 3 * cards * LIFE, EVEN)


@dataclass
class Boss:
    name: str
    hp: int
    damage: int
    rage: int  # from this round on, damage doubles and cannot be guarded
    braced: bool = False
    minions: list[int] = field(default_factory=list)  # each entry = HP


@dataclass
class Player:
    cards: int
    skills: list[Attack]
    ready: int = 0
    spent: int = 0
    broken: int = 0
    bonus: int = 0  # element + biome affinity, added per attack that hits
    penalty: float | None = None  # a pending Roar

    def __post_init__(self) -> None:
        self.ready = self.cards

    @property
    def alive(self) -> int:
        return self.ready + self.spent

    def untap(self) -> None:
        self.ready += self.spent
        self.spent = 0

    def take(self, damage: int, unguardable: bool) -> bool:
        """Resolve incoming damage. Returns False if the player goes down.

        Guarding with a Ready card Spends it - it comes back next round.
        Guarding with a Spent card Breaks it - it is gone for the level.
        That asymmetry is the whole game: betting is free while you keep a
        guard, and ruinous the moment you do not.
        """
        owed = damage // LIFE
        if not unguardable:
            use = min(owed, self.ready)
            self.ready -= use
            self.spent += use
            owed -= use
        # Nothing Ready left (or Rage): cards break instead of tapping.
        for pool in ("ready", "spent"):
            if owed <= 0:
                break
            use = min(owed, getattr(self, pool))
            setattr(self, pool, getattr(self, pool) - use)
            self.broken += use
            owed -= use
        return owed <= 0


def affordable(player: Player, budget: int) -> list[tuple[Attack, ...]]:
    """Every legal set of attacks for one turn: <=3 actions, <=budget cards."""
    pool = list(player.skills)
    for n in range(1, player.ready + 1):
        pool.append(all_in(n))
    out: list[tuple[Attack, ...]] = []
    for size in range(1, 4):
        for combo in itertools.combinations_with_replacement(pool, size):
            if sum(a.actions for a in combo) > 3:
                continue
            if sum(a.bet for a in combo) > min(budget, player.ready):
                continue
            out.append(combo)
    return out


def p_kill(combo: tuple[Attack, ...], hp: int, bonus: int, halved: bool) -> float:
    """Chance this turn finishes the boss. Enumerates hit/miss outcomes."""
    total = 0.0
    for mask in itertools.product([True, False], repeat=len(combo)):
        p, dealt = 1.0, 0
        for atk, landed in zip(combo, mask):
            p *= atk.hit if landed else (1 - atk.hit)
            if landed:
                d = atk.damage + bonus
                dealt += (d // 2 // LIFE) * LIFE if halved else d
        if dealt >= hp:
            total += p
    return total


def expected(combo: tuple[Attack, ...], bonus: int, halved: bool) -> float:
    out = 0.0
    for atk in combo:
        d = atk.damage + bonus
        out += atk.hit * ((d // 2 // LIFE) * LIFE if halved else d)
    return out


def choose(player: Player, boss: Boss, style: str, rnd: int = 1) -> tuple[Attack, ...]:
    """Pick a turn. Styles differ only in how much life they are willing to bet."""
    desperate = rnd >= boss.rage - 1
    guard_need = -(-boss.damage // LIFE)  # ceil
    budget = {
        "turtle": 0,
        "safe": max(0, player.ready - guard_need),
        "greedy": max(0, player.ready - 1),
        "gamble": player.ready,
    }[style if style != "adaptive" else "safe"]

    options = affordable(player, budget)
    if not options:
        return (STRIKE,) * 3

    if style == "gamble":
        options = affordable(player, player.ready)

    if style == "adaptive":
        # Take a kill shot when it is likely, or when Rage is about to make
        # the fight unsurvivable anyway. A flat 50% threshold (first pass)
        # made adaptive play WORSE than safe play at level 1 - it traded a
        # comfortable grind for a coin flip.
        wide = affordable(player, player.ready)
        best = max(wide, key=lambda c: p_kill(c, boss.hp, player.bonus, boss.braced))
        odds = p_kill(best, boss.hp, player.bonus, boss.braced)
        if odds >= 0.6 or (desperate and odds >= 0.3):
            return best

    return max(options, key=lambda c: expected(c, player.bonus, boss.braced))


def play(player: Player, boss: Boss, style: str, rng: random.Random,
         verbose: bool = False) -> tuple[str, int, int]:
    """Run one fight. Returns (outcome, rounds, cards permanently Broken)."""
    for rnd in range(1, 21):
        player.untap()
        boss.braced = boss.braced and rnd == 1  # Brace lasts through this turn

        for atk in choose(player, boss, style, rnd):
            if atk.bet > player.ready:
                continue
            player.ready -= atk.bet
            player.spent += atk.bet
            need = player.penalty or atk.hit
            player.penalty = None
            if rng.random() < need:
                dealt = atk.damage + player.bonus
                if boss.braced:
                    dealt = (dealt // 2 // LIFE) * LIFE
                # Damage spills onto minions first only if the player aims
                # there; the sim always aims at the boss body, which is the
                # pessimistic read for the player.
                boss.hp -= dealt
        boss.braced = False

        if boss.hp <= 0:
            if verbose:
                print(f"    round {rnd}: boss down, {player.broken} cards broken")
            return "win", rnd, player.broken

        # Minions act, then the boss rolls its d6.
        for _ in boss.minions:
            if not player.take(25, rnd >= boss.rage):
                return "loss", rnd, player.broken

        raging = rnd >= boss.rage
        dmg = boss.damage * (2 if raging else 1)
        roll = rng.randint(1, 6)
        if roll == 1:
            boss.braced = True
        elif roll in (2, 3):
            if not player.take(dmg, raging):
                return "loss", rnd, player.broken
        elif roll == 4:
            if boss.hp > 2 * 50 and len(boss.minions) < 3:
                boss.minions.append(100)
                boss.hp -= 100
            elif not player.take(dmg, raging):
                return "loss", rnd, player.broken
        elif roll == 5:
            player.penalty = None  # applied below
            if not player.take(dmg, raging):
                return "loss", rnd, player.broken
            player.penalty = harder(SURE)
        else:
            if not player.take(dmg * 2, raging):
                return "loss", rnd, player.broken

        if verbose:
            print(f"    round {rnd}: boss {max(boss.hp,0):>4} hp | "
                  f"ready {player.ready} spent {player.spent} broken {player.broken}")
    return "stall", 20, player.broken


# ── The tuned campaign ────────────────────────────────────────────────
# Boss damage is set so the player's SAFE betting budget (pool minus the
# cards needed to guard a nominal hit) grows 2 -> 4 across the campaign.
# Holding it flat made every level-up cosmetic.
# HP totals are chosen to be a whole number of boss life cards (the value per
# card is printed on the boss): 8x50, 7x100, 10x100, 8x150, 10x200.
LEVELS = [
    # level, player cards, skills unlocked, boss
    (1, 4, [], Boss("Level 1", 400, 50, 4)),
    (2, 5, [1], Boss("Level 2", 700, 50, 4)),
    (3, 6, [1, 2], Boss("Level 3", 1000, 75, 4)),
    (4, 7, [1, 2, 3], Boss("Level 4", 1200, 100, 4)),
    (5, 8, [1, 2, 3, 4], Boss("Level 5", 2000, 100, 5)),
]

STYLES = ["turtle", "safe", "adaptive", "gamble"]


def run(trials: int, seed: int, bonus: int = 0) -> None:
    rng = random.Random(seed)
    head = f"{'level':<7}{'style':<10}{'win%':>7}{'rounds':>9}{'broken':>9}"
    print(head)
    print("-" * len(head))
    for lvl, cards, tiers, boss in LEVELS:
        skills = [STRIKE, FOCUS] + [TIER[t] for t in tiers]
        for style in STYLES:
            wins, rounds, broken = 0, [], []
            for _ in range(trials):
                p = Player(cards, skills, bonus=bonus)
                outcome, r, b = play(p, replace(boss, minions=[]), style, rng)
                if outcome == "win":
                    wins += 1
                    rounds.append(r)
                broken.append(b)
            wr = 100 * wins / trials
            ar = sum(rounds) / len(rounds) if rounds else float("nan")
            ab = sum(broken) / trials
            print(f"{lvl:<7}{style:<10}{wr:>6.1f}%{ar:>9.1f}{ab:>9.1f}")
        print()


def main() -> None:
    ap = argparse.ArgumentParser(description="Stake balance simulator")
    ap.add_argument("--trials", type=int, default=20000)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--bonus", type=int, default=0,
                    help="affinity bonus per landed attack (0, 25 or 50)")
    ap.add_argument("--verbose", action="store_true",
                    help="narrate one adaptive fight per level")
    args = ap.parse_args()

    if args.verbose:
        rng = random.Random(args.seed)
        for lvl, cards, tiers, boss in LEVELS:
            print(f"  level {lvl} ({cards} life cards vs {boss.hp} hp, "
                  f"{boss.damage} dmg, rage {boss.rage}):")
            skills = [STRIKE, FOCUS] + [TIER[t] for t in tiers]
            play(Player(cards, skills, bonus=args.bonus),
                 replace(boss, minions=[]), "adaptive", rng, verbose=True)
            print()
        return

    print(f"\nStake balance - {args.trials} fights per cell, "
          f"affinity bonus +{args.bonus}\n")
    run(args.trials, args.seed, args.bonus)


if __name__ == "__main__":
    main()
