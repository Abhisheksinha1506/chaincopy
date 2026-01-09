export interface ClipItem {
    id: string;
    content: string;
    timestamp: number;
    type: 'text' | 'image' | 'code';
    preview: string;
}

export interface Chain {
    id: string;
    title: string;
    items: ClipItem[];
    createdAt: number;
    tags: string[];
}
