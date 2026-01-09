import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Sparkles, Link as LinkIcon, Zap, Keyboard } from 'lucide-react';

interface OnboardingModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const steps = [
    {
        title: "Welcome to ChainCopy",
        description: "Your clipboard just got a brain. We don't just store what you copy; we remember how they relate to each other.",
        icon: <Sparkles className="w-12 h-12 text-white" />,
        color: "bg-zinc-900 border-white/10"
    },
    {
        title: "Contextual Chaining",
        description: "Related items are grouped automatically based on time. Copy an error, then a search, then a fix – they'll stay together forever.",
        icon: <LinkIcon className="w-12 h-12 text-zinc-300" />,
        color: "bg-zinc-900 border-white/10"
    },
    {
        title: "Manual Control",
        description: "Want to force an item into a specific chain? Just select the chain and press Cmd+V (or Ctrl+V) to paste directly into it.",
        icon: <Keyboard className="w-12 h-12 text-zinc-300" />,
        color: "bg-zinc-900 border-white/10"
    },
    {
        title: "You're Ready!",
        description: "ChainCopy is running in the background. Data is saved locally to your device. Happy coding!",
        icon: <Zap className="w-12 h-12 text-white" />,
        color: "bg-zinc-900 border-white/10"
    }
];

const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
    const [currentStep, setCurrentStep] = useState(0);

    if (!isOpen) return null;

    const next = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(s => s + 1);
        } else {
            onClose();
        }
    };

    const back = () => {
        if (currentStep > 0) {
            setCurrentStep(s => s - 1);
        }
    };

    const step = steps[currentStep];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-lg bg-black border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in duration-300">
                <div className={`p-12 flex flex-col items-center text-center transition-colors duration-500`}>
                    <div className="mb-8 p-6 bg-zinc-900 rounded-2xl border border-white/10 backdrop-blur-md shadow-xl">
                        {step.icon}
                    </div>

                    <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">
                        {step.title}
                    </h2>

                    <p className="text-zinc-400 leading-relaxed text-lg mb-8 max-w-sm">
                        {step.description}
                    </p>

                    <div className="flex gap-2 mb-10">
                        {steps.map((_, i) => (
                            <div
                                key={i}
                                className={`h-1.5 rounded-full transition-all duration-300 ${i === currentStep ? 'w-8 bg-white' : 'w-1.5 bg-zinc-800'
                                    }`}
                            />
                        ))}
                    </div>

                    <div className="flex gap-4 w-full justify-between items-center">
                        {currentStep > 0 ? (
                            <button
                                onClick={back}
                                className="flex items-center gap-2 px-6 py-3 text-zinc-500 hover:text-white transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5" />
                                <span>Back</span>
                            </button>
                        ) : <div />}

                        <button
                            onClick={next}
                            className="flex items-center gap-2 px-8 py-4 bg-white hover:bg-zinc-200 text-black rounded-2xl font-bold transition-all shadow-lg active:scale-95"
                        >
                            <span>{currentStep === steps.length - 1 ? 'Start Using' : 'Next'}</span>
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 text-zinc-600 hover:text-white transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
};

export default OnboardingModal;
