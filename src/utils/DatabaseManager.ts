import initSqlJs, { Database } from 'sql.js';
import { Chain } from '../types';

export class DatabaseManager {
    private db: Database | null = null;
    private dbPath: string | null = null;

    async init() {
        try {
            console.log('DatabaseManager: Initializing...');

            // Check if we are running inside Tauri
            const isTauri = !!(window as any).__TAURI_INTERNALS__;

            const SQL = await initSqlJs({
                locateFile: file => `/${file}`
            });

            if (isTauri) {
                const { appDataDir, join } = await import('@tauri-apps/api/path');
                const { readFile, exists, mkdir } = await import('@tauri-apps/plugin-fs');

                const dataDir = await appDataDir();
                this.dbPath = await join(dataDir, 'clipchain.sqlite');
                console.log('DatabaseManager: Running in Tauri. DB Path:', this.dbPath);

                if (!(await exists(dataDir))) {
                    await mkdir(dataDir, { recursive: true });
                }

                if (await exists(this.dbPath)) {
                    const fileContents = await readFile(this.dbPath);
                    this.db = new SQL.Database(fileContents);
                    console.log('DatabaseManager: Loaded existing db from disk');
                } else {
                    this.db = new SQL.Database();
                    console.log('DatabaseManager: Created new database file');
                }
            } else {
                console.warn('DatabaseManager: Not running in Tauri. Using localStorage for persistence.');

                // Attempt to load from localStorage
                const savedDb = localStorage.getItem('clipchain_db_backup');
                if (savedDb) {
                    try {
                        // Convert base64 string back to Uint8Array
                        const binaryString = window.atob(savedDb);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }
                        this.db = new SQL.Database(bytes);
                        console.log('DatabaseManager: Restored database from localStorage');
                    } catch (e) {
                        console.error('DatabaseManager: Failed to restore from localStorage', e);
                        this.db = new SQL.Database();
                    }
                } else {
                    this.db = new SQL.Database();
                }
            }

            this.db.run(`
                CREATE TABLE IF NOT EXISTS chains (
                    id TEXT PRIMARY KEY,
                    title TEXT,
                    createdAt INTEGER,
                    tags TEXT DEFAULT '[]'
                );
                CREATE TABLE IF NOT EXISTS items (
                    id TEXT PRIMARY KEY,
                    chainId TEXT,
                    content TEXT,
                    timestamp INTEGER,
                    type TEXT,
                    preview TEXT,
                    FOREIGN KEY(chainId) REFERENCES chains(id)
                );
            `);

            // Migration check
            try {
                this.db.run('SELECT tags FROM chains LIMIT 1');
            } catch (e) {
                console.log('DatabaseManager: Migrating - adding tags column');
                this.db.run('ALTER TABLE chains ADD COLUMN tags TEXT DEFAULT "[]"');
            }

            console.log('DatabaseManager: Initialization complete');
        } catch (error) {
            console.error('DatabaseManager: Failed to initialize:', error);
            throw error;
        }
    }

    private async persist() {
        if (!this.db) return;
        const isTauri = !!(window as any).__TAURI_INTERNALS__;

        if (isTauri) {
            if (!this.dbPath) return;
            try {
                const { writeFile } = await import('@tauri-apps/plugin-fs');
                const data = this.db.export();
                await writeFile(this.dbPath, data);
                console.log('DatabaseManager: Persisted to disk');
            } catch (error) {
                console.error('DatabaseManager: Failed to persist to disk:', error);
            }
        } else {
            // Browser mode: Save to localStorage
            try {
                const data = this.db.export();
                // Convert Uint8Array to base64 for string storage
                let binary = '';
                const len = data.byteLength;
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(data[i]);
                }
                const base64 = window.btoa(binary);
                localStorage.setItem('clipchain_db_backup', base64);
                console.log('DatabaseManager: Backed up to localStorage (will survive tab close)');
            } catch (error) {
                console.error('DatabaseManager: Failed to backup to localStorage:', error);
            }
        }
    }

    async saveChain(chain: Chain) {
        if (!this.db) return;

        this.db.run('INSERT OR REPLACE INTO chains (id, title, createdAt, tags) VALUES (?, ?, ?, ?)', [
            chain.id, chain.title, chain.createdAt, JSON.stringify(chain.tags)
        ]);

        for (const item of chain.items) {
            this.db.run('INSERT OR REPLACE INTO items (id, chainId, content, timestamp, type, preview) VALUES (?, ?, ?, ?, ?, ?)', [
                item.id, chain.id, item.content, item.timestamp, item.type, item.preview
            ]);
        }

        await this.persist();
    }

    async deleteChain(chainId: string) {
        if (!this.db) return;
        this.db.run('DELETE FROM items WHERE chainId = ?', [chainId]);
        this.db.run('DELETE FROM chains WHERE id = ?', [chainId]);
        await this.persist();
    }

    async clearAll() {
        if (!this.db) return;
        this.db.run('DELETE FROM items');
        this.db.run('DELETE FROM chains');
        // Reset sequence logic if needed, but simple DELETE is fine for now
        await this.persist();
    }

    loadAllChains(): Chain[] {
        if (!this.db) return [];

        const chainsResult = this.db.exec('SELECT * FROM chains ORDER BY createdAt DESC');
        if (chainsResult.length === 0) return [];

        const chains: Chain[] = chainsResult[0].values.map((row: any) => ({
            id: row[0],
            title: row[1],
            createdAt: row[2],
            tags: JSON.parse(row[3] || '[]'),
            items: []
        }));

        for (const chain of chains) {
            const itemsResult = this.db.exec(`SELECT * FROM items WHERE chainId = '${chain.id}' ORDER BY timestamp DESC`);
            if (itemsResult.length > 0) {
                chain.items = itemsResult[0].values.map((row: any) => ({
                    id: row[0],
                    content: row[2],
                    timestamp: row[3],
                    type: row[4],
                    preview: row[5]
                }));
            }
        }

        return chains;
    }
}
