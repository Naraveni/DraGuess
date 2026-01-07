
/**
 * Note: In a real production app, you would use actual Firebase credentials.
 * For this environment, we assume the Firebase SDK is available via standard imports.
 * Since we can't connect to a real project without keys, this file exports a mock
 * that uses LocalStorage to simulate the persistence and event emitters for realtime.
 */

// This is a "Mock Firebase" to make the app runnable in the preview.
// In a real project, replace this with actual firebase/app and firebase/firestore.

type Listener = (data: any) => void;
const listeners: Record<string, Set<Listener>> = {};

const mockDb: Record<string, any> = JSON.parse(localStorage.getItem('scribble_db') || '{}');

const persist = () => {
  localStorage.setItem('scribble_db', JSON.stringify(mockDb));
};

export const db = {
  collection: (path: string) => ({
    doc: (id?: string) => {
      const docId = id || Math.random().toString(36).substring(7);
      const docPath = `${path}/${docId}`;
      return {
        id: docId,
        set: (data: any, options?: { merge?: boolean }) => {
          const oldData = mockDb[docPath] || {};
          mockDb[docPath] = options?.merge ? { ...oldData, ...data } : data;
          persist();
          listeners[docPath]?.forEach(l => l(mockDb[docPath]));
          // Notify collection listeners
          listeners[path]?.forEach(l => l(mockDb));
          return Promise.resolve();
        },
        update: (data: any) => {
          mockDb[docPath] = { ...(mockDb[docPath] || {}), ...data };
          persist();
          listeners[docPath]?.forEach(l => l(mockDb[docPath]));
          return Promise.resolve();
        },
        get: () => Promise.resolve({ exists: !!mockDb[docPath], data: () => mockDb[docPath], id: docId }),
        onSnapshot: (callback: Listener) => {
          if (!listeners[docPath]) listeners[docPath] = new Set();
          listeners[docPath].add(callback);
          callback(mockDb[docPath]);
          return () => listeners[docPath].delete(callback);
        },
        delete: () => {
          delete mockDb[docPath];
          persist();
          listeners[docPath]?.forEach(l => l(null));
          return Promise.resolve();
        },
        collection: (subPath: string) => db.collection(`${docPath}/${subPath}`)
      };
    },
    where: (field: string, op: string, val: any) => {
        // Simple mock filtering
        return db.collection(path);
    },
    orderBy: (field: string, dir?: string) => db.collection(path),
    limit: (n: number) => db.collection(path),
    get: () => {
      const docs = Object.keys(mockDb)
        .filter(k => k.startsWith(path) && k.split('/').length === path.split('/').length + 1)
        .map(k => ({ id: k.split('/').pop(), data: () => mockDb[k] }));
      return Promise.resolve({ docs });
    },
    onSnapshot: (callback: Listener) => {
      if (!listeners[path]) listeners[path] = new Set();
      listeners[path].add(callback);
      const docs = Object.keys(mockDb)
        .filter(k => k.startsWith(path) && k.split('/').length === path.split('/').length + 1)
        .map(k => ({ id: k.split('/').pop(), data: () => mockDb[k] }));
      callback({ docs });
      return () => listeners[path].delete(callback);
    },
    add: (data: any) => {
      const id = Math.random().toString(36).substring(7);
      const docPath = `${path}/${id}`;
      mockDb[docPath] = { ...data, id };
      persist();
      listeners[path]?.forEach(l => {
         const docs = Object.keys(mockDb)
          .filter(k => k.startsWith(path) && k.split('/').length === path.split('/').length + 1)
          .map(k => ({ id: k.split('/').pop(), data: () => mockDb[k] }));
         l({ docs });
      });
      return Promise.resolve({ id });
    }
  })
};

export const auth = {
  currentUser: JSON.parse(sessionStorage.getItem('scribble_user') || 'null'),
  signInAnonymously: () => {
    const user = { uid: 'user_' + Math.random().toString(36).substring(7), displayName: 'Guest' };
    sessionStorage.setItem('scribble_user', JSON.stringify(user));
    auth.currentUser = user;
    return Promise.resolve({ user });
  },
  signOut: () => {
    sessionStorage.removeItem('scribble_user');
    auth.currentUser = null;
    return Promise.resolve();
  }
};
