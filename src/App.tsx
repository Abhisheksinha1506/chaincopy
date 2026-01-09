import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useStore } from "./hooks/useStore";
import Workspace from "./components/Workspace";
import OnboardingModal from "./components/OnboardingModal";

function App() {
  const { init, addItem } = useStore();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    init();

    // Check if it's the first run
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }

    const isTauri = !!(window as any).__TAURI_INTERNALS__;
    let unlisten: Promise<() => void> | null = null;
    let lastClipboardContent = '';

    const syncBrowserClipboard = async () => {
      if (!isTauri && document.hasFocus()) {
        try {
          // In some browsers, this may trigger a "Allow Paste" popup
          const text = await navigator.clipboard.readText();
          if (text && text.trim().length > 0 && text !== lastClipboardContent) {
            // Only add if it's different from the last captured content
            lastClipboardContent = text;
            addItem(text, Date.now());
          }
        } catch (e) {
          // This usually means the user hasn't granted paste permission yet
          console.log('App: Browser clipboard sync pending permission or empty.');
        }
      }
    };

    if (isTauri) {
      unlisten = listen<{ content: string, timestamp: number }>('clipboard-update', (event) => {
        console.log('Clipboard update detected:', event.payload);
        const text = event.payload.content;

        // Prevent duplicate entries if the content hasn't changed
        if (text && text !== lastClipboardContent) {
          lastClipboardContent = text;
          addItem(text, event.payload.timestamp);
        }
      });
    } else {
      console.warn('App: Not running in Tauri. Using focus-based sync.');
      window.addEventListener('focus', syncBrowserClipboard);
      // Don't auto-sync on mount to avoid duplicates on refresh
    }

    return () => {
      if (unlisten) unlisten.then(f => f());
      window.removeEventListener('focus', syncBrowserClipboard);
    };
  }, []);

  const closeOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem('hasSeenOnboarding', 'true');
  };

  return (
    <>
      <Workspace />
      <OnboardingModal isOpen={showOnboarding} onClose={closeOnboarding} />
    </>
  );
}

export default App;
