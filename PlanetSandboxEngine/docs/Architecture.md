# Architecture

PSEは、Entity / Component / System を中心にした拡張可能な構造を目指します。

## Core Principles

1. Everything is Entity
2. Input becomes Command
3. Scale controls camera, UI, simulation detail
4. Reference Frame supports planets, vehicles, interiors and orbit
5. Mods can add characters, tools, biomes, atmospheres, motions and AI

## Main Modules

- engine: Entity, Command, CameraRig, EventBus, Input, Save
- world: Planet, Terrain, Ocean, Atmosphere, Clouds, Celestial
- physics: Rapier wrapper + PSE custom planet/orbit physics
- ai: Mind, Memory, Emotion, Conversation, Perception, Gambit
- character: Player, NPC, Creature, Animal, Human
- ui: DesktopUI, MobileUI, XRUI, HUD
