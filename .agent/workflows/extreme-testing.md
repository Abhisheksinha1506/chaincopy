---
description: Comprehensive "Extreme" Testing Workflow for ClipChain
---

# 🚀 ClipChain Extreme Testing Workflow

This workflow is designed to push ClipChain to its limits, identifying potential failures in synchronization, persistence, and edge-case handling.

## 🏁 Phase 1: Environment Reset
Ensure you are starting from a clean slate.

1.  **Factory Reset**: Click the Trash icon in the sidebar and confirm "Factory Reset".
2.  **Verify Clean State**: Refresh the app. The "Welcome to ClipChain!" onboarding and example chains should reappear.
3.  **Cloud Check**: (Optional) Log into Supabase and verify `user_items` and `user_chains` are empty.

## 🔗 Phase 2: Core Chaining Logic
Test the heart of the application.

1.  **Manual Chain Creation**:
    - Click the `+` button in the sidebar.
    - Verify a "New Chain" appears and is automatically selected.
    - Copy text from a document. Verify it appears in the "New Chain".
2.  **Automatic Chaining**:
    - Do NOT click the `+` button.
    - Copy three different snippets from a web page in quick succession.
    - Verify they are grouped into a single chain (if copying within a short window) or separate chains based on the `ChainManager`'s current logic.
3.  **Smart Internal Pasting**:
    - Create a chain with 3 items.
    - Click "Copy All" in the header.
    - Open a text editor and paste. Verify all 3 items are there, joined by newlines.
    - Now, paste that *same joined content* back into the search bar or anywhere ClipChain monitors.
    - **Extreme Check**: Verify ClipChain recognizes the "joined internal" signature and splits the paste back into 3 separate items in a new chain.

## 💻 Phase 3: Developer Intelligence
Test the specialized features for devs.

1.  **Language Detection**:
    - Copy a React component (TSX).
    - Copy a Python snippet.
    - Copy a JSON blob.
    - Verify the UI applies the correct syntax highlighting to each block.
2.  **Large Snippets**:
    - Copy a 2,000-line code file.
    - Verify the UI remains responsive and the `CodeBlock` component handles the virtualization correctly.

## 🔍 Phase 4: Search & Performance
Stress the search indexing.

1.  **Volume Test**:
    - Copy 50 different items.
    - Search for a specific keyword in the 45th item.
    - Verify the result appears instantly.
2.  **Fuzzy/Incremental Search**:
    - Type slowly into the search bar.
    - Verify the sidebar results update in real-time as you type.

## 🔄 Phase 5: Multi-Device & Cloud (Pro)
Test the synchronization layer.

1.  **Real-time Broadcast**:
    - Open the app in two separate browser windows (or one Tauri, one browser).
    - Log into the same Pro account on both.
    - Copy something in Window A.
    - **Extreme Check**: Verify it appears in Window B *instantly* without a refresh.
2.  **Offline Tolerance**:
    - Disable your internet connection.
    - Copy 5 items. Verify they save to the local SQLite DB.
    - Re-enable the internet.
    - Verify the app eventually syncs those 5 items to Supabase.

## 🧹 Phase 6: Persistence & Cleanup
Test the data lifecycle.

1.  **Manual Deletion**:
    - Delete a single item from a chain.
    - Delete an entire chain.
    - Verify the UI updates correctly and the changes persist after a refresh.
2.  **Sign Out**:
    - Sign out of your account.
    - Verify the UI switches back to the "local" context (previous cloud data should disappear, local data should reappear if it existed).

---

## 🛠 Troubleshooting
If tests fail:
- Check the browser console (Inspect Element > Console) for JavaScript errors.
- Check the Tauri logs if running natively.
- Verify Supabase RLS policies if cloud sync fails.
