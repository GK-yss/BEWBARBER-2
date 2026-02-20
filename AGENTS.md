# AGENTS.md - BEW Barber Booking System

## Project Overview
This is a Google Apps Script project for a barber shop booking system. It consists of:
- **Backend**: `รหัส.js` - Google Apps Script (server-side)
- **Frontend**: `index.html` - React 18 + Tailwind CSS (client-side, served via HtmlService)

## Build / Test Commands

### Running the Application
This is a Google Apps Script project - there is no traditional build process.

```bash
# Deploy via Google Apps Script CLI (clasp) if installed
clasp push      # Push local code to Google Apps Script
clasp deploy    # Deploy as web app

# If no test framework is set up, npm test does nothing
npm test        # Outputs: "Error: no test specified"
```

### Single Test
No test framework is configured. Tests would need to be added (e.g., Jest for any utility functions).

### Linting
No ESLint or other linter is configured.

---

## Code Style Guidelines

### General Conventions
- **Language**: Thai (for user-facing text) and English (for code/technical terms)
- **JavaScript Version**: ES5/ES6 (Google Apps Script supports modern JS but the codebase uses `var`)
- **File Encoding**: UTF-8 (required for Thai characters)

### Naming Conventions
- **Files**: Use descriptive English names (e.g., `รหัส.js` contains Thai characters but is an exception)
- **Variables**: Use camelCase (e.g., `bookingSheet`, `shopStatus`)
- **Constants**: Use UPPER_SNAKE_CASE (e.g., `SHEET_ID`, `FOLDER_ID`)
- **Functions**: Use camelCase (e.g., `handleRequest`, `saveSettingValue`)
- **Google Apps Script functions**: `doGet`, `doPost` must remain as-is

### Formatting
- **Indentation**: 2 spaces
- **Line length**: No strict limit, but keep functions reasonably sized
- **Braces**: Same-line opening brace (JavaScript default)
- **Semicolons**: Always use semicolons

### Code Structure (Backend - รหัส.js)
```javascript
// --- CONFIGURATION ---
var SHEET_ID = "...";
var FOLDER_ID = "...";

// Entry points
function doGet(e) { ... }
function doPost(e) { ... }

// Request handlers
function handleRequest(e) { ... }

// Helper functions
function saveSettingValue(sheet, key, value) { ... }
function initSheets() { ... }
function responseJSON(data) { ... }
```

### HTML/React (index.html)
- Use functional components with hooks (`useState`, `useEffect`, `useCallback`, `useMemo`)
- Inline SVG icons using the `IconBase` pattern shown in the file
- Tailwind CSS classes for styling
- Use `className` (React convention), not `class`
- Use `onChange`, `onSubmit` with handler functions

### Error Handling
- Use try-catch-finally blocks for critical operations
- Always release locks in `finally` block
- Return JSON responses with `{ result: "error", message: "..." }` format
- Use meaningful error messages (Thai language for user-facing errors)

### Google Apps Script Specific
- Always use `LockService` for concurrent request handling
- Use `ContentService` for JSON responses
- Use `HtmlService` for web serving
- Format dates with `Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd")`
- Use base64 encoding for file uploads: `Utilities.base64Decode()`

### Imports / Dependencies
- Backend: No npm imports (Google Apps Script built-in only)
- Frontend: CDN-loaded (React 18, ReactDOM 18, Babel standalone, Tailwind CSS)
- Google Apps Script types: `@types/google-apps-script` (devDependency)

### Best Practices
1. **Lock concurrency**: Always use `LockService.getScriptLock()` with tryLock
2. **Initialize on demand**: Call `initSheets()` to ensure sheets exist
3. **Input validation**: Check `e.parameter` existence before accessing
4. **JSON responses**: Always use `responseJSON()` helper for consistent output
5. **Drive sharing**: Set file permissions explicitly after upload

### What NOT to Do
- Do not use `const`/`let` in รหัส.js (maintain consistency with existing `var` usage)
- Do not add server-side logic that requires Node.js modules
- Do not commit API keys or credentials to the repository
- Do not make assumptions about column indices - document them in comments

### Deployment
The app is deployed as a Web App via Google Apps Script:
- Execute as: `Me`
- Who has access: `Anyone`
- URL is hardcoded in index.html (`FIXED_SCRIPT_URL`)

---

## Project File Structure
```
BEW/
├── รหัส.js           # Google Apps Script backend
├── index.html        # React frontend
├── package.json      # NPM config (minimal)
└── node_modules/    # Dependencies (@types/google-apps-script)
```

## Configuration
Edit these constants at the top of `รหัส.js`:
- `SHEET_ID` - Google Sheets ID for bookings
- `FOLDER_ID` - Google Drive folder ID for images
- `SHEET_NAME_BOOKINGS` - Booking sheet name
- `SHEET_NAME_SETTINGS` - Settings sheet name
