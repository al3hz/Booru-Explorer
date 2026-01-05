# Booru Explorer

An image explorer for Danbooru built with Vue 3 and Vite.

## Features

- **Advanced Search**: Search for images using Danbooru tags with autocomplete and smart filters.
- **Responsive Gallery**: Masonry layout with Infinite Scroll, progressive image loading, and Masonry mode toggle.
- **Immersive Details**: Enhanced modal with zoom/pan support (mobile), swipe navigation, and keyboard shortcuts.
- **Pools & Collections**: Browse organized collections of posts, comics, and doujinshi series with improved UI.
- **Community Integration**: View post comments and artist commentary.
- **Wiki System**: Integrated Danbooru wiki browsing with internal navigation.
- **Performance**: Optimized rendering, lazy loading, and intelligent background video handling.
- **Code Quality**: Robust ESLint configuration for Vue 3 and Node.js.
- **Modern Design**: Clean interface with dark mode, glassmorphism, and smooth transitions.

## Technologies Used

- [Vue 3](https://vuejs.org/) - Progressive JavaScript framework.
- [Vite](https://vitejs.dev/) - Fast compilation tool.
- [Lineicons](https://lineicons.com/) - Icon pack.

## Installation

1.  Clone the repository:
```bash
git clone https://github.com/al3hz/Booru-Explorer.git
cd Booru-Explorer
```

2.  Install dependencies:
```bash
npm install
```

## Usage

To start the development server:

```bash
npm run dev
```

To build for production:

```bash
npm run build
```

### Linting

To run the linter (ESLint) and check for code quality issues:

```bash
npm run lint
```

## Project Structure

- `src/components`: Vue components (Search, Gallery, Modal, Footer).
- `src/styles`: Global styles.
- `src/App.vue`: Root component.
- `src/main.js`: Application entry point.

## Versioning

This project uses [Semantic Versioning](https://semver.org/). 

📖 **[View Versioning Guide](VERSIONING.md)** - Learn how to update the app version automatically.

## Credits

- API provided by [Danbooru](https://danbooru.donmai.us/).
- Icons by [Lineicons](https://lineicons.com/).
