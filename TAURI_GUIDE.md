# Tauri Desktop Architecture & Cloud CI/CD Packaging Guide

> **Project Name**: Minimum Bounding Circle Visual Solver (`CableOptimizer`)  
> **Target Audience**: Frontend Engineers / Independent Developers / Desktop App Beginners  
> **Core Objective**: Understand how to integrate a modern Web frontend with the Tauri (v2) desktop runtime environment and automatically compile into a single Windows `.exe` application via GitHub Actions with zero local build setup.

---

## Table of Contents
1. [Tech Stack & Architecture: Why Tauri?](#1-tech-stack--architecture-why-tauri)
2. [Project Structure & Module Breakdown](#2-project-structure--module-breakdown)
3. [From Web to Desktop: Setting Up Tauri](#3-from-web-to-desktop-setting-up-tauri)
4. [Configuration Files & Code Deep Dive](#4-configuration-files--code-deep-dive)
5. [Windows Icon System & RC.EXE Compilation](#5-windows-icon-system--rcexe-compilation)
6. [GitHub Actions CI/CD Cloud Packaging](#6-github-actions-cicd-cloud-packaging)
7. [Frequently Asked Questions (FAQ)](#7-frequently-asked-questions-faq)

---

## 1. Tech Stack & Architecture: Why Tauri?

When converting web applications into desktop apps, the two primary solutions are **Electron** and **Tauri**:

| Metric | Electron | Tauri (v2) [Used here] |
| :--- | :--- | :--- |
| **Core Engine** | Chromium browser + Node.js runtime | **Rust Core** + Native OS Webview |
| **Windows Component** | Bundled heavy Chrome browser | **Windows WebView2** (System lightweight component) |
| **Final EXE Size** | 120 MB ~ 250 MB | **10 MB ~ 25 MB** (Extremely lightweight) |
| **Startup & Memory** | Slower startup, 200 MB+ RAM | **Millisecond startup**, ~20 MB - 40 MB RAM |
| **Security & Obfuscation** | ASAR easily unpacked | Embedded in Rust binary with JS obfuscation |

### Runtime Execution Flow:
```text
[ User clicks CableOptimizer.exe ]
               │
               ▼
   [ Rust starts lightweight binary ]
               │
               ▼
   [ Mounts Windows WebView2 window ]
               │
               ▼
[ Loads embedded dist/ assets (HTML/JS/CSS) ]
               │
               ▼
        [ Instant offline render ]
```

---

## 2. Project Structure & Module Breakdown

The project separates cleanly into **Frontend Web Layer** and **Rust Desktop Layer**:

```text
CableOptimizer/
├── dist/                          # Production build output (Static HTML, obfuscated JS, CSS)
├── package.json                   # Frontend dependencies & scripts (includes @tauri-apps/cli)
├── vite.config.js                 # Vite bundler configuration
├── app-icon.svg                   # High-res vector source icon
│
├── .github/
│   └── workflows/
│       └── release.yml            # GitHub Actions cloud Windows build pipeline
│
└── src-tauri/                     # ★ Core Tauri Rust Subproject ★
    ├── Cargo.toml                 # Rust dependencies & metadata (Tauri engine)
    ├── tauri.conf.json            # Tauri desktop configuration (window, paths, icons)
    ├── build.rs                   # Rust build hook (compiles resources & icons)
    ├── icons/                     # Multi-resolution icon set
    │   ├── icon.ico               # Windows application main icon
    │   ├── 32x32.png / 128x128.png# Tray and window PNG icons
    │   └── icon.icns              # macOS icon format
    └── src/
        ├── main.rs                # Windows EXE binary entry point
        └── lib.rs                 # Initializes Tauri window and web bridge
```

---

## 3. From Web to Desktop: Setting Up Tauri

### Step 1: Install Tauri CLI
Install the official Tauri CLI dependency:
```bash
npm install -D @tauri-apps/cli@latest
```
Add convenience scripts to `package.json`:
```json
"scripts": {
  "tauri": "tauri"
}
```

### Step 2: Initialize `src-tauri` Directory
Create `src-tauri/` containing `Cargo.toml`, `tauri.conf.json`, `build.rs`, and the `src/` folder.

### Step 3: Link Frontend Build Path
In `tauri.conf.json`, configure `frontendDist` to point to `../dist`. This instructs the Tauri bundler where to retrieve HTML and JS assets.

---

## 4. Configuration Files & Code Deep Dive

### 1. `src-tauri/Cargo.toml` (Rust Dependencies)
```toml
[package]
name = "cable-optimizer"
version = "1.0.0"
edition = "2021"

[lib]
name = "cable_optimizer"          # Library name referenced by main.rs
path = "src/lib.rs"

[build-dependencies]
tauri-build = { version = "2.0.0" } # Build hook: embeds icons and manifests at compile time

[dependencies]
tauri = { version = "2.0.0" }       # Core Tauri desktop runtime
serde = { version = "1.0" }         # Serialization support
serde_json = "1.0"
```

### 2. `src-tauri/src/main.rs` (EXE Entry Point)
```rust
// Hides the black terminal console window in Windows release mode
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Invoke run() in lib.rs to start the desktop app
    cable_optimizer::run();
}
```

### 3. `src-tauri/src/lib.rs` (Runtime Bridge)
```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 4. `src-tauri/tauri.conf.json` (Desktop App Configuration)
```json
{
  "$schema": "https://schema.tauri.app/config/2.json",
  "productName": "CableOptimizer",      // Generated binary name: CableOptimizer.exe
  "version": "1.0.0",
  "identifier": "com.cable.optimizer",  // Unique application bundle ID
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build", // Compiles frontend before building EXE
    "devUrl": "http://localhost:3000",
    "frontendDist": "../dist"              // Loads static assets from dist/
  },
  "app": {
    "windows": [
      {
        "title": "Minimum Bounding Circle Visual Solver", // Window title
        "width": 1280,
        "height": 800,
        "resizable": true,
        "center": true                       // Center window on launch
      }
    ]
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/icon.ico"                      // Windows desktop icon
    ]
  }
}
```

---

## 5. Windows Icon System & RC.EXE Compilation

### 1. Why You Cannot Simply Rename a PNG to `.ico`
When compiling a Windows executable, the Windows SDK invokes **`RC.EXE`** (Resource Compiler).  
`RC.EXE` parses the binary structure:
- First 6 bytes: **ICO Header** (reserved, image type 0x01, image count).
- Every 16 bytes thereafter: **Icon Directory Entry** (dimensions, color depth, data offset).  
Simply renaming `icon.png` to `icon.ico` will trigger a fatal compiler error:
```text
called `Result::unwrap()` on an `Err` value: Failed("RC.EXE failed to compile specified resource file")
```

### 2. Standard Generation Command
Generate the complete multi-resolution icon family from the vector source (`app-icon.svg`):
```bash
npx tauri icon app-icon.svg
```
This generates valid icons with dimensions `16x16`, `24x24`, `32x32`, `48x48`, `64x64`, and `256x256`.

---

## 6. GitHub Actions CI/CD Cloud Packaging

Without any local C++ or Rust compilers installed, `.github/workflows/release.yml` uses GitHub's hosted runners to compile the release binary.

### Pipeline Execution Order:
```text
[ Git Push / Manual Workflow Dispatch ]
                 │
                 ▼
     [ 1. Launch Windows Server Runner ]
                 │
                 ▼
     [ 2. Checkout Repository (v4) ]
                 │
                 ▼
     [ 3. Setup Node.js 22 + Rust Stable ]
                 │
                 ▼
     [ 4. npm install & npm run build (dist/) ]
                 │
                 ▼
     [ 5. npx tauri build (CableOptimizer.exe) ]
                 │
                 ▼
     [ 6. upload-artifact@v4 (Downloadable ZIP) ]
```

### Workflow Configuration (`.github/workflows/release.yml`):
```yaml
name: 'Publish Tauri App'

on:
  workflow_dispatch:   # Trigger manually via GitHub Actions tab
  push:
    branches: [ main, master ]
    tags: [ 'v*' ]

jobs:
  publish-tauri:
    permissions:
      contents: write
    runs-on: windows-latest  # Windows runner

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Setup Rust toolchain
        uses: dtolnay/rust-toolchain@stable

      - name: Install dependencies and build frontend
        run: |
          npm install
          npm run build

      - name: Build Tauri desktop application (.exe)
        run: npx tauri build

      - name: Upload .exe build artifact
        uses: actions/upload-artifact@v4
        with:
          name: CableOptimizer-Windows-exe
          path: |
            src-tauri/target/release/CableOptimizer.exe
            src-tauri/target/release/bundle/msi/*.msi
            src-tauri/target/release/bundle/nsis/*.exe
```

---

## 7. Frequently Asked Questions (FAQ)

### Q1: Why did a black console terminal window flash or appear when opening the `.exe`?
**Answer**: Rust compiles console applications by default. You must declare the following attribute at the top of `src-tauri/src/main.rs`:
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
```
This instructs Windows to run the application without a console window in release mode.

### Q2: Why does Windows SmartScreen warn when downloading the `.exe`?
**Answer**: Open-source binaries without commercial EV code-signing certificates trigger SmartScreen alerts by default.
- **To run**: Click "More info" $\rightarrow$ "Run anyway".
- **Distribution tip**: Distribute the executable inside a `.zip` archive to prevent browser blocking.

### Q3: Why is no local Rust or Visual Studio installation required?
**Answer**: All compilation steps (`rustc`, `cargo`, `RC.EXE`, MSVC linkers) execute automatically inside the GitHub Actions cloud runner container.
