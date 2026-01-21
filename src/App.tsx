import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useStore } from "./hooks/useStore";
import Workspace from "./components/Workspace";
import OnboardingModal from "./components/OnboardingModal";
import AuthModal from "./components/AuthModal";

function App() {
  const { init, addItem } = useStore();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    init();

    // Check if it's the first run
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }

    const isTauri = !!(window as any).__TAURI_INTERNALS__;
    let unlisten: Promise<() => void> | null = null;

    const syncBrowserClipboard = async () => {
      if (!isTauri && document.hasFocus()) {
        try {
          const text = await navigator.clipboard.readText();
          if (text && text.trim().length > 0) {
            addItem(text, Date.now());
          }
        } catch (e) {
          console.log('App: Browser clipboard sync pending permission or empty.');
        }
      }
    };

    if (isTauri) {
      unlisten = listen<{ content: string, timestamp: number }>('clipboard-update', (event) => {
        const text = event.payload.content;
        if (text) {
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
      <Workspace
        onOpenAuth={() => setShowAuthModal(true)}
        onOpenHelp={() => setShowOnboarding(true)}
      />
      <OnboardingModal isOpen={showOnboarding} onClose={closeOnboarding} />
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  );
}

export default App;
