# Minimum Bounding Circle Visual Solver (CableOptimizer)

[English](README.md) | [简体中文](README_zh.md)

[![Live Web App](https://img.shields.io/badge/Live_Web_App-remix--studio-4285F4?logo=google-cloud&logoColor=white)](https://remix-studio-8856-789804289393.us-west1.run.app)
[![GitHub Release](https://img.shields.io/github/v/release/hebaizhong-del/Minimum-Bounding-Circle-Visual-Solver?color=success&logo=github&label=Release)](https://github.com/hebaizhong-del/Minimum-Bounding-Circle-Visual-Solver/releases)
[![Download Windows App](https://img.shields.io/badge/Download-Windows_.exe-0078D6?logo=windows&logoColor=white)](https://github.com/hebaizhong-del/Minimum-Bounding-Circle-Visual-Solver/releases/latest)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tauri](https://img.shields.io/badge/Tauri-v2-24C8DB?logo=tauri&logoColor=white)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-2021_Edition-dea584?logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

> ### 🌟 Official Deployments & Downloads
> 
> - 🌐 **Live Web Application (Browser Instant Access)**:  
>   👉 **[https://remix-studio-8856-789804289393.us-west1.run.app](https://remix-studio-8856-789804289393.us-west1.run.app)**  
>   *Instant access in any modern browser on desktop or mobile — zero installation required.*
> 
> - 🖥️ **Standalone Desktop App (Windows .exe)**:  
>   👉 **[Download CableOptimizer v1.0.0 for Windows (.exe)](https://github.com/hebaizhong-del/Minimum-Bounding-Circle-Visual-Solver/releases/tag/v1.0.0)**  
>   *Portable single-file executable (~15 MB) built with Tauri v2. Offline execution, zero runtime dependencies.*  
>   🔗 All release packages: **[GitHub Releases Page](https://github.com/hebaizhong-del/Minimum-Bounding-Circle-Visual-Solver/releases)**

---

An interactive, high-performance visual optimizer and solver for the **Minimum Bounding / Enclosing Circle Packing Problem**. Designed for cable core layout design, cylindrical container packing, cross-sectional geometry analysis, and geometric optimization.

---

## 📌 Overview

Packing circles of equal or varying radii inside the smallest possible enclosing circle is a classic NP-hard computational geometry challenge. **CableOptimizer** combines numerical gradient optimization, analytical geometric solvers, and interactive direct manipulation to deliver:

1. **Global Multi-Start Optimization**: Explores symmetric and free configurations to find the minimal bounding radius $R$.
2. **Interactive Physics & Layout Refinement**: Allows users to drag any circle directly on the canvas; other circles react dynamically via collision relaxation, followed by automatic local L-BFGS compacting upon release.
3. **Engineering Export Utilities**: One-click export to vector SVG, high-resolution PNG (1200×1200), and CSV coordinate tables.
4. **Dual Deployment Modes**: Runs instantly in modern web browsers or as a lightweight, native Windows desktop executable ($<15\,\text{MB}$) powered by **Tauri v2**.

---

## 🚀 Key Features

- **Flexible Input Modes**: Accepts comma-separated values in either **Radius ($R$)** or **Diameter ($D$)** format.
- **Built-in Presets**:
  - `3 Large + 5 Small` (`10, 10, 10, 4, 4, 4, 4, 4`)
  - `7 Equal Circles` (`10, 10, 10, 10, 10, 10, 10`)
  - `8 Decreasing` (`12, 10, 8, 6, 5, 4, 3, 2`)
  - `12 Unequal` (`12, 10, 8, 6, 5, 4, 3, 2, 10, 8, 6, 2`)
  - `32 Unequal` (Complex multi-tier mixed-diameter layout)
- **Mathematical Optimization Engine**:
  - **L-BFGS (Limited-memory Broyden–Fletcher–Goldfarb–Shanno)** numerical solver for smooth constraint relaxation.
  - **Problem of Apollonius** exact algebraic solver for finding tangent bounding circles for 3-circle clusters.
  - **Symmetry Mode Discovery**: Automatically evaluates **Rotational Symmetry ($C_k$)**, **Dihedral Symmetry ($D_k$)**, **Mirror Symmetry**, and **Free Packing**.
- **Interactive Canvas UI**:
  - Pan (drag background) and zoom (mouse wheel / floating controls).
  - Drag-and-drop circles with real-time collision displacement.
  - Dynamic expanding bounding circle with coordinate grid overlays.
- **Data & Metric Inspection**:
  - Minimum Enclosing Radius $R$.
  - Packing Density (Area utilization percentage).
  - Total circle count and optimal symmetry classification.
  - Full coordinate inspection table (Index, Radius, Center $X$, Center $Y$, Cluster Group).

---

## 📐 Mathematical Formulation

### 1. Objective Function
Given $N$ circles with radii $r_1, r_2, \dots, r_N$ and center coordinates $(x_i, y_i)$, find the center $(X, Y)$ and radius $R$ of the bounding circle minimizing $R$:

$$\min R$$

Subject to:
1. **Enclosing Constraint**:
   $$\sqrt{(x_i - X)^2 + (y_i - Y)^2} + r_i \le R, \quad \forall i \in \{1, \dots, N\}$$
2. **Non-Overlapping Constraint**:
   $$\sqrt{(x_i - x_j)^2 + (y_i - y_j)^2} \ge r_i + r_j, \quad \forall 1 \le i < j \le N$$

### 2. Penalty Function & L-BFGS Solver
The constrained problem is converted into an unconstrained energy minimization formulation with quadratic violation penalties:

$$E(p, R_c) = \sum_{i=1}^{N} \max(0, d_i + r_i - R_c)^2 + \sum_{1 \le i < j \le N} \max(0, (r_i + r_j) - d_{ij})^2$$

where $d_i = \sqrt{x_i^2 + y_i^2}$ and $d_{ij} = \sqrt{(x_i - x_j)^2 + (y_i - y_j)^2}$. The gradient $\nabla_p E$ is computed analytically to drive the L-BFGS optimizer.

---

## 🛠 Project Structure

```text
cable-design-app/
├── index.html                   # Application entry point with responsive UI
├── css/
│   └── style.css                # Clean system-UI typography and layout styles
├── js/
│   ├── aicable.src.js           # Clean, unminified source code of the solver & UI
│   └── aicable.js               # Production obfuscated runtime script
├── public/
│   ├── js/aicable.js            # Public distribution script
│   ├── favicon.ico
│   └── icon.png
├── scripts/
│   ├── generate_icons.js        # Script to generate multi-resolution icon assets
│   └── obfuscate.js             # JavaScript obfuscation pipeline script
├── src-tauri/                   # Tauri v2 native desktop project
│   ├── Cargo.toml               # Rust dependencies (tauri, serde)
│   ├── tauri.conf.json          # Desktop window and packaging configuration
│   ├── build.rs                 # Resource build script
│   ├── icons/                   # Multi-resolution desktop icons (Windows .ico, macOS .icns)
│   └── src/
│       ├── main.rs              # Windows entry point with hidden console subsystem
│       └── lib.rs               # Tauri webview runtime bridge
├── .github/
│   └── workflows/
│       └── release.yml          # GitHub Actions CI/CD for automated Windows .exe releases
├── TAURI_GUIDE.md               # Technical tutorial on Tauri v2 desktop integration
├── package.json
└── vite.config.js
```

---

## 💻 Getting Started

### 🌐 Direct Online Access (No Installation)
Try the fully featured visual solver directly in your web browser:  
👉 **[Open Live Web App](https://remix-studio-8856-789804289393.us-west1.run.app)** (`https://remix-studio-8856-789804289393.us-west1.run.app`)

### Prerequisites (For Local Development)
- [Node.js](https://nodejs.org/) (version 18+ recommended)
- `npm` or `pnpm` / `yarn`
- *(Optional for desktop builds)* [Rust](https://www.rust-lang.org/) stable toolchain

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/your-username/cable-optimizer.git
cd cable-optimizer
npm install
```

### 2. Run Web Development Server
Start Vite local dev server on port `3000`:
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:3000`.

### 3. Build for Web Production
To obfuscate the solver source and build the optimized static distribution (`dist/`):
```bash
npm run build
```

---

## 🖥️ Desktop Application (Tauri v2)

### 📥 Download Pre-built Windows App (Ready to Run)
The standalone Windows desktop binary is officially released on GitHub!
- 🔗 **Release Page**: [CableOptimizer Releases (GitHub)](https://github.com/hebaizhong-del/Minimum-Bounding-Circle-Visual-Solver/releases)
- 💾 **Direct Release Tag**: [CableOptimizer v1.0.0](https://github.com/hebaizhong-del/Minimum-Bounding-Circle-Visual-Solver/releases/tag/v1.0.0)
- 🪟 **Executable**: `CableOptimizer.exe` (Standalone portable binary, ~15 MB)
- ⚡ **Features**: Fast startup (<50ms), native offline execution, low memory footprint (~30 MB RAM), bundled WebView2 rendering.

### Local Desktop Development
To test the desktop app locally:
```bash
npm run tauri dev
```

### Local Desktop Compilation
To build the native standalone installer or executable:
```bash
npm run tauri build
```
The compiled output will be generated in:
```text
src-tauri/target/release/CableOptimizer.exe
```

### Automated Cloud Builds via GitHub Actions
The repository includes `.github/workflows/release.yml`. When you push code or trigger `workflow_dispatch` on GitHub:
1. Spins up a `windows-latest` VM runner.
2. Sets up Node.js 22 and the Rust stable compiler.
3. Automatically generates the full icon set (`app-icon.svg` $\rightarrow$ `.ico`).
4. Compiles `CableOptimizer.exe` and packages it into a downloadable artifact or GitHub Release.

For an in-depth architectural guide, check out [TAURI_GUIDE.md](./TAURI_GUIDE.md).

---

## 📊 Exporting Results

| Format | Output File | Description |
| :--- | :--- | :--- |
| **Vector SVG** | `circle_packing_layout.svg` | Infinite resolution scalable vector graphic with coordinate layers and colored cluster groups. |
| **Raster PNG** | `circle_packing_layout.png` | Clean 1200×1200 pixel raster rendering with white background suitable for presentations and technical reports. |
| **CSV Table** | `circle_positions.csv` | Comma-separated table including `Index`, `Radius`, `CenterX`, `CenterY`, and `Group`. |

---

## 📄 License

This project is licensed under the [Apache 2.0 License](LICENSE).
