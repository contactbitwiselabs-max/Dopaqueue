# DopaQueue

A privacy-first, local-first Chrome extension that gamifies your productivity. Save videos for later, manage your dopamine budget, and reclaim your focus.

## How to Install and Test the Extension

1. Open **Google Chrome** and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in the top right corner).
3. Click the **Load unpacked** button.
4. Select the `dist/` directory located inside the `extension/` folder on your computer.
   - **Path:** `C:\Users\AMAAN\Desktop\Dopaqueue\extension\dist`
   - **IMPORTANT:** Do NOT select the `extension/` folder directly. You must select the `dist/` folder, which contains the compiled React build.

## How to Develop

### Chrome Extension (`/extension`)
The extension is built with React, Vite, and Tailwind CSS.
```bash
cd extension
npm run dev
# Vite will automatically recompile into the /dist folder on save.
```

### Web Landing Page (`/landing`)
The landing page is a Next.js application.
```bash
cd landing
npm run dev
# The landing page will run on http://localhost:3000
```
