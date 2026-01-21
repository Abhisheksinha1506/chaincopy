import { ClipItem, Chain } from '../types';

export class ChainManager {
    private chains: Chain[] = [];
    private forceNewChain: boolean = false;

    addItem(content: string, timestamp: number, selectedChainId?: string | null): { chains: Chain[], newItem: ClipItem } {
        const MAX_CONTENT_SIZE = 5 * 1024 * 1024; // 5MB limit
        let processedContent = content;

        if (content.length > MAX_CONTENT_SIZE) {
            console.warn(`ChainManager: Truncating large content (${content.length} chars)`);
            processedContent = content.substring(0, MAX_CONTENT_SIZE) + "\n\n[Content truncated due to size limit]";
        }

        const newItem: ClipItem = {
            id: Math.random().toString(36).substr(2, 9),
            content: processedContent,
            timestamp,
            type: this.detectType(processedContent),
            preview: processedContent.substring(0, 50),
        };

        // If forceNewChain is true OR there are no chains, create a new one
        if (this.forceNewChain || this.chains.length === 0) {
            const newChain: Chain = {
                id: Math.random().toString(36).substr(2, 9),
                title: this.generateTitle(content),
                items: [newItem],
                createdAt: timestamp,
                tags: [],
            };
            this.chains = [newChain, ...this.chains];
            this.forceNewChain = false; // Reset flag
        } else {
            // Find target chain: use selectedChainId if provided, otherwise default to first chain
            let targetChainIndex = 0;
            let chainFound = true;

            if (selectedChainId) {
                targetChainIndex = this.chains.findIndex(c => c.id === selectedChainId);
                // If selected chain not found, do NOT fall back to 0. Create a new chain instead to avoid data corruption.
                if (targetChainIndex === -1) {
                    console.warn(`ChainManager: Selected chain ${selectedChainId} not found. Creating new chain instead.`);
                    chainFound = false;
                }
            }

            if (!chainFound) {
                // Clone of the creation logic above
                const newChain: Chain = {
                    id: Math.random().toString(36).substr(2, 9),
                    title: this.generateTitle(content),
                    items: [newItem],
                    createdAt: timestamp,
                    tags: [],
                };
                this.chains = [newChain, ...this.chains];
            } else {
                const targetChain = this.chains[targetChainIndex];
                const updatedChain: Chain = {
                    ...targetChain,
                    items: [newItem, ...targetChain.items]
                };

                // Move updated chain to top of list
                this.chains = [
                    updatedChain,
                    ...this.chains.slice(0, targetChainIndex),
                    ...this.chains.slice(targetChainIndex + 1)
                ];
            }
        }

        return { chains: this.chains, newItem };
    }

    addItems(contents: string[], timestamp: number, selectedChainId?: string | null): { chains: Chain[], newItems: ClipItem[] } {
        const newItems: ClipItem[] = contents.map(content => ({
            id: Math.random().toString(36).substr(2, 9),
            content,
            timestamp, // Can increment slightly if order matters, but batch is fine
            type: this.detectType(content),
            preview: content.substring(0, 50),
        }));

        if (this.forceNewChain || this.chains.length === 0) {
            const newChain: Chain = {
                id: Math.random().toString(36).substr(2, 9),
                title: this.generateTitle(contents[0] || 'Batch Copy'),
                items: newItems,
                createdAt: timestamp,
                tags: [],
            };
            this.chains = [newChain, ...this.chains];
            this.forceNewChain = false;
        } else {
            // Find target chain: use selectedChainId if provided, otherwise default to first chain
            let targetChainIndex = 0;
            let chainFound = true;

            if (selectedChainId) {
                targetChainIndex = this.chains.findIndex(c => c.id === selectedChainId);
                if (targetChainIndex === -1) {
                    chainFound = false;
                }
            }

            if (!chainFound) {
                const newChain: Chain = {
                    id: Math.random().toString(36).substr(2, 9),
                    title: this.generateTitle(contents[0] || 'Batch Copy'),
                    items: newItems,
                    createdAt: timestamp,
                    tags: [], // Could derive common tags
                };
                this.chains = [newChain, ...this.chains];
            } else {
                const targetChain = this.chains[targetChainIndex];
                const updatedChain: Chain = {
                    ...targetChain,
                    items: [...newItems, ...targetChain.items]
                };

                this.chains = [
                    updatedChain,
                    ...this.chains.slice(0, targetChainIndex),
                    ...this.chains.slice(targetChainIndex + 1)
                ];
            }
        }
        return { chains: this.chains, newItems };
    }

    startNewChain() {
        this.forceNewChain = true;
    }

    private detectType(content: string): 'text' | 'image' | 'code' {
        // Simple heuristics to avoid false positives with common text
        const trimmed = content.trim();

        // Code usually doesn't have paragraphs of text
        if (content.length > 500 && !content.includes('\n')) return 'text';

        const codePatterns = [
            /^(import|export|const|let|var|function|class)\s/,  // Starts with keyword
            /;\s*$/,                                             // Ends with semicolon
            /=>/,                                                // Arrow function
            /\{\s*[\s\S]*\}/,                                    // Block structure { ... }
            /<\/?[a-z][\s\S]*>/i,                                // HTML tags
            /\(\)\s*\{/,                                         // Function definition () {
            /console\.log\(/                                     // console.log
        ];

        // Check if it matches at least one strong indicator
        const isCode = codePatterns.some(pattern => pattern.test(trimmed));

        if (isCode) return 'code';

        // Fallback: check for high density of code symbols if no strong pattern found
        const symbols = ['{', '}', '[', ']', '(', ')', ';', '=', '>', '<', '$'];
        let symbolCount = 0;
        for (const char of content) {
            if (symbols.includes(char)) symbolCount++;
        }

        // If > 5% of characters are code symbols, it's likely code
        if (content.length > 20 && (symbolCount / content.length) > 0.1) return 'code';

        return 'text';
    }

    private generateTitle(content: string): string {
        const words = content.trim().split(/\s+/).slice(0, 5).join(' ');
        return words.length > 0 ? words : 'New Chain';
    }

    getChains(): Chain[] {
        return this.chains;
    }

    setChains(chains: Chain[]) {
        this.chains = chains;
    }
}
