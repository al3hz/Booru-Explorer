# 🔢 Automatic Versioning System

## How does it work?

The application version is automatically read from `package.json` and displayed in the header.

## 📝 How to update the version

### Option 1: NPM Scripts (Recommended)

```bash
# For MINOR changes (bugs, minor adjustments)
# 1.2.0 → 1.2.1
npm run version:patch

# For MEDIUM changes (new features)
# 1.2.0 → 1.3.0
npm run version:minor

# For MAJOR changes (breaking changes, redesigns)
# 1.2.0 → 2.0.0
npm run version:major
```

### Option 2: Direct NPM command

```bash
npm version patch   # 1.2.0 → 1.2.1
npm version minor   # 1.2.0 → 1.3.0
npm version major   # 1.2.0 → 2.0.0
```

### Option 3: Manual

Edit `package.json` and change the `“version”` field:
```json
{
  “version”: “1.3.0”
}
```

## 🎯 Semantic Versioning (SemVer)

Format: `MAJOR.MINOR.PATCH`

- **MAJOR** (1.x.x → 2.x.x): Incompatible changes, complete redesigns
- **MINOR** (x.1.x → x.2.x): New compatible features
- **PATCH** (x.x.1 → x.x.2): Bug fixes, minor adjustments

## 📋 Examples of when to use each type

### PATCH (1.2.0 → 1.2.1)
- ✅ Bug fixes
- ✅ CSS/design adjustments
- ✅ Performance optimizations
- ✅ Typo corrections

### MINOR (1.2.0 → 1.3.0)
- ✅ New functionality (e.g., reverse search)
- ✅ New component
- ✅ Significant UX improvement
- ✅ New page/view

### MAJOR (1.2.0 → 2.0.0)
- ✅ Complete redesign
- ✅ Changes that break compatibility
- ✅ Migration to new technology
- ✅ Fundamental change