import { create } from 'zustand';
import { Chain } from '../types';
import { ChainManager } from '../utils/ChainManager';
import { DatabaseManager } from '../utils/DatabaseManager';
import { Index } from 'flexsearch';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';

interface StoreState {
    chains: Chain[];
    filteredChains: Chain[];
    selectedChainId: string | null;
    dbManager: DatabaseManager | null;
    chainManager: ChainManager;
    init: () => Promise<void>;
    addItem: (content: string, timestamp: number) => Promise<void>;
    deleteChain: (id: string) => Promise<void>;
    selectChain: (id: string) => void;
    deselectChain: () => void;
    createNewChain: () => Promise<void>;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    copyAll: (chainId: string) => Promise<void>;
    copyItem: (content: string) => Promise<void>;
    deleteItem: (chainId: string, itemId: string) => Promise<void>;
    updateChainTitle: (chainId: string, newTitle: string) => Promise<void>;
    clearAllData: () => Promise<void>;
    internalClipboard: string[] | null;
}

export const useStore = create<StoreState>((set, get) => {
    const searchIndex = new Index({
        tokenize: "forward",
        cache: true
    });

    const updateSearchIndex = (chains: Chain[]) => {
        searchIndex.clear();
        chains.forEach(chain => {
            const content = chain.items.map(i => i.content).join(' ');
            searchIndex.add(chain.id, `${chain.title} ${content}`);
        });
    };

    return {
        chains: [],
        filteredChains: [],
        selectedChainId: null,
        dbManager: null,
        chainManager: new ChainManager(),
        searchQuery: '',
        internalClipboard: null,

        init: async () => {
            try {
                console.log('Store: Initializing...');
                const db = new DatabaseManager();
                await db.init();
                const chains = db.loadAllChains();
                console.log('Store: Loaded chains from DB:', chains.length);

                get().chainManager.setChains(chains);
                updateSearchIndex(chains);

                set({
                    dbManager: db,
                    chains: [...chains],
                    filteredChains: [...chains],
                    selectedChainId: chains.length > 0 ? chains[0].id : null
                });
                console.log('Store: Initialization complete');
            } catch (e) {
                console.error('Store: Init failed', e);
            }
        },

        addItem: async (content: string, timestamp: number) => {
            console.log('Store: addItem called');
            const { chainManager, dbManager, searchQuery, chains, selectedChainId, internalClipboard } = get();

            // Deduplication Check
            // Prevents double-pasting (e.g., race condition between focus-listener and manual Cmd+V)
            if (chains.length > 0 && chains[0].items.length > 0) {
                const latestItem = chains[0].items[0];
                const timeDiff = Math.abs(timestamp - latestItem.timestamp);

                if (latestItem.content === content && timeDiff < 2000) {
                    console.log('Store: Duplicate content detected within 2s, ignoring.');
                    return;
                }
            }

            // Log state before
            console.log('Store: Current chains count:', chains.length);

            // Check for Smart Internal Paste
            const joinedInternal = internalClipboard ? internalClipboard.join('\n\n') : null;
            let updatedChains;

            if (internalClipboard && content === joinedInternal) {
                console.log('Store: Smart Paste detected! Pasting multiple items separately.');
                updatedChains = [...chainManager.addItems(internalClipboard, timestamp, selectedChainId)];
                set({ internalClipboard: null }); // Consume the internal clipboard
            } else {
                updatedChains = [...chainManager.addItem(content, timestamp, selectedChainId)];
            }

            const activeChain = updatedChains[0]; // It's always at index 0 now due to the move-to-front logic

            console.log('Store: Updated chains count:', updatedChains.length);
            console.log('Store: Active chain items:', activeChain.items.length);

            // Re-apply filter if searching
            let filtered = updatedChains;
            if (searchQuery) {
                const results = searchIndex.search(searchQuery);
                filtered = updatedChains.filter(c => results.includes(c.id));
            }

            // Sync with DB
            if (dbManager) {
                console.log('Store: Saving to DB...');
                await dbManager.saveChain(activeChain);
            }

            updateSearchIndex(updatedChains);

            set({
                chains: updatedChains,
                filteredChains: [...filtered],
                selectedChainId: activeChain.id
            });
            console.log('Store: addItem state update complete');
        },

        deleteChain: async (id: string) => {
            console.log('Store: deleteChain starting for id:', id);
            const { dbManager, chains, selectedChainId, chainManager } = get();

            if (!dbManager) {
                console.error('Store: deleteChain failed - dbManager is null');
                return;
            }

            try {
                await dbManager.deleteChain(id);
                console.log('Store: deleteChain - deleted from DB');
                const updatedChains = chains.filter(c => c.id !== id);
                chainManager.setChains(updatedChains);
                updateSearchIndex(updatedChains);

                set({
                    chains: [...updatedChains],
                    filteredChains: [...updatedChains],
                    selectedChainId: selectedChainId === id ? updatedChains[0]?.id || null : selectedChainId
                });
                console.log('Store: deleteChain complete');
            } catch (error) {
                console.error('Store: deleteChain failed', error);
            }
        },

        selectChain: (id: string) => {
            console.log('Store: Selecting chain:', id);
            set({ selectedChainId: id });
        },

        deselectChain: () => {
            set({ selectedChainId: null });
        },

        createNewChain: async () => {
            console.log('Store: Creating new empty chain');
            const { dbManager, chains, chainManager } = get();

            // Create a new empty chain
            const newChain: Chain = {
                id: Math.random().toString(36).substr(2, 9),
                title: 'New Chain',
                items: [],
                createdAt: Date.now(),
                tags: [],
            };

            const updatedChains = [newChain, ...chains];
            chainManager.setChains(updatedChains);
            updateSearchIndex(updatedChains);

            // Save to database
            if (dbManager) {
                await dbManager.saveChain(newChain);
            }

            set({
                chains: [...updatedChains],
                filteredChains: [...updatedChains],
                selectedChainId: newChain.id
            });

            console.log('Store: New empty chain created');
        },

        setSearchQuery: (query: string) => {
            const { chains } = get();
            if (!query) {
                set({ searchQuery: '', filteredChains: [...chains] });
                return;
            }

            const results = searchIndex.search(query);
            const filtered = chains.filter(c => results.includes(c.id));
            set({ searchQuery: query, filteredChains: [...filtered] });
        },

        copyAll: async (chainId: string) => {
            const { chains } = get();
            const chain = chains.find(c => c.id === chainId);
            if (!chain) return;

            // Gather all content
            const allContentRecap = chain.items.map(i => i.content);
            const content = allContentRecap.join('\n\n');

            // Set internal clipboard state for smart pasting
            set({ internalClipboard: allContentRecap });

            const isTauri = !!(window as any).__TAURI_INTERNALS__;
            try {
                if (isTauri) {
                    await writeText(content);
                } else {
                    await navigator.clipboard.writeText(content);
                }
            } catch (e) {
                console.error('Failed to copy', e);
            }
        },

        copyItem: async (content: string) => {
            console.log('Store: Copying item...');
            const isTauri = !!(window as any).__TAURI_INTERNALS__;
            if (isTauri) {
                await writeText(content);
            } else {
                await navigator.clipboard.writeText(content);
            }
        },

        deleteItem: async (chainId: string, itemId: string) => {
            console.log('Store: deleteItem starting for chain:', chainId, 'item:', itemId);
            const { dbManager, chains, chainManager } = get();

            if (!dbManager) {
                console.error('Store: deleteItem failed - dbManager is null');
                return;
            }

            try {
                // Find the chain and remove the item
                const chain = chains.find(c => c.id === chainId);
                if (!chain) {
                    console.error('Store: Chain not found:', chainId);
                    return;
                }

                const updatedItems = chain.items.filter(item => item.id !== itemId);

                // If no items left, delete the entire chain
                if (updatedItems.length === 0) {
                    await dbManager.deleteChain(chainId);
                    const updatedChains = chains.filter(c => c.id !== chainId);
                    chainManager.setChains(updatedChains);
                    updateSearchIndex(updatedChains);

                    set({
                        chains: [...updatedChains],
                        filteredChains: [...updatedChains],
                        selectedChainId: updatedChains[0]?.id || null
                    });
                } else {
                    // Update the chain with remaining items
                    const updatedChain = { ...chain, items: updatedItems };
                    await dbManager.saveChain(updatedChain);

                    const updatedChains = chains.map(c =>
                        c.id === chainId ? updatedChain : c
                    );
                    chainManager.setChains(updatedChains);
                    updateSearchIndex(updatedChains);

                    set({
                        chains: [...updatedChains],
                        filteredChains: [...updatedChains]
                    });
                }

                console.log('Store: deleteItem complete');
            } catch (error) {
                console.error('Store: deleteItem failed', error);
            }
        },

        updateChainTitle: async (chainId: string, newTitle: string) => {
            console.log('Store: Updating title for chain:', chainId, 'to:', newTitle);
            const { dbManager, chains, chainManager } = get();

            if (!dbManager) return;

            const chain = chains.find(c => c.id === chainId);
            if (chain) {
                const updatedChain = { ...chain, title: newTitle };

                // Update local state
                const updatedChains = chains.map(c => c.id === chainId ? updatedChain : c);
                chainManager.setChains(updatedChains);
                updateSearchIndex(updatedChains);

                set({
                    chains: updatedChains,
                    filteredChains: updatedChains
                });

                // Update DB
                await dbManager.saveChain(updatedChain);
            }
        },

        clearAllData: async () => {
            console.log('Store: Clearing all data...');
            const { dbManager, chainManager } = get();

            if (dbManager) {
                await dbManager.clearAll();
            }

            // Reset local state
            chainManager.setChains([]);
            updateSearchIndex([]);

            set({
                chains: [],
                filteredChains: [],
                selectedChainId: null
            });

            console.log('Store: All data cleared');
        }
    };
});
