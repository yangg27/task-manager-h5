const DB_NAME = 'TaskManagerDB';
const DB_VERSION = 2;

const dbPromise = new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onerror = () => reject(request.error);
  request.onsuccess = () => resolve(request.result);
  request.onupgradeneeded = e => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains('users')) {
      const userStore = db.createObjectStore('users', { keyPath: 'id' });
      userStore.createIndex('email', 'email', { unique: true });
      userStore.createIndex('phone', 'phone', { unique: true });
    }
    if (!db.objectStoreNames.contains('tasks')) {
      const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
      taskStore.createIndex('userId', 'userId', { unique: false });
      taskStore.createIndex('dueDate', 'dueDate', { unique: false });
      taskStore.createIndex('status', 'status', { unique: false });
    }
    if (!db.objectStoreNames.contains('progress')) {
      const progressStore = db.createObjectStore('progress', { keyPath: 'id' });
      progressStore.createIndex('taskId', 'taskId', { unique: false });
      progressStore.createIndex('createdAt', 'createdAt', { unique: false });
    }
    if (!db.objectStoreNames.contains('attachments')) {
      const attachStore = db.createObjectStore('attachments', { keyPath: 'id' });
      attachStore.createIndex('taskId', 'taskId', { unique: false });
    }
    if (!db.objectStoreNames.contains('holidays')) {
      db.createObjectStore('holidays', { keyPath: 'date' });
    }
    if (!db.objectStoreNames.contains('settings')) {
      db.createObjectStore('settings', { keyPath: 'userId' });
    }
    if (!db.objectStoreNames.contains('subtasks')) {
      const subStore = db.createObjectStore('subtasks', { keyPath: 'id' });
      subStore.createIndex('taskId', 'taskId', { unique: false });
    }
    if (!db.objectStoreNames.contains('templates')) {
      const tplStore = db.createObjectStore('templates', { keyPath: 'id' });
      tplStore.createIndex('userId', 'userId', { unique: false });
    }
  };
});

const dbApi = {
  async getStore(name, mode = 'readonly') {
    const db = await dbPromise;
    return db.transaction(name, mode).objectStore(name);
  },

  async getAll(storeName) {
    const store = await this.getStore(storeName);
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async getByKey(storeName, key) {
    const store = await this.getStore(storeName);
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async put(storeName, data) {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async delete(storeName, key) {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async queryByIndex(storeName, indexName, value) {
    const store = await this.getStore(storeName);
    return new Promise((resolve, reject) => {
      const req = store.index(indexName).getAll(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async queryByIndexRange(storeName, indexName, range) {
    const store = await this.getStore(storeName);
    return new Promise((resolve, reject) => {
      const req = store.index(indexName).getAll(range);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
};
