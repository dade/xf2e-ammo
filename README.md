# xF2e Ammo
A simple module to add ammo capabilities to melee weapons. Two example weapons have been created in the compendium folders:
- Gunblade - sword that uses shells to augment damage on the weapons
- Shockhammer Gauntlets - fist weapons that are loaded with shells, but only expend ammunition on hit/critical hit

## What the module does
The module injects a new range increment to weapons (5ft.) that allows you to alter ammunition properties on the weapon as if it was a ranged weapon.

The module also includes two traits `melee-ammo` and `consume-on-hit`, which has its own logic attached.

### Melee Ammo
Makes the weapon use strength as its default attribute. This is because the weapon is _technically_ classed as a ranged weapon in the PF2e/SF2e system, so add this when you want to ensure that it uses strength for the weapon.

### Consume On hit
This changes the order of operations on the ammo consumption, using libWrapper to wrap the logic and only call consumeAmmo if the Strike hit or critically hit the enemy. This logic is for the gauntlets, as the shell explodes on impact only, meaning a miss would not expend the shell.

## Module Support
The module is provided as-is with minimal support. I'm not an especially skilled developer. Feel free to use, redistribute, or edit as you wish. I only ask that you do not obfuscate this code so that others may use it as examples in their own work. Don't minify or otherwise make it unreadable. This took a bit of work to figure out, and if it helps people fast track to solving their own development puzzles, that'd be rad.
