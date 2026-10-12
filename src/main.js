// Boot: register rooms (tolerating ones that don't exist yet), init the engine, then title or ?room=.
import { Game } from './engine/Game.js';

// Order matters: the first registered real room is the title-screen background fallback.
const ROOM_MODULES = [
  './rooms/room1/index.js',
  './rooms/room2/index.js',
  './rooms/room3/index.js',
  './rooms/ending/index.js',
  './rooms/_test/index.js',
];

async function loadRooms() {
  const results = await Promise.all(ROOM_MODULES.map(async (path) => {
    try {
      const mod = await import(path);
      return mod.default || Object.values(mod).find((v) => typeof v === 'function' && v.id);
    } catch (e) {
      // A missing room is normal during development; a broken one is not.
      if (!/Failed to fetch|Importing a module script failed|error loading dynamically imported module|404/i.test(e.message)) {
        console.error(`[main] failed to load ${path}`, e);
      }
      return null;
    }
  }));
  return results.filter(Boolean);
}

const rooms = await loadRooms();
const game = new Game({ rooms, startRoom: 'room1' });
await game.init();
await game.boot();
