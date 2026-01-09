import React, { useState } from 'react';
import { useStore } from '../hooks/useStore';
import { Search, Library, Bug, Code, FileText, Copy, Trash2, CheckCircle2, Plus, Edit2, X, Check } from 'lucide-react';
import CodeBlock from './CodeBlock';
import { ask } from '@tauri-apps/plugin-dialog';

const Workspace: React.FC = () => {
    const {
        chains,
        filteredChains,
        selectedChainId,
        selectChain,
        searchQuery,
        setSearchQuery,
        deleteChain,
        deleteItem,
        updateChainTitle,
        clearAllData,
        copyAll,
        copyItem,
        createNewChain
    } = useStore();

    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [isPendingNew, setIsPendingNew] = useState(false);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [tempTitle, setTempTitle] = useState('');
    const isTauri = !!(window as any).__TAURI_INTERNALS__;

    // Ensure we have a selected chain if none is selected but chains exist
    // Use filteredChains to ensure we respect search results
    const selectedChain = filteredChains.find(c => c.id === selectedChainId);

    const handleCopyAll = async (id: string) => {
        await copyAll(id);
        setCopiedId('all');
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleCopyItem = async (content: string, id: string) => {
        await copyItem(content);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleDelete = async (id: string) => {
        console.log('Workspace: handleDelete called for id:', id);
        const isTauri = !!(window as any).__TAURI_INTERNALS__;
        let confirmed = false;

        if (isTauri) {
            confirmed = await ask('Are you sure you want to delete this chain?', {
                title: 'Confirm Deletion',
                kind: 'warning',
            });
        } else {
            confirmed = window.confirm('Are you sure you want to delete this chain?');
        }

        if (confirmed) {
            console.log('Workspace: Delete confirmed');
            await deleteChain(id);
        } else {
            console.log('Workspace: Delete cancelled');
        }
    };

    const handleNewChain = () => {
        createNewChain();
        setIsPendingNew(true);
        // Reset the visual state after a short delay or on next copy
        setTimeout(() => setIsPendingNew(false), 2000);
    };

    const startEditing = () => {
        if (selectedChain) {
            setTempTitle(selectedChain.title);
            setIsEditingTitle(true);
        }
    };

    const saveTitle = async () => {
        if (selectedChain && tempTitle.trim()) {
            await updateChainTitle(selectedChain.id, tempTitle.trim());
            setIsEditingTitle(false);
        }
    };

    const cancelEditing = () => {
        setIsEditingTitle(false);
        setTempTitle('');
    };

    const handleClearAll = async () => {
        const isTauri = !!(window as any).__TAURI_INTERNALS__;
        let confirmed = false;

        if (isTauri) {
            confirmed = await ask('Are you sure you want to delete ALL data? This cannot be undone.', {
                title: 'Factory Reset',
                kind: 'warning',
            });
        } else {
            confirmed = window.confirm('Are you sure you want to delete ALL data? This cannot be undone.');
        }

        if (confirmed) {
            await clearAllData();
        }
    };

    // Handle manual paste (Cmd+V / Ctrl+V)
    React.useEffect(() => {
        const handlePaste = async (e: KeyboardEvent) => {
            // Check for Cmd+V or Ctrl+V
            if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
                // Ignore if user is typing in an input field
                const activeTag = document.activeElement?.tagName.toLowerCase();
                if (activeTag === 'input' || activeTag === 'textarea') {
                    return;
                }

                e.preventDefault();
                try {
                    const text = await navigator.clipboard.readText();
                    if (text) {
                        console.log('Workspace: Manual paste detected');
                        // Force add item, bypassing duplicate check in App.tsx (since this is explicit user action)
                        await useStore.getState().addItem(text, Date.now());

                        // Visual feedback (optional but nice)
                        // logic to flash or scroll to bottom could go here
                    }
                } catch (err) {
                    console.error('Workspace: Failed to read clipboard on paste', err);
                }
            }
        };

        window.addEventListener('keydown', handlePaste);
        return () => window.removeEventListener('keydown', handlePaste);
    }, []);

    return (
        <div className="flex h-screen bg-black text-white overflow-hidden">
            {/* Sidebar */}
            <div className="w-80 bg-black border-r border-white/10 flex flex-col">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-white rounded-md flex items-center justify-center">
                            <Code className="w-4 h-4 text-black" />
                        </div>
                        <h1 className="font-bold text-lg tracking-tight">ClipChain</h1>
                    </div>
                    <div className="flex gap-2">
                        {!isTauri && (
                            <button
                                onClick={() => window.dispatchEvent(new Event('focus'))}
                                className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-zinc-400 hover:text-white group"
                                title="Sync Clipboard"
                            >
                                <CheckCircle2 className="w-4 h-4 group-active:scale-90 transition-transform" />
                            </button>
                        )}
                        <button
                            onClick={handleNewChain}
                            className={`p-1.5 rounded-md transition-all ${isPendingNew
                                ? 'bg-green-500/20 text-green-400'
                                : 'hover:bg-white/10 text-zinc-400 hover:text-white'
                                }`}
                            title="Start New Chain"
                        >
                            <Plus className={`w-4 h-4 ${isPendingNew ? 'scale-110' : ''}`} />
                        </button>
                        <button
                            onClick={handleClearAll}
                            className="p-1.5 hover:bg-red-500/10 hover:text-red-400 rounded-md transition-colors text-zinc-400"
                            title="Clear All Data"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="p-4">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input
                            type="text"
                            placeholder="Search chains..."
                            className="w-full bg-zinc-900 border border-transparent rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-white/20 transition-colors text-zinc-300 placeholder-zinc-600"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
                    <div className="px-3 mb-2 flex justify-between items-center">
                        <h2 className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                            {searchQuery ? 'Search Results' : 'Recent Chains'}
                        </h2>
                    </div>
                    {filteredChains.map((chain) => (
                        <button
                            key={chain.id}
                            onClick={() => selectChain(chain.id)}
                            className={`w-full text-left px-3 py-3 rounded-lg flex items-start gap-3 transition-all ${selectedChainId === chain.id
                                ? 'bg-white/10 text-white'
                                : 'hover:bg-white/5 text-zinc-400 hover:text-zinc-200'
                                }`}
                        >
                            <div className={`mt-0.5 p-1.5 rounded-md ${selectedChainId === chain.id ? 'bg-white/20' : 'bg-zinc-900'
                                }`}>
                                {chain.items[0]?.type === 'code' ? <Code className="w-3.5 h-3.5" /> :
                                    chain.tags.includes('bug') ? <Bug className="w-3.5 h-3.5" /> :
                                        <FileText className="w-3.5 h-3.5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-0.5">
                                    <h3 className="font-medium text-sm truncate leading-tight">{chain.title}</h3>
                                    <span className="text-[10px] text-zinc-600 shrink-0">
                                        {new Date(chain.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <p className="text-xs opacity-60 truncate">{chain.items[0]?.preview}</p>
                            </div>
                        </button>
                    ))}
                    {filteredChains.length === 0 && (
                        <div className="px-3 py-8 text-center text-xs text-zinc-700">
                            No{searchQuery ? ' results' : ' chains'} found
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-white/10 text-[10px] text-zinc-600 flex justify-between tracking-wide">
                    <span>{chains.length} Chains recorded</span>
                    <span>v1.0.0</span>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col bg-black">
                {selectedChain ? (
                    <>
                        <div className="p-6 border-b border-white/10 bg-black flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    {isEditingTitle ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={tempTitle}
                                                onChange={(e) => setTempTitle(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
                                                className="bg-zinc-900 text-2xl font-bold tracking-tight text-white px-2 py-1 rounded border border-white/20 focus:outline-none min-w-[300px]"
                                                autoFocus
                                            />
                                            <button onClick={saveTitle} className="p-1 hover:bg-green-500/20 text-green-400 rounded">
                                                <Check className="w-5 h-5" />
                                            </button>
                                            <button onClick={cancelEditing} className="p-1 hover:bg-red-500/20 text-red-500 rounded">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 group">
                                            <h2 className="text-2xl font-bold tracking-tight">{selectedChain.title}</h2>
                                            <button
                                                onClick={startEditing}
                                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 text-zinc-500 hover:text-white rounded transition-all"
                                                title="Rename Chain"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                    {selectedChain.tags.map(tag => (
                                        <span key={tag} className="px-2 py-0.5 rounded-full bg-zinc-900 text-[10px] font-bold uppercase text-zinc-500">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                                <p className="text-sm text-zinc-500">
                                    Created {new Date(selectedChain.createdAt).toLocaleString()} • {selectedChain.items.length} items
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleCopyAll(selectedChain.id)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all border ${copiedId === 'all'
                                        ? 'bg-green-500/10 border-green-500/50 text-green-400'
                                        : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-300'
                                        }`}
                                >
                                    {copiedId === 'all' ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    <span>{copiedId === 'all' ? 'Copied All!' : 'Copy All'}</span>
                                </button>
                                <button
                                    onClick={() => handleDelete(selectedChain.id)}
                                    className="p-2 bg-zinc-900 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 rounded-lg transition-all border border-white/10 text-zinc-400"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
                            {selectedChain.items.length > 0 ? (
                                <>
                                    <div className="relative space-y-8">
                                        {/* Visual Connection Line */}
                                        <div className="absolute left-6 top-8 bottom-8 w-[2px] bg-gradient-to-b from-white/20 via-zinc-800 to-black" />

                                        {selectedChain.items.map((item, index) => (
                                            <div key={item.id} className="relative pl-14 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: `${Math.min(index * 50, 600)}ms` }}>
                                                {/* Node Circle */}
                                                <div className={`absolute left-4 top-4 w-4 h-4 rounded-full border-2 bg-black z-10 ${index === 0 ? 'border-white shadow-[0_0_10px_rgba(255,255,255,0.3)]' : 'border-zinc-700'
                                                    }`} />

                                                <div className="group relative">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                                            Step {selectedChain.items.length - index}
                                                            <span className="w-1 h-1 rounded-full bg-zinc-800" />
                                                            {new Date(item.timestamp).toLocaleTimeString()}
                                                        </span>
                                                        <div className="flex gap-1">
                                                            <button
                                                                onClick={() => handleCopyItem(item.content, item.id)}
                                                                className={`p-1 rounded transition-all ${copiedId === item.id
                                                                    ? 'bg-green-500/20 text-green-400 opacity-100'
                                                                    : 'opacity-0 group-hover:opacity-100 hover:bg-white/10 text-zinc-400 hover:text-white'
                                                                    }`}
                                                                title="Copy item"
                                                            >
                                                                {copiedId === item.id ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                                            </button>
                                                            <button
                                                                onClick={() => deleteItem(selectedChain.id, item.id)}
                                                                className="p-1 rounded transition-all opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 text-zinc-500 hover:text-red-400"
                                                                title="Delete item"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div
                                                        className="cursor-pointer active:scale-[0.99] transition-transform"
                                                        onClick={() => handleCopyItem(item.content, item.id)}
                                                    >
                                                        <CodeBlock content={item.content} type={item.type} />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-12 text-center">
                                        <p className="text-xs text-zinc-600 italic">
                                            Tap any item to copy it back to your clipboard
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-zinc-500 p-12 text-center">
                                    <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-4 border border-white/10">
                                        <Plus className="w-8 h-8 text-zinc-600" />
                                    </div>
                                    <h3 className="text-lg font-bold text-zinc-300 mb-2">Empty Chain</h3>
                                    <p className="max-w-xs text-sm">
                                        Copy some text from anywhere to add it to this chain.
                                    </p>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 p-12 text-center">
                        <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mb-6 border border-white/10">
                            <Library className="w-10 h-10 text-zinc-600" />
                        </div>
                        <h3 className="text-xl font-bold text-zinc-300 mb-2">No Chain Selected</h3>
                        <p className="max-w-xs text-sm">
                            Select a chain from the sidebar or start copying text to create one automatically.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Workspace;
