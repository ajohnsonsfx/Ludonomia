# Ludonomia

A premium, rule-based file naming tool designed for game development assets. 

## Features
- **Dynamic NameSets**: Create naming templates for different asset types (Locomotion, Weapons, etc.).
- **Organization**: Categorize your NameSets using Groups and Tags, and easily filter them in the Project Browser.
- **Drag-and-Drop Structure**: Easily rearrange the order of Elements in your filename template.
- **Combinatorial Generation**: Automatically generates a complete list of all possible name permutations based on your selected Elements and Terms. Includes 1-click Copy and CSV Export.
- **Immediate Term Insertion**: Add specific Terms to Elements on the fly as your project evolves.
- **Cross-Platform Readiness**: Standalone Windows executable built with Tauri + React.
- **Extensible Architecture**: Designed to be integrated into tools like Reaper via shared JSON configuration.

## Terminology
To keep development clear, we use the following terms:
- **Project**: The overall configuration file that contains your NameSets and Elements.
- **NameSet**: A specific naming rule or arrangement (e.g., "Locomotion"). Organized by a **Group** and multiple **Tags**.
- **Template**: The ordered sequence of Elements that defines a NameSet (e.g., `{Sound Type}_{CharacterID}_{Action}`).
- **Element**: A category or slot within a Template (e.g., "Sound Type", "Character ID").
- **Term**: A specific textual value that can fill an Element's slot (e.g., "SFX", "Dirt", "Hero").

## Tech Stack
- **Frontend**: React + TypeScript + dnd-kit
- **Backend**: Rust (Tauri)
- **Styling**: Vanilla CSS (Premium Dark Mode)

## Setup for Development
1. Clone the repository.
2. Install dependencies: `npm install`.
3. Run dev server: `npm run dev`.
4. Build native app: `npx tauri build`.
