# Booru Explorer

An image explorer for Danbooru built with Vue 3 and Vite.

## Features

- **Smart Search (Advanced Tag Bypass)**: Allows searching with **more than 2 content tags** (overcoming Danbooru's limit for free users) using an intelligent "Oversample & Filter" strategy.
- **Sequential Smart Loading**: Optimized scanning that fetches API pages **sequentially** (1 by 1) to ensure 100% accurate temporal ordering and strictly respect tag limits, fixing "old posts" issues.
- **Multi-Rating Selection**: Powerful rating filter that supports **complex combinations** (e.g., "General" AND "Safe") by automatically generating advanced boolean queries.
- **Aggressive "Zero-Latency" Freshness**: Implements a "Nuclear" cache busting strategy (timestamped requests + `no-store`) to ensure you **always** interact with the absolute latest data from Danbooru, bypassing all browser/proxy caches.
- **Super Pagination**: Support for custom result limits **above 100**, automatically aggregating multiple API calls into a single seamless gallery.
- **Enhanced Search Tools**: Dedicated "Extra" actions for Likes, Favs, Deleted, and Trending posts, with integrated **time-range filters** (Day, Week, Month, Year, All Time).
- **Advanced Navigation Views**:
  - **Pools Explorer**: Browse and search through Danbooru Pools with specialized layout.
  - **Comments System**: Integrated view for post comments and artist commentaries.
  - **Wiki Integration**: Full browsing of Danbooru Wiki pages with internal navigation.
- **Intelligent Metadata & Analytics**:
  - **Artist Profiling**: Detailed information, URLs, and specialized commentary.
  - **Rating Counts**: Real-time statistics of post ratings (General, Safe, etc.) that intelligently ignore current filters to give accurate global counts.
- **Responsive Masonry Gallery**: High-performance layout with progressive pre-loading, infinite scroll, and a dedicated Masonry mode toggle.
- **Stable Pagination & Persistence**: Intelligent UI controls that maintain 100% synchronization with the URL state, allowing for bookmarkable searches and filters.
- **Enhanced Immersive Details**: Advanced modal with zoom/pan, keyboard shortcuts (A/D/Arrow Keys), and improved VideoPlayer with auto-rotation.
- **Safety & Performance**: Default filtering for `status:active` and a Vercel-hosted proxy with strict `no-store` headers for maximum speed and freshness.

## Technologies Used

- [Vue 3](https://vuejs.org/) - Progressive JavaScript framework.
- [Vite](https://vitejs.dev/) - Next generation frontend tooling.
- [@tanstack/vue-query](https://tanstack.com/query/latest/docs/framework/vue/overview) - Powerful asynchronous state management.
- [Vue Router 4](https://router.vuejs.org/) - Official router for Vue.js.
- [Lineicons](https://lineicons.com/) - Modern and clean icon set.

## Project Structure

- `api/`: Vercel Serverless Functions acting as a secure, optimized API proxy.
- `src/views/`: Main page components (Home, Pools, PoolDetail, Wiki, Comments).
- `src/components/`: Reusable Vue components (SearchForm, PostGallery, ImageDetailModal, etc.).
- `src/composables/`: Modular logic units (API management, Autocomplete, Layout state).
- `src/services/`: Centralized `DanbooruService` for all API communications.
- `src/styles/`: Global CSS design system and theme definitions.
- `src/main.js`: Application entry point and plugin initialization.

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

## Versioning

This project uses [Semantic Versioning](https://semver.org/). 

📖 **[View Versioning Guide](VERSIONING.md)** - Learn how to update the app version automatically.

## Credits

- API provided by [Danbooru](https://danbooru.donmai.us/).
- Icons by [Lineicons](https://lineicons.com/).
