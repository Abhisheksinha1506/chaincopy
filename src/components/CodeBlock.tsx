import React from 'react';

interface CodeBlockProps {
    content: string;
    type: 'text' | 'image' | 'code';
}

const CodeBlock: React.FC<CodeBlockProps> = React.memo(({ content, type }) => {
    if (type === 'code') {
        return (
            <div className="rounded-lg overflow-hidden border border-white/10 my-2 bg-zinc-900">
                <pre className="p-4 text-sm font-mono text-zinc-300 overflow-x-auto whitespace-pre">
                    {content}
                </pre>
            </div>
        );
    }

    return (
        <div className="p-4 bg-zinc-900 rounded-lg border border-white/10 my-2 text-zinc-300 whitespace-pre-wrap font-mono text-sm leading-relaxed">
            {content}
        </div>
    );
});

export default CodeBlock;
