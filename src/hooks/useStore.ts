import { create } from 'zustand';
import { Chain, ClipItem } from '../types';
import { ChainManager } from '../utils/ChainManager';
import { DatabaseManager } from '../utils/DatabaseManager';
import { Index } from 'flexsearch';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';

interface StoreState {
    chains: Chain[];
    filteredChains: Chain[];
    selectedChainId: string | null;
    dbManager: DatabaseManager | null;
    chainManager: ChainManager;
    user: User | null;
    session: Session | null;
    init: () => Promise<void>;
    addItem: (content: string, timestamp: number, isRemote?: boolean) => Promise<void>;
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
    exportChain: (id: string, format: 'md' | 'json' | 'txt') => void;
    signOut: () => Promise<void>;
    internalClipboard: string[] | null;
    lastCapturedContent: string;
    realtimeChannel: any | null;
    setupRealtime: (userId: string) => void;
    plan: 'free' | 'pro';
    setPlan: (plan: 'free' | 'pro') => void;
    warning: string | null;
    setWarning: (warning: string | null) => void;
    lastTargetChainId: string | null;
    fetchAndMergeCloudData: (user: any) => Promise<void>;
}

export const useStore = create<StoreState>((set, get) => {
    const searchIndex = new Index({
        tokenize: "forward",
        cache: true
    });

    const updateSearchIndex = (chains: Chain[], incrementalChain?: Chain) => {
        if (incrementalChain) {
            // Incremental update: Only update the modified chain
            const content = incrementalChain.items.map(i => i.content).join(' ');
            searchIndex.add(incrementalChain.id, `${incrementalChain.title} ${content}`);
        } else {
            // Full rebuild (only on init)
            searchIndex.clear();
            chains.forEach(chain => {
                const content = chain.items.map(i => i.content).join(' ');
                searchIndex.add(chain.id, `${chain.title} ${content}`);
            });
        }
    };

    return {
        chains: [],
        filteredChains: [],
        selectedChainId: null,
        dbManager: null,
        chainManager: new ChainManager(),
        searchQuery: '',
        internalClipboard: null,
        lastCapturedContent: '',
        user: null,
        session: null,
        realtimeChannel: null,
        plan: 'free',
        warning: null,
        lastTargetChainId: null,

        setPlan: (plan: 'free' | 'pro') => {
            console.log('Store: Setting plan to:', plan);
            set({ plan });
            // If switching to free, we should probably stop the realtime channel
            if (plan === 'free') {
                const { realtimeChannel } = get();
                if (realtimeChannel) {
                    realtimeChannel.unsubscribe();
                    set({ realtimeChannel: null });
                }
            } else {
                // If switching to pro, we might want to re-init realtime if logged in
                const { user } = get();
                if (user) get().setupRealtime(user.id);
            }
        },

        setWarning: (warning: string | null) => set({ warning }),

        setupRealtime: (userId: string) => {
            const currentChannel = get().realtimeChannel;
            if (currentChannel) {
                console.log('Store: Cleaning up existing realtime channel...');
                currentChannel.unsubscribe();
            }

            if (userId === 'local' || get().plan === 'free') {
                console.log('Store: Realtime disabled for local/free user');
                set({ realtimeChannel: null });
                return;
            }

            console.log(`Store: Setting up realtime channel for user: ${userId}`);
            const channel = supabase.channel(`user:${userId}`, {
                config: { broadcast: { self: false } }
            });

            channel
                .on('broadcast', { event: 'clipboard-update' }, (payload) => {
                    console.log('Store: Realtime clipboard-update received', payload);
                    const { content, timestamp } = payload.payload;
                    const { addItem } = get();
                    // We call addItem but need to ensure it doesn't broadcast again? 
                    // Actually, self: false prevents that, BUT addItem also saves to DB.
                    // This is good because the second device needs to save it to its local sql.js too.
                    // Prevent broadcast loop by passing isRemote: true
                    addItem(content, timestamp, true);
                })
                .on('broadcast', { event: 'data-change' }, async (payload) => {
                    console.log('Store: Realtime data-change received', payload);
                    const { type, chainId, itemId, newTitle } = payload.payload;
                    const { dbManager, chainManager, user } = get();
                    const activeUserId = user?.id ?? 'local';

                    if (!dbManager) return;

                    if (type === 'DELETE_ITEM') {
                        // Update local DB
                        await dbManager.deleteItem(chainId, itemId, activeUserId);
                        // Reload and refresh state
                        const chains = dbManager.loadAllChains(activeUserId);
                        chainManager.setChains(chains);
                        updateSearchIndex(chains);
                        set({ chains: [...chains], filteredChains: [...chains] });
                    } else if (type === 'DELETE_CHAIN') {
                        await dbManager.deleteChain(chainId, activeUserId);
                        const chains = dbManager.loadAllChains(activeUserId);
                        chainManager.setChains(chains);
                        updateSearchIndex(chains);
                        set({ chains: [...chains], filteredChains: [...chains] });
                    } else if (type === 'UPDATE_TITLE') {
                        const chains = get().chains;
                        const chain = chains.find(c => c.id === chainId);
                        if (chain) {
                            const updatedChain = { ...chain, title: newTitle };
                            await dbManager.saveChain(updatedChain, activeUserId);
                            const allChains = dbManager.loadAllChains(activeUserId);
                            chainManager.setChains(allChains);
                            updateSearchIndex(allChains);
                            set({ chains: [...allChains], filteredChains: [...allChains] });
                        }
                    } else if (type === 'NEW_CHAIN') {
                        // Simply reload all chains to get the new empty one
                        const chains = dbManager.loadAllChains(activeUserId);
                        chainManager.setChains(chains);
                        updateSearchIndex(chains);
                        set({ chains: [...chains], filteredChains: [...chains] });
                    } else if (type === 'CLEAR_ALL') {
                        // Local reset
                        chainManager.setChains([]);
                        updateSearchIndex([]);
                        set({ chains: [], filteredChains: [], selectedChainId: null });
                    }
                })
                .subscribe((status) => {
                    console.log(`Store: Realtime channel status: ${status}`);
                });

            set({ realtimeChannel: channel });
        },

        fetchAndMergeCloudData: async (newUser: any) => {
            console.log('Store: Fetching cloud data for user:', newUser.id);
            const { dbManager, chainManager } = get();
            if (!dbManager) return;

            try {
                const { data: cloudChains, error: chainsError } = await supabase
                    .from('user_chains')
                    .select('*, user_items(*)')
                    .eq('user_id', newUser.id)
                    .order('created_at', { ascending: false });

                if (chainsError) throw chainsError;

                const currentChains = get().chains;
                const mergedChains = [...currentChains];
                let changed = false;

                // ENHANCED MERGE LOGIC
                for (const cc of cloudChains || []) {
                    const localChain = mergedChains.find(lc => lc.id === cc.id);

                    const cloudItems = (cc.user_items || [])
                        .map((ci: any) => ({
                            id: ci.id,
                            content: ci.content,
                            timestamp: new Date(ci.timestamp).getTime(),
                            type: ci.type as any,
                            preview: ci.preview
                        }));

                    if (!localChain) {
                        const newChain = {
                            id: cc.id,
                            title: cc.title,
                            createdAt: new Date(cc.created_at).getTime(),
                            tags: cc.tags || [],
                            items: cloudItems
                        };
                        mergedChains.push(newChain);
                        await dbManager.saveChain(newChain, newUser.id);
                        changed = true;
                    } else {
                        let itemsChanged = false;
                        for (const ci of cloudItems) {
                            if (!localChain.items.find(li => li.id === ci.id)) {
                                localChain.items.push(ci);
                                itemsChanged = true;
                            }
                        }
                        if (localChain.title !== cc.title || JSON.stringify(localChain.tags) !== JSON.stringify(cc.tags)) {
                            localChain.title = cc.title;
                            localChain.tags = cc.tags || [];
                            itemsChanged = true;
                        }

                        if (itemsChanged) {
                            localChain.items.sort((a, b) => b.timestamp - a.timestamp);
                            await dbManager.saveChain(localChain, newUser.id);
                            changed = true;
                        }
                    }
                }

                if (changed) {
                    mergedChains.sort((a, b) => b.createdAt - a.createdAt);
                    chainManager.setChains(mergedChains);
                    updateSearchIndex(mergedChains);
                    set({
                        chains: [...mergedChains],
                        filteredChains: [...mergedChains],
                        selectedChainId: get().selectedChainId || mergedChains[0]?.id || null,
                        lastTargetChainId: get().selectedChainId || mergedChains[0]?.id || null
                    });
                }
                console.log('Store: Cloud sync complete');
            } catch (err: any) {
                console.error('Store: Cloud sync failed:', err.message);
                if (err.status === 403 || err.status === 401 || err.code === 'PGRST116') {
                    console.log('Store: Active verification failed during sync, signing out...');
                    get().signOut();
                }
            }
        },

        init: async () => {
            try {
                console.log('Store: Initializing...');
                const db = new DatabaseManager();
                await db.init();

                // FORCE Server-Side Verification: Contact Supabase to check if the user actually exists
                const { data: { user }, error: authError } = await supabase.auth.getUser();
                const { data: { session } } = await supabase.auth.getSession();

                if (authError || !user) {
                    if (authError) console.log('Store: Auth verification failed (likely user deleted):', authError.message);
                    // If we have a local session but getUser failed, it's a ghost session
                    if (session) {
                        console.log('Store: Ghost session detected, signing out...');
                        await supabase.auth.signOut();
                    }
                }

                const userId = (user && !authError) ? user.id : 'local';

                const chains = db.loadAllChains(userId);
                console.log(`Store: Loaded ${userId} chains from DB:`, chains.length);

                // Seed lastCapturedContent with the most recent item to prevent re-capture on refresh
                const latestItem = chains[0]?.items[0];
                const initialLastCaptured = latestItem?.content ?? '';
                const { setupRealtime, fetchAndMergeCloudData } = get();

                get().chainManager.setChains(chains);
                updateSearchIndex(chains);
                setupRealtime(userId);

                if (user && !authError) {
                    fetchAndMergeCloudData(user);
                }

                // SEEDING LOGIC: Only seed for new LOCAL users to avoid cluttering accounts
                if (userId === 'local' && chains.length === 0 && !localStorage.getItem('hasSeeded')) {
                    console.log('Store: Seeding example data for new user...');
                    const examples = [
                        {
                            title: 'Welcome to ClipChain! 👋',
                            items: [
                                { content: 'Try copying this text! Every time you copy something, it gets added as a new "Step" in the active chain.', type: 'text' },
                                { content: 'This is a code snippet. ClipChain detects it automatically!', type: 'code' },
                                { content: 'const greeting = "Hello World";\nconsole.log(greeting);', type: 'code' },
                            ]
                        },
                        {
                            title: 'How to use Chains 🔗',
                            items: [
                                { content: 'Chains group related snippets together. You can start a new chain anytime by clicking the "+" button in the sidebar.', type: 'text' },
                                { content: 'You can rename chains by clicking their title.', type: 'text' },
                                { content: 'Try using Cmd+K (or Ctrl+K) to quick-focus the search bar!', type: 'text' },
                            ]
                        }
                    ];

                    for (const ex of examples.reverse()) {
                        const { chains: updatedChains } = get().chainManager.addItem(ex.items[0].content, Date.now() - 1000);
                        const newChainId = updatedChains[0].id;
                        await db.saveChain(updatedChains[0], userId);

                        for (let i = 1; i < ex.items.length; i++) {
                            const { chains: stepChains } = get().chainManager.addItem(ex.items[i].content, Date.now(), newChainId);
                            await db.saveChain(stepChains[0], userId);
                        }
                    }

                    const seededChains = db.loadAllChains(userId);
                    get().chainManager.setChains(seededChains);
                    updateSearchIndex(seededChains);
                    localStorage.setItem('hasSeeded', 'true');

                    set({
                        chains: [...seededChains],
                        filteredChains: [...seededChains],
                        selectedChainId: seededChains[0]?.id || null,
                        lastCapturedContent: seededChains[0]?.items[0]?.content || ''
                    });
                }

                set({
                    dbManager: db,
                    chains: get().chains.length > 0 ? [...get().chains] : [...chains],
                    filteredChains: get().chains.length > 0 ? [...get().chains] : [...chains],
                    selectedChainId: get().selectedChainId || (chains.length > 0 ? chains[0].id : null),
                    session: (user && !authError) ? session : null,
                    user: (user && !authError) ? user : null,
                    lastCapturedContent: get().lastCapturedContent || initialLastCaptured
                });
                console.log('Store: Seeded lastCapturedContent:', initialLastCaptured);

                // Listen for Auth Changes
                supabase.auth.onAuthStateChange(async (event, session) => {
                    console.log('Store: Auth State Change Event:', event);
                    const { dbManager } = get();
                    const newUser = session?.user ?? null;
                    const oldUser = get().user;

                    // Only reload if user ID actually changed (e.g., login or logout)
                    if (newUser?.id !== oldUser?.id) {
                        const userId = newUser?.id ?? 'local';
                        console.log(`Store: Switching to ${userId} data context...`);

                        // Reset local state first
                        const chains = db.loadAllChains(userId);
                        const nextSelectedId = chains.length > 0 ? chains[0].id : null;

                        // Seed tracker for the new user context
                        const latestItem = chains[0]?.items[0];
                        const userLastCaptured = latestItem?.content ?? '';

                        get().chainManager.setChains(chains);
                        updateSearchIndex(chains);
                        get().setupRealtime(userId);

                        set({
                            session,
                            user: newUser,
                            chains: [...chains],
                            filteredChains: [...chains],
                            selectedChainId: nextSelectedId,
                            searchQuery: '',
                            lastCapturedContent: userLastCaptured,
                            lastTargetChainId: nextSelectedId
                        });

                        if (newUser) {
                            console.log('Store: Initiating account check & migration...');

                            // --- LOCAL TO CLOUD MIGRATION ---
                            const localChains = dbManager?.loadAllChains('local') || [];
                            if (localChains.length > 0) {
                                console.log(`Store: Found ${localChains.length} local chains. Migrating to account ${newUser.id}...`);
                                try {
                                    if (dbManager) {
                                        await dbManager.migrateUserId('local', newUser.id);

                                        // Re-load migrated chains for state and sync
                                        const migratedChains = dbManager.loadAllChains(newUser.id);
                                        set({ chains: [...migratedChains], filteredChains: [...migratedChains] });

                                        // Batch sync to cloud
                                        for (const chain of migratedChains) {
                                            await supabase.from('user_chains').upsert({
                                                id: chain.id,
                                                user_id: newUser.id,
                                                title: chain.title,
                                                created_at: new Date(chain.createdAt).toISOString(),
                                                tags: chain.tags
                                            });

                                            if (chain.items.length > 0) {
                                                const itemsToSync = chain.items.map((item: ClipItem) => ({
                                                    id: item.id,
                                                    user_id: newUser.id,
                                                    chain_id: chain.id,
                                                    content: item.content,
                                                    timestamp: new Date(item.timestamp).toISOString(),
                                                    type: item.type,
                                                    preview: item.preview
                                                }));
                                                await supabase.from('user_items').upsert(itemsToSync);
                                            }
                                        }
                                        console.log('Store: Local migration complete and synced to cloud');
                                    }
                                } catch (migrationErr) {
                                    console.error('Store: Migration failed:', migrationErr);
                                }
                            }

                            // Use refactored cloud fetch
                            get().fetchAndMergeCloudData(newUser);
                        }
                    } else {
                        // Just update session/user if it's a minor change (e.g., token refresh)
                        set({ session, user: newUser });
                    }
                });

                console.log('Store: Initialization complete');
            } catch (e) {
                console.error('Store: Init failed', e);
            }
        },

        addItem: async (content: string, timestamp: number, isRemote: boolean = false) => {
            console.log('Store: addItem called');
            const { chainManager, dbManager, searchQuery, chains, selectedChainId, internalClipboard, user } = get();
            // CAPTURE context-ID immediately to prevent race conditions during logout/refresh
            const activeUserId = user?.id ?? 'local';

            // Deduplication Check
            // Prevents double-pasting (e.g., race condition between focus-listener and manual Cmd+V)
            if (chains.length > 0 && chains[0].items.length > 0) {
                const latestItem = chains[0].items[0];
                const timeDiff = Math.abs(timestamp - latestItem.timestamp);

                if (latestItem.content === content && timeDiff < 500) {
                    console.log('Store: Duplicate content detected within 500ms, ignoring.');
                    set({ lastCapturedContent: content });
                    return;
                }
            }

            // CROSS-CHAIN Logic: 
            // Allow if content is same but user has switched to a different chain (selectedChainId != lastTargetChainId)
            const isSameContent = get().lastCapturedContent === content;
            const isSameChain = get().lastTargetChainId === selectedChainId;

            if (isSameContent && isSameChain) {
                console.log('Store: Content already captured in CURRENT chain, ignoring.');
                return;
            }

            // Log state before
            console.log('Store: Current chains count:', chains.length);

            // Check for Smart Internal Paste
            const joinedInternal = internalClipboard ? internalClipboard.join('\n\n') : null;
            let updatedChains;
            let itemsAdded: ClipItem[] = [];

            if (internalClipboard && content === joinedInternal) {
                console.log('Store: Smart Paste detected! Pasting multiple items separately.');
                const result = chainManager.addItems(internalClipboard, timestamp, selectedChainId);
                updatedChains = [...result.chains];
                itemsAdded = result.newItems;
                set({ internalClipboard: null }); // Consume the internal clipboard
            } else {
                const result = chainManager.addItem(content, timestamp, selectedChainId);
                updatedChains = [...result.chains];
                itemsAdded = [result.newItem];
            }

            const activeChain = updatedChains[0]; // It's always at index 0 now due to the move-to-front logic
            const targetChainId = activeChain.id;

            console.log('Store: Updated chains count:', updatedChains.length);
            console.log('Store: Active chain items:', activeChain.items.length);

            // Re-apply filter if searching
            let filtered = updatedChains;
            if (searchQuery) {
                const results = searchIndex.search(searchQuery);
                filtered = updatedChains.filter(c => results.includes(c.id));
            }

            updateSearchIndex(updatedChains, activeChain);

            // OPTIMISTIC UI: Update the store immediately
            set({
                chains: [...updatedChains],
                filteredChains: [...filtered],
                selectedChainId: targetChainId,
                lastCapturedContent: content,
                lastTargetChainId: targetChainId
            });

            // Background Sync: Perform DB and Cloud updates without blocking the UI
            (async () => {
                try {
                    if (dbManager) {
                        const chainToSave = updatedChains.find(c => c.id === targetChainId);
                        if (chainToSave) {
                            await dbManager.saveChain(chainToSave, activeUserId);

                            // Cloud Sync if logged in AND PRO
                            if (activeUserId !== 'local' && get().plan === 'pro') {
                                // Sync Chain
                                const { error: chainError } = await supabase.from('user_chains').upsert({
                                    id: chainToSave.id,
                                    user_id: activeUserId,
                                    title: chainToSave.title,
                                    created_at: new Date(chainToSave.createdAt).toISOString(),
                                    tags: chainToSave.tags
                                });
                                if (chainError) console.error('Store: Cloud chain sync failed:', chainError);

                                // Sync items
                                const itemsToSync = itemsAdded.map(item => ({
                                    id: item.id,
                                    chain_id: targetChainId,
                                    user_id: activeUserId,
                                    content: item.content,
                                    timestamp: new Date(item.timestamp).toISOString(),
                                    type: item.type,
                                    preview: item.preview
                                }));
                                const { error: itemsError } = await supabase.from('user_items').upsert(itemsToSync);
                                if (itemsError) console.error('Store: Cloud item sync failed:', itemsError);
                            }

                            // REALTIME BROADCAST - Only PRO
                            if (get().plan === 'pro' && !isRemote) {
                                const { realtimeChannel } = get();
                                if (realtimeChannel) {
                                    realtimeChannel.send({
                                        type: 'broadcast',
                                        event: 'clipboard-update',
                                        payload: { content, timestamp }
                                    });
                                }
                            }
                        }
                    }
                    console.log('Store: Background sync complete');
                } catch (err) {
                    console.error('Store: Background persistence failed', err);
                }
            })();
        },

        deleteChain: async (id: string) => {
            console.log('Store: deleteChain starting for id:', id);
            const { dbManager, chains, selectedChainId, chainManager, user } = get();
            const activeUserId = user?.id ?? 'local';

            if (!dbManager) {
                console.error('Store: deleteChain failed - dbManager is null');
                return;
            }

            // Optimistic UI
            const updatedChains = chains.filter(c => c.id !== id);
            chainManager.setChains(updatedChains);
            updateSearchIndex(updatedChains);

            const nextSelectedId = selectedChainId === id ? (updatedChains[0]?.id || null) : selectedChainId;

            set({
                chains: [...updatedChains],
                filteredChains: [...updatedChains],
                selectedChainId: nextSelectedId,
                lastTargetChainId: nextSelectedId
            });

            // Background sync
            (async () => {
                try {
                    if (dbManager) {
                        await dbManager.deleteChain(id, activeUserId);

                        // CLOUD GATE - Sync if logged in (any plan)
                        if (activeUserId !== 'local') {
                            await supabase.from('user_items').delete().eq('chain_id', id).eq('user_id', activeUserId);
                            await supabase.from('user_chains').delete().eq('id', id).eq('user_id', activeUserId);
                        }

                        // REALTIME BROADCAST - PRO ONLY
                        if (get().plan === 'pro') {
                            const { realtimeChannel } = get();
                            if (realtimeChannel) {
                                realtimeChannel.send({
                                    type: 'broadcast',
                                    event: 'data-change',
                                    payload: { type: 'DELETE_CHAIN', chainId: id }
                                });
                            }
                        }
                    }
                    console.log('Store: deleteChain background sync complete');
                } catch (err) {
                    console.error('Store: deleteChain sync failed', err);
                }
            })();
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
            const { dbManager, chains, chainManager, user } = get();
            const activeUserId = user?.id ?? 'local';

            // Create a new empty chain
            const newChain: Chain = {
                id: crypto.randomUUID(),
                title: 'New Chain',
                items: [],
                createdAt: Date.now(),
                tags: [],
            };

            // Optimistic UI
            const updatedChains = [newChain, ...chains];
            chainManager.setChains(updatedChains);
            updateSearchIndex(updatedChains);

            set({
                chains: [...updatedChains],
                filteredChains: [...updatedChains],
                selectedChainId: newChain.id,
                lastTargetChainId: newChain.id
            });

            // Background sync
            (async () => {
                try {
                    if (dbManager) {
                        await dbManager.saveChain(newChain, activeUserId);

                        // CLOUD GATE - Sync if logged in (any plan)
                        if (activeUserId !== 'local') {
                            await supabase.from('user_chains').upsert({
                                id: newChain.id,
                                user_id: activeUserId,
                                title: newChain.title,
                                created_at: new Date(newChain.createdAt).toISOString(),
                                tags: newChain.tags
                            });
                        }

                        // REALTIME BROADCAST - PRO ONLY
                        if (get().plan === 'pro') {
                            const { realtimeChannel } = get();
                            if (realtimeChannel) {
                                realtimeChannel.send({
                                    type: 'broadcast',
                                    event: 'data-change',
                                    payload: { type: 'NEW_CHAIN', chainId: newChain.id }
                                });
                            }
                        }
                    }
                    console.log('Store: New empty chain created (background sync)');
                } catch (err) {
                    console.error('Store: createNewChain sync failed', err);
                }
            })();
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
            set({
                internalClipboard: allContentRecap,
                lastCapturedContent: content
            });

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
            set({ lastCapturedContent: content });
            const isTauri = !!(window as any).__TAURI_INTERNALS__;
            if (isTauri) {
                await writeText(content);
            } else {
                await navigator.clipboard.writeText(content);
            }
        },

        deleteItem: async (chainId: string, itemId: string) => {
            console.log('Store: deleteItem starting for chain:', chainId, 'item:', itemId);
            const { dbManager, chains, chainManager, selectedChainId, user } = get();
            const activeUserId = user?.id ?? 'local';

            if (!dbManager) {
                console.error('Store: deleteItem failed - dbManager is null');
                return;
            }

            // Find the chain and remove the item
            const chain = chains.find(c => c.id === chainId);
            if (!chain) {
                console.error('Store: Chain not found:', chainId);
                return;
            }

            const updatedItems = chain.items.filter(item => item.id !== itemId);

            // OPTIMISTIC UI UPDATE
            let updatedChains;
            let newSelectedChainId = selectedChainId;
            if (updatedItems.length === 0) {
                updatedChains = chains.filter(c => c.id !== chainId);
                if (selectedChainId === chainId) {
                    newSelectedChainId = updatedChains[0]?.id || null;
                }
            } else {
                updatedChains = chains.map(c =>
                    c.id === chainId ? { ...chain, items: updatedItems } : c
                );
            }

            chainManager.setChains(updatedChains);
            updateSearchIndex(updatedChains);
            set({
                chains: [...updatedChains],
                filteredChains: [...updatedChains],
                selectedChainId: newSelectedChainId,
                lastTargetChainId: newSelectedChainId
            });

            // Background sync
            (async () => {
                try {
                    if (dbManager) {
                        if (updatedItems.length === 0) {
                            await dbManager.deleteChain(chainId, activeUserId);

                            // CLOUD GATE - Sync if logged in (any plan)
                            if (activeUserId !== 'local') {
                                await supabase.from('user_items').delete().eq('chain_id', chainId).eq('user_id', activeUserId);
                                await supabase.from('user_chains').delete().eq('id', chainId).eq('user_id', activeUserId);
                            }
                        } else {
                            await dbManager.deleteItem(chainId, itemId, activeUserId);

                            // CLOUD GATE - Sync if logged in (any plan)
                            if (activeUserId !== 'local') {
                                await supabase.from('user_items').delete().eq('id', itemId).eq('user_id', activeUserId);
                            }
                        }

                        // REALTIME BROADCAST - PRO ONLY
                        if (get().plan === 'pro') {
                            const { realtimeChannel } = get();
                            if (realtimeChannel) {
                                realtimeChannel.send({
                                    type: 'broadcast',
                                    event: 'data-change',
                                    payload: {
                                        type: updatedItems.length === 0 ? 'DELETE_CHAIN' : 'DELETE_ITEM',
                                        chainId,
                                        itemId
                                    }
                                });
                            }
                        }
                    }
                    console.log('Store: deleteItem background sync complete');
                } catch (err) {
                    console.error('Store: deleteItem sync failed', err);
                }
            })();
        },

        updateChainTitle: async (chainId: string, newTitle: string) => {
            console.log('Store: Updating title for chain:', chainId, 'to:', newTitle);
            const { dbManager, chains, chainManager, user } = get();
            const activeUserId = user?.id ?? 'local';

            if (!dbManager) return;

            const chain = chains.find(c => c.id === chainId);
            if (chain) {
                const updatedChain = { ...chain, title: newTitle };

                // Optimistic UI
                const updatedChains = chains.map(c => c.id === chainId ? updatedChain : c);
                chainManager.setChains(updatedChains);
                updateSearchIndex(updatedChains);

                set({
                    chains: updatedChains,
                    filteredChains: updatedChains
                });

                // Background sync
                (async () => {
                    try {
                        if (dbManager) {
                            await dbManager.saveChain(updatedChain, activeUserId);

                            // CLOUD GATE - Sync if logged in (any plan)
                            if (activeUserId !== 'local') {
                                await supabase.from('user_chains')
                                    .update({ title: newTitle })
                                    .eq('id', chainId)
                                    .eq('user_id', activeUserId);
                            }
                        }

                        // REALTIME BROADCAST - PRO ONLY
                        if (get().plan === 'pro') {
                            const { realtimeChannel } = get();
                            if (realtimeChannel) {
                                realtimeChannel.send({
                                    type: 'broadcast',
                                    event: 'data-change',
                                    payload: { type: 'UPDATE_TITLE', chainId, newTitle }
                                });
                            }
                        }
                        console.log('Store: updateChainTitle background sync complete');
                    } catch (err) {
                        console.error('Store: updateChainTitle sync failed', err);
                    }
                })();
            }
        },

        clearAllData: async () => {
            console.log('Store: Clearing all data...');
            const { dbManager, chainManager, user } = get();

            if (dbManager) {
                await dbManager.clearAll(user?.id ?? 'local');
            }

            // Sync with Supabase if logged in AND PRO
            if (user && get().plan === 'pro') {
                try {
                    // Items have a foreign key to chains, but we should clear both
                    const { error: itemsError } = await supabase.from('user_items').delete().eq('user_id', user.id);
                    if (itemsError) console.error('Store: Failed to clear cloud items:', itemsError);

                    const { error: chainsError } = await supabase.from('user_chains').delete().eq('user_id', user.id);
                    if (chainsError) console.error('Store: Failed to clear cloud chains:', chainsError);

                    // REALTIME BROADCAST
                    const { realtimeChannel } = get();
                    if (realtimeChannel) {
                        realtimeChannel.send({
                            type: 'broadcast',
                            event: 'data-change',
                            payload: { type: 'CLEAR_ALL' }
                        });
                    }

                    console.log('Store: Cloud data cleared');
                } catch (err) {
                    console.error('Store: Unexpected error clearing cloud data:', err);
                }
            }

            // Reset local state
            chainManager.setChains([]);
            updateSearchIndex([]);

            // Selective clear to avoid logging out the user
            localStorage.removeItem('hasSeeded');
            localStorage.setItem('hasSeeded', 'true'); // Set it to true so it doesn't re-seed immediately
            // But if the user WANTED to reset everything including onboarding:
            // localStorage.removeItem('hasSeenOnboarding'); 

            // Seed tracker with current clipboard to prevent immediate re-capture
            let currentClipboard = '';
            try {
                currentClipboard = await navigator.clipboard.readText();
            } catch (e) {
                console.warn('Store: Could not seed tracker from clipboard during reset', e);
            }

            set({
                chains: [],
                filteredChains: [],
                selectedChainId: null,
                lastCapturedContent: currentClipboard,
                lastTargetChainId: null
            });

            console.log('Store: All data cleared');
        },

        exportChain: (id: string, format: 'md' | 'json' | 'txt') => {
            if (get().plan === 'free') {
                set({ warning: 'Exporting is a PRO feature. Upgrade to save your data offline!' });
                setTimeout(() => set({ warning: null }), 5000);
                return;
            }
            const chain = get().chains.find(c => c.id === id);
            if (!chain) return;

            let content = '';
            let extension = format;
            let mimeType = 'text/plain';

            if (format === 'json') {
                content = JSON.stringify(chain, null, 2);
                mimeType = 'application/json';
            } else if (format === 'md') {
                content = `# ${chain.title}\n\n`;
                content += `*Created: ${new Date(chain.createdAt).toLocaleString()}*\n`;
                content += `*Items: ${chain.items.length}*\n\n---\n\n`;
                chain.items.forEach((item, idx) => {
                    content += `### Step ${chain.items.length - idx}\n`;
                    content += `*Type: ${item.type}* | *Time: ${new Date(item.timestamp).toLocaleTimeString()}*\n\n`;
                    if (item.type === 'code') {
                        content += `\`\`\`\n${item.content}\n\`\`\`\n\n`;
                    } else {
                        content += `${item.content}\n\n`;
                    }
                    if (idx < chain.items.length - 1) content += '---\n\n';
                });
                mimeType = 'text/markdown';
            } else {
                content = `CHAIN: ${chain.title}\n`;
                content = `DATE: ${new Date(chain.createdAt).toLocaleString()}\n\n`;
                chain.items.forEach((item, idx) => {
                    content += `[Step ${chain.items.length - idx}]\n`;
                    content += `${item.content}\n\n`;
                });
            }

            // Download trigger
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${chain.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${extension}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },
        signOut: async () => {
            const { dbManager, realtimeChannel } = get();

            // Cleanup realtime
            if (realtimeChannel) {
                console.log('Store: Cleaning up realtime channel on signout...');
                realtimeChannel.unsubscribe();
            }

            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error('Store: Signout failed', error);
            } else {
                // onAuthStateChange will handle the state reload, but let's be safe
                if (dbManager) {
                    const chains = dbManager.loadAllChains('local');

                    // Seed tracker for local context
                    const latestItem = chains[0]?.items[0];
                    const localLastCaptured = latestItem?.content ?? '';

                    get().chainManager.setChains(chains);
                    updateSearchIndex(chains);

                    set({
                        user: null,
                        session: null,
                        realtimeChannel: null,
                        chains: [...chains],
                        filteredChains: [...chains],
                        selectedChainId: chains.length > 0 ? chains[0].id : null,
                        lastCapturedContent: localLastCaptured,
                        lastTargetChainId: chains.length > 0 ? chains[0].id : null
                    });
                }
            }
        }
    };
});
