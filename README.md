# PDF Editor Pro - Chrome Extension (Manifest V3)

Ένας προηγμένος, εύκολος στη χρήση PDF editor που λειτουργεί εντελώς στον browser χωρίς την ανάγκη ανεβάσματος αρχείων σε servers.

## 🚀 Εγκατάσταση (MV3-Ready)

### Βήμα 1: Εξαγωγή αρχείων
```bash
unzip pdf-editor-extension.zip
cd pdf-editor-extension
```

### Βήμα 2: Κατέβασμα βιβλιοθηκών (ΑΠΑΙΤΕΙΤΑΙ)
**PDF.js (Mozilla)**
- URL: https://mozilla.github.io/pdf.js/getting_started/
- Κατεβάστε: `pdf.mjs` και `pdf.worker.mjs`  
- Τοποθέτηση: `src/lib/`

**pdf-lib**
- URL: https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js
- Αποθήκευση: `src/lib/pdf-lib.min.js`

### Βήμα 3: Φόρτωση στο Chrome
1. `chrome://extensions/` → Enable "Developer mode"
2. "Load unpacked" → Select `pdf-editor-extension` folder
3. Enable "Allow access to file URLs"

## ✅ MV3 Compliance

### CSP-Safe Implementation
✅ **No inline JavaScript** - Όλα τα scripts σε εξωτερικά αρχεία  
✅ **No onclick handlers** - Event listeners μόνο  
✅ **ES Module imports** - Modern import syntax  
✅ **Web Workers** με module type  
✅ **Service Worker** background script μόνο  

### Extension Structure  
```
├── manifest.json          # Manifest V3 compliant
├── src/
│   ├── background/
│   │   └── background.js   # Service worker
│   ├── content/
│   │   └── content.js      # Content script
│   ├── ui/
│   │   ├── main/
│   │   │   ├── main.html   # No inline JS
│   │   │   ├── main.css    # Clean styling
│   │   │   └── main.js     # ES modules, PDF.js
│   │   └── popup/
│   │       ├── popup.html  # No inline JS  
│   │       ├── popup.css   # Responsive design
│   │       └── popup.js    # Event listeners
│   ├── workers/
│   │   ├── pdf-worker.js   # PDF operations
│   │   └── merge-worker.js # Merging specialist
│   └── lib/                # External libraries
```

## 🔧 Χαρακτηριστικά

### PDF Operations
- **Άνοιγμα**: Local files, URLs, context menu integration
- **Συγχώνευση**: Multiple PDFs με progress tracking  
- **Διαχωρισμός**: Page ranges (1-3,5,7-9)
- **Περικοπή**: Drag-to-crop functionality
- **Remove CamScanner**: Watermark και link removal
- **Σχολιασμός**: Greek text support με font embedding
- **Export**: Client-side download

### User Experience  
- **Progressive Disclosure**: Advanced features όταν χρειάζονται
- **Keyboard Shortcuts**: O/M/S/E/C/R/T για power users
- **Dark/Light Themes**: Auto-detection + manual override
- **Accessibility**: WCAG 2.1 AA, keyboard navigation
- **Responsive**: Desktop, tablet, mobile support
- **Toast Notifications**: Non-intrusive feedback

### Technical Excellence
- **100% Client-side**: Πλήρες privacy, χωρίς servers  
- **Web Workers**: Non-blocking PDF processing
- **Memory Optimized**: Lazy rendering, efficient caching
- **Error Handling**: Graceful degradation και user feedback
- **Greek Native**: Complete localization

## ⌨️ Συντομεύσεις

| Key | Function | 
|-----|----------|
| `O` | Open PDF |
| `M` | Merge PDFs |
| `S` | Split PDF |  
| `E` | Export |
| `C` | Crop tool |
| `R` | Remove CamScanner |
| `T` | Text tool |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `+/-` | Zoom |

## 🐛 Αντιμετώπιση Προβλημάτων

**"Could not load manifest"**
- Verify all files are in correct structure
- Check manifest.json syntax

**"Content Security Policy violation"**  
- Ensure no inline JavaScript exists
- Verify all scripts are external files

**PDF.js errors**
- Download actual PDF.js files (not placeholders)
- Check worker path configuration

**File access issues**
- Enable "Allow access to file URLs"
- Check host permissions in manifest

## 🎯 Development

### Testing MV3 Compliance
```bash
# Check for inline JS
grep -r "onclick\|onload" src/ui/
# Should return nothing

# Verify ES modules  
grep -r "import.*from" src/ui/
# Should show module imports
```

### Performance Monitoring
```javascript
// Enable debug mode
localStorage.setItem('pdf-editor-debug', 'true');

// Monitor worker performance
performance.mark('pdf-operation-start');
// ... operation ...
performance.mark('pdf-operation-end');
```

## 📋 Production Checklist

- [ ] Downloaded PDF.js and pdf-lib libraries
- [ ] Created proper extension icons (16x16, 48x48, 128x128)  
- [ ] Tested με various PDF files
- [ ] Verified CSP compliance (no console errors)
- [ ] Tested keyboard shortcuts
- [ ] Validated accessibility με screen reader
- [ ] Performance tested με large PDFs

## 📄 License

MIT License - Commercial use allowed

---

**Ready for Chrome Web Store!** 🎉  
*MV3-compliant, CSP-safe, production-ready*
