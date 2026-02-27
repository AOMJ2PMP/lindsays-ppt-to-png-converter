# SlideExport - PPTX to PNG Converter

## Overview
A web application that converts PowerPoint (PPTX/PPT) files into high-quality, lossless PNG images. Each slide is exported as an individual PNG with no compression.

## Features
- Drag-and-drop or click-to-upload interface for .pptx and .ppt files
- High-quality, lossless PNG conversion using LibreOffice headless
- Slide gallery with thumbnail preview and lightbox viewer
- Download individual slides or all slides as a ZIP archive
- Progress indicator during conversion
- Up to 200 MB file size support

## Architecture

### Frontend (`client/src/`)
- `pages/home.tsx` - Main single-page app with upload, progress, gallery, and lightbox
- `App.tsx` - Router setup

### Backend (`server/`)
- `routes.ts` - API endpoints:
  - `POST /api/convert` - Accepts multipart PPTX, converts to PNGs, returns session data
  - `GET /api/slides/:sessionId/:filename` - Serves individual PNG images
  - `GET /api/download-all/:sessionId` - Returns ZIP of all slides

## Conversion Pipeline
1. User uploads PPTX via browser
2. Backend saves to temp dir and runs LibreOffice headless (`soffice --convert-to png`)
3. Generated PNGs stored in session temp dir (`/tmp/pptx-converter-sessions/<sessionId>/`)
4. Sessions auto-cleaned up after 2 hours
5. Images served directly via Express static route

## Dependencies
- **LibreOffice** (system): PPTX to PNG conversion
- **multer**: Multipart file upload handling
- **archiver**: ZIP creation for batch download
- LibreOffice path: `/nix/store/j261ykwr6mxvai0v22sa9y6w421p30ay-libreoffice-7.6.7.2-wrapped/bin/soffice`

## Stack
- Node.js + Express backend
- React + TypeScript frontend
- Vite dev server
- TailwindCSS + shadcn/ui components
- No database required (stateless conversion)
