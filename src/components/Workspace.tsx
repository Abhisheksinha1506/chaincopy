import React, { useState } from 'react';
import { useStore } from '../hooks/useStore';
import { Search, Library, Bug, Code, FileText, Copy, Trash2, CheckCircle2, Plus, Edit2, X, Check, ArrowLeft, LogOut, HelpCircle, Download, ShieldCheck, Zap } from 'lucide-react';
import CodeBlock from './CodeBlock';
import { ask } from '@tauri-apps/plugin-dialog';
import { FixedSizeList as List } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';

interface WorkspaceProps {
    onOpenAuth: () => void;
    onOpenHelp: () => void;
}

const Workspace: React.FC<WorkspaceProps> = ({ onOpenAuth, onOpenHelp }) => {
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
        createNewChain,
        exportChain,
        user,
        signOut,
        plan,
        setPlan,
        warning,
        setWarning
    } = useStore();

    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [isPendingNew, setIsPendingNew] = useState(false);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [tempTitle, setTempTitle] = useState('');
    const searchInputRef = React.useRef<HTMLInputElement>(null);
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


    // Handle manual keyboard shortcuts (Cmd+C / Cmd+V)
    React.useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            const isMod = e.metaKey || e.ctrlKey;
            const activeTag = document.activeElement?.tagName.toLowerCase();
            const isTyping = activeTag === 'input' || activeTag === 'textarea';

            // --- MANUAL PASTE (Cmd/Ctrl + V) ---
            if (isMod && e.key === 'v') {
                if (isTyping) return; // Allow native paste in inputs

                e.preventDefault();
                try {
                    const text = await navigator.clipboard.readText();
                    if (text) {
                        console.log('Workspace: Manual paste detected via shortcut');
                        await useStore.getState().addItem(text, Date.now());
                    }
                } catch (err) {
                    console.error('Workspace: Failed to read clipboard on shortcut', err);
                }
            }

            // --- MANUAL COPY (Cmd/Ctrl + C) ---
            // If user presses copy and hasn't highlighted any text, copy the latest item
            if (isMod && e.key === 'c') {
                if (isTyping) return; // Allow native copy in inputs

                const selection = window.getSelection()?.toString();
                if (!selection && selectedChain && selectedChain.items.length > 0) {
                    e.preventDefault();
                    const latestItem = selectedChain.items[0];
                    console.log('Workspace: Manual copy detected via shortcut (no selection)');
                    await handleCopyItem(latestItem.content, latestItem.id);
                }
            }

            // --- FOCUS SEARCH (Cmd/Ctrl + K) ---
            if (isMod && e.key === 'k') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedChain, selectedChainId]);

    return (
        <div className="flex h-screen bg-black text-white overflow-hidden relative">
            {/* Sidebar */}
            <div className={`flex-col border-r border-white/10 bg-black transition-all ${selectedChainId ? 'hidden md:flex md:w-80' : 'flex w-full md:w-80'}`}>
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40 backdrop-blur-xl sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-white to-zinc-500 flex items-center justify-center shadow-lg shadow-white/10 cursor-pointer" onClick={() => setPlan(plan === 'free' ? 'pro' : 'free')}>
                            {plan === 'pro' ? <ShieldCheck className="w-4 h-4 text-black" /> : <Library className="w-4 h-4 text-black" />}
                        </div>
                        <div>
                            <h1 className="text-sm font-black tracking-tighter text-white">CLIPCHAIN</h1>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-sm tracking-wider uppercase transition-colors ${plan === 'pro' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                    {plan}
                                </span>
                            </div>
                        </div>
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
                            onClick={onOpenHelp}
                            className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-zinc-400 hover:text-white"
                            title="Help & Tutorial"
                        >
                            <HelpCircle className="w-4 h-4" />
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
                            ref={searchInputRef}
                            type="text"
                            placeholder="Search chains... (⌘K)"
                            className="w-full bg-zinc-900 border border-transparent rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-white/20 transition-colors text-zinc-300 placeholder-zinc-600"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 px-2 pb-4 flex flex-col min-h-0">
                    <div className="px-3 mb-2 flex justify-between items-center">
                        <h2 className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                            {searchQuery ? 'Search Results' : 'Recent Chains'}
                        </h2>
                    </div>

                    {filteredChains.length > 0 ? (
                        <div className="flex-1 min-h-0">
                            <AutoSizer renderProp={({ height, width }) => (
                                <List
                                    height={height || 0}
                                    itemCount={filteredChains.length}
                                    itemSize={80} // Approx size of each chain button
                                    width={width || 0}
                                    className="space-y-1"
                                >
                                    {({ index, style }: { index: number, style: React.CSSProperties }) => {
                                        const chain = filteredChains[index];
                                        return (
                                            <div style={style} className="px-1">
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
                                            </div>
                                        );
                                    }}
                                </List>
                            )} />
                        </div>
                    ) : (
                        <div className="px-3 py-8 text-center text-xs text-zinc-700">
                            No{searchQuery ? ' results' : ' chains'} found
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-white/10 flex flex-col gap-3">
                    {/* Plan Toggle - Only visible when logged in */}
                    {user && (
                        <button
                            onClick={() => setPlan(plan === 'free' ? 'pro' : 'free')}
                            className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${plan === 'pro'
                                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20'
                                : 'bg-zinc-900/50 border-white/5 text-zinc-400 hover:border-white/20'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${plan === 'pro' ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                                    <Zap className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-white leading-tight">
                                        {plan === 'pro' ? 'Pro Plan' : 'Free Plan'}
                                    </span>
                                    <span className="text-[10px] opacity-60">Switch tier</span>
                                </div>
                            </div>
                            {plan === 'free' && <Plus className="w-3.5 h-3.5 opacity-40" />}
                        </button>
                    )}

                    {user ? (
                        <div className="flex flex-col gap-2">
                            <div className="p-2 rounded-xl bg-green-500/5 border border-green-500/10">
                                <div className="flex items-center justify-between gap-3 min-w-0">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-green-500/10 text-green-400 flex items-center justify-center shrink-0">
                                            <CheckCircle2 className="w-4 h-4" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-xs font-bold text-white truncate">Cloud Synced</span>
                                            <span className="text-[10px] text-zinc-500 truncate">{user.email}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={signOut}
                                        className="p-2 hover:bg-red-500/10 rounded-lg text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                                        title="Log Out"
                                    >
                                        <LogOut className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={onOpenAuth}
                            className="flex items-center justify-between group w-full p-2 rounded-xl bg-zinc-900/50 border border-white/5 hover:border-white/10 transition-all text-left"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white/5 text-zinc-500 group-hover:text-white flex items-center justify-center transition-colors">
                                    <CheckCircle2 className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-bold text-white truncate">Sync to Cloud</span>
                                    <span className="text-[10px] text-zinc-500 truncate">Login or Sign Up</span>
                                </div>
                            </div>
                            <Plus className="w-4 h-4 text-zinc-600 transition-transform group-hover:rotate-45" />
                        </button>
                    )}
                    <div className="text-[10px] text-zinc-600 flex justify-between tracking-wide px-1">
                        <span>{chains.length} Chains recorded</span>
                        <span>v1.0.0</span>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className={`flex-1 flex flex-col min-w-0 bg-black relative ${selectedChainId ? 'flex w-full' : 'hidden md:flex'}`}>
                {/* Tier Warning Banner */}
                {warning && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] w-max max-w-md animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="bg-indigo-600 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/20">
                            <Zap className="w-5 h-5 text-indigo-200" />
                            <span className="text-sm font-medium">{warning}</span>
                            <button
                                onClick={() => setWarning(null)}
                                className="ml-2 p-1 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
                {selectedChain ? (
                    <>
                        <div className="p-4 md:p-6 border-b border-white/10 bg-black flex items-center justify-between sticky top-0 z-20">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <button
                                        onClick={() => useStore.getState().deselectChain()}
                                        className="md:hidden mr-1 p-1 -ml-2 text-zinc-400 hover:text-white"
                                        title="Back to list"
                                    >
                                        <ArrowLeft className="w-5 h-5" />
                                    </button>

                                    {isEditingTitle ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={tempTitle}
                                                onChange={(e) => setTempTitle(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
                                                className="bg-zinc-900 text-lg md:text-2xl font-bold tracking-tight text-white px-2 py-1 rounded border border-white/20 focus:outline-none min-w-[200px] md:min-w-[300px]"
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
                                            <h2 className="text-lg md:text-2xl font-bold tracking-tight truncate max-w-[200px] md:max-w-md">{selectedChain.title}</h2>
                                            <button
                                                onClick={startEditing}
                                                className="opacity-100 md:opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 text-zinc-500 hover:text-white rounded transition-all"
                                                title="Rename Chain"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                    <div className="hidden md:flex gap-1">
                                        {selectedChain.tags.map(tag => (
                                            <span key={tag} className="px-2 py-0.5 rounded-full bg-zinc-900 text-[10px] font-bold uppercase text-zinc-500">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <p className="text-xs md:text-sm text-zinc-500 flex gap-2">
                                    <span>{new Date(selectedChain.createdAt).toLocaleString()}</span>
                                    <span>•</span>
                                    <span>{selectedChain.items.length} items</span>
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
                                    <span className="hidden md:inline">{copiedId === 'all' ? 'Copied!' : 'Copy All'}</span>
                                </button>
                                <div className="relative">
                                    <button
                                        onClick={() => setShowExportMenu(!showExportMenu)}
                                        className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 rounded-lg transition-all"
                                        title="Export Chain"
                                    >
                                        <Download className="w-4 h-4" />
                                    </button>
                                    {showExportMenu && (
                                        <div className="absolute right-0 mt-2 w-40 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                            <button
                                                onClick={() => { exportChain(selectedChain.id, 'md'); setShowExportMenu(false); }}
                                                className="w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-white/10 transition-colors flex items-center gap-2"
                                            >
                                                <FileText className="w-3.5 h-3.5 text-zinc-500" />
                                                Markdown (.md)
                                            </button>
                                            <button
                                                onClick={() => { exportChain(selectedChain.id, 'json'); setShowExportMenu(false); }}
                                                className="w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-white/10 transition-colors flex items-center gap-2 border-t border-white/5"
                                            >
                                                <Code className="w-3.5 h-3.5 text-zinc-500" />
                                                JSON (.json)
                                            </button>
                                            <button
                                                onClick={() => { exportChain(selectedChain.id, 'txt'); setShowExportMenu(false); }}
                                                className="w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-white/10 transition-colors flex items-center gap-2 border-t border-white/5"
                                            >
                                                <FileText className="w-3.5 h-3.5 text-zinc-500" />
                                                Plain Text (.txt)
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleDelete(selectedChain.id)}
                                    className="p-2 bg-zinc-900 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 rounded-lg transition-all border border-white/10 text-zinc-400"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 md:p-8 w-full pb-32">
                            <div className="max-w-5xl mx-auto w-full">
                                {selectedChain.items.length > 0 ? (
                                    <>
                                        <div className="relative space-y-8">
                                            {/* Visual Connection Line */}
                                            <div className="absolute left-6 top-8 bottom-8 w-[2px] bg-gradient-to-b from-white/20 via-zinc-800 to-black" />

                                            {selectedChain.items.map((item, index) => (
                                                <div key={item.id} className="relative pl-12 md:pl-14 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: `${Math.min(index * 50, 600)}ms` }}>
                                                    {/* Node Circle */}
                                                    <div className={`absolute left-4 top-4 w-4 h-4 rounded-full border-2 bg-black z-10 ${index === 0 ? 'border-white shadow-[0_0_10px_rgba(255,255,255,0.3)]' : 'border-zinc-700'
                                                        }`} />

                                                    <div className="group relative">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                                                Step {selectedChain.items.length - index}
                                                                <span className="w-1 h-1 rounded-full bg-zinc-800 hidden md:block" />
                                                                <span className="hidden md:inline">{new Date(item.timestamp).toLocaleTimeString()}</span>
                                                            </span>
                                                            <div className="flex gap-1">
                                                                <button
                                                                    onClick={() => handleCopyItem(item.content, item.id)}
                                                                    className={`p-1 rounded transition-all ${copiedId === item.id
                                                                        ? 'bg-green-500/20 text-green-400 opacity-100'
                                                                        : 'opacity-100 md:opacity-0 group-hover:opacity-100 hover:bg-white/10 text-zinc-400 hover:text-white'
                                                                        }`}
                                                                    title="Copy item"
                                                                >
                                                                    {copiedId === item.id ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                                                </button>
                                                                <button
                                                                    onClick={() => deleteItem(selectedChain.id, item.id)}
                                                                    className="p-1 rounded transition-all opacity-100 md:opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 text-zinc-500 hover:text-red-400"
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

                                        <div className="mt-12 text-center pb-8">
                                            <p className="text-xs text-zinc-600 italic">
                                                Tap any item to copy it back to your clipboard
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-[50vh] text-zinc-500 p-12 text-center">
                                        <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-4 border border-white/10">
                                            <Plus className="w-8 h-8 text-zinc-600" />
                                        </div>
                                        <h3 className="text-lg font-bold text-zinc-300 mb-2">Empty Chain</h3>
                                        <p className="max-w-xs text-sm">
                                            Copy some text from anywhere or use the input below to add it to this chain.
                                        </p>
                                    </div>
                                )}
                            </div>
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
        </div >
    );
};

export default Workspace;
