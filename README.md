# Ludonomia

A premium, rule-based file naming tool designed for game development assets. 

## Features
- **Dynamic Presets**: Create naming templates for different asset types (Locomotion, Weapons, etc.).
- **Drag-and-Drop Structure**: Easily rearrange the order of categories in your filename.
- **Immediate Term Insertion**: Add specific terms on the fly as your project evolves.
- **Cross-Platform Readiness**: Standalone Windows executable built with Tauri + React.
- **Extensible Architecture**: Designed to be integrated into tools like Reaper via shared JSON configuration.

## Terminology
To keep development clear, we use the following terms:
- **Project**: This contains everything. It lives with the project.
- **Name Set** (or *Asset Type*): Formerly called "Preset". This is a specific arrangement, like "Footsteps", "Attacks", etc.
- **Element**: Formerly called "Category". Things like Character ID, Surface Material, etc.

## Tech Stack
- **Frontend**: React + TypeScript + dnd-kit
- **Backend**: Rust (Tauri)
- **Styling**: Vanilla CSS (Premium Dark Mode)

## Setup for Development
1. Clone the repository.
2. Install dependencies: `npm install`.
3. Run dev server: `npm run dev`.
4. Build native app: `npx tauri build`.
