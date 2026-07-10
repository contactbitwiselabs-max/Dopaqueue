import React, { useState, useEffect, useCallback, ReactNode } from 'react';
import { useTheme } from './theme';
import { getSavedVideos } from './storage';
import { hasFeature } from './licensing';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target: string | null;
  position: 'center' | 'top' | 'bottom' | 'left' | 'right';
  showNext: boolean;
  showSkip: boolean;
  showDone?: boolean;
  condition?: () => boolean;
}

/**
 * Onboarding Steps
 */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to DopaQueue',
    description: 'Save videos intentionally, watch them distraction-free, and manage your dopamine budget.',
    target: null, // No specific target, shown as modal
    position: 'center',
    showNext: true,
    showSkip: true,
  },
  {
    id: 'plant',
    title: 'Your Focus Plant',
    description: 'This plant represents your focus health. Save mindfully to keep it thriving!',
    target: '.plant-status',
    position: 'bottom',
    showNext: true,
    showSkip: true,
  },
  {
    id: 'budget',
    title: 'Daily Budget',
    description: 'Set a daily dopamine budget. Every mindless scroll consumes your budget.',
    target: '.budget-display',
    position: 'bottom',
    showNext: true,
    showSkip: true,
  },
  {
    id: 'save',
    title: 'Save Videos',
    description: 'Click "Save Video" to add the current page to your queue. Transcripts are fetched automatically.',
    target: '.save-button',
    position: 'top',
    showNext: true,
    showSkip: true,
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'Click here to view all your saved videos, search, filter, and organize.',
    target: '.dashboard-button',
    position: 'bottom',
    showNext: true,
    showSkip: true,
  },
  {
    id: 'sync',
    title: 'Cloud Sync',
    description: 'Sign in to sync your data across devices. Pro feature available.',
    target: '.sync-button',
    position: 'bottom',
    showNext: true,
    showSkip: true,
    condition: () => !hasFeature('cloudSync'),
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'Start saving videos intentionally. Your focus plant is ready to grow!',
    target: null,
    position: 'center',
    showNext: false,
    showSkip: false,
    showDone: true,
  },
];

/**
 * Onboarding Storage Keys
 */
const STORAGE_KEYS = {
  ONBOARDING_COMPLETED: 'dq_onboarding_completed',
  ONBOARDING_STEP: 'dq_onboarding_step',
  ONBOARDING_SEEN: 'dq_onboarding_seen',
};

interface OnboardingState {
  completed: boolean;
  currentStep: number;
  seen: boolean;
}

/**
 * Get onboarding state from storage
 */
function getOnboardingState(): OnboardingState {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return { completed: false, currentStep: 0, seen: false };
  }
  
  try {
    const state: any = {};
    chrome.storage.local.get([
      STORAGE_KEYS.ONBOARDING_COMPLETED,
      STORAGE_KEYS.ONBOARDING_STEP,
      STORAGE_KEYS.ONBOARDING_SEEN,
    ], (res: any) => {
      Object.assign(state, res);
    });
    
    // Fallback since get is async in MV3 but we want synchronous initial state if possible. 
    // In practice, we should use await, but for synchronous initialization we rely on default.
    return {
      completed: state[STORAGE_KEYS.ONBOARDING_COMPLETED] || false,
      currentStep: state[STORAGE_KEYS.ONBOARDING_STEP] || 0,
      seen: state[STORAGE_KEYS.ONBOARDING_SEEN] || false,
    };
  } catch {
    return { completed: false, currentStep: 0, seen: false };
  }
}

/**
 * Set onboarding state in storage
 */
function setOnboardingState(state: OnboardingState) {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return;
  }
  
  chrome.storage.local.set({
    [STORAGE_KEYS.ONBOARDING_COMPLETED]: state.completed,
    [STORAGE_KEYS.ONBOARDING_STEP]: state.currentStep,
    [STORAGE_KEYS.ONBOARDING_SEEN]: state.seen,
  });
}

export interface OnboardingContextType {
  isOnboarding: boolean;
  currentStep: OnboardingStep | null;
  steps: OnboardingStep[];
  startOnboarding: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipOnboarding: () => void;
  completeOnboarding: () => void;
}

/**
 * Onboarding Context
 */
export const OnboardingContext = React.createContext<OnboardingContextType>({
  isOnboarding: false,
  currentStep: null,
  steps: [],
  startOnboarding: () => {},
  nextStep: () => {},
  prevStep: () => {},
  skipOnboarding: () => {},
  completeOnboarding: () => {},
});

/**
 * Onboarding Provider
 */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>(() => getOnboardingState());
  const [isVisible, setIsVisible] = useState(false);
  
  // Actually load state asynchronously
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get([
        STORAGE_KEYS.ONBOARDING_COMPLETED,
        STORAGE_KEYS.ONBOARDING_STEP,
        STORAGE_KEYS.ONBOARDING_SEEN,
      ], (res: any) => {
        setState({
          completed: res[STORAGE_KEYS.ONBOARDING_COMPLETED] || false,
          currentStep: res[STORAGE_KEYS.ONBOARDING_STEP] || 0,
          seen: res[STORAGE_KEYS.ONBOARDING_SEEN] || false,
        });
      });
    }
  }, []);

  // Check if onboarding should be shown
  useEffect(() => {
    // Don't show if completed
    if (state.completed) {
      setIsVisible(false);
      return;
    }
    
    // Check if user has saved videos (experienced user)
    const videos = getSavedVideos();
    if (videos.length > 0 && !state.seen) {
      // User has saved videos but hasn't seen onboarding
      // Show onboarding
      setIsVisible(true);
      setState(prev => ({ ...prev, seen: true }));
      setOnboardingState({ ...state, seen: true });
    } else if (videos.length === 0 && !state.seen) {
      // New user, show onboarding
      setIsVisible(true);
      setState(prev => ({ ...prev, seen: true }));
      setOnboardingState({ ...state, seen: true });
    }
  }, [state.completed, state.seen]);
  
  // Get current step
  const currentStep = ONBOARDING_STEPS[state.currentStep];
  
  // Filter steps based on conditions
  const filteredSteps = ONBOARDING_STEPS.filter(step => {
    if (!step.condition) return true;
    return step.condition();
  });
  
  // Find current step in filtered steps
  const currentStepIndex = filteredSteps.findIndex(s => s.id === currentStep?.id);
  
  // Start onboarding
  const startOnboarding = useCallback(() => {
    setIsVisible(true);
    setState(prev => ({ ...prev, seen: true, currentStep: 0 }));
    setOnboardingState({ completed: false, currentStep: 0, seen: true });
  }, []);
  
  // Next step
  const nextStep = useCallback(() => {
    if (currentStepIndex < filteredSteps.length - 1) {
      const nextIndex = currentStepIndex + 1;
      setState(prev => ({ ...prev, currentStep: nextIndex }));
      setOnboardingState({ completed: false, currentStep: nextIndex, seen: true });
    }
  }, [currentStepIndex, filteredSteps.length]);
  
  // Previous step
  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      const prevIndex = currentStepIndex - 1;
      setState(prev => ({ ...prev, currentStep: prevIndex }));
      setOnboardingState({ completed: false, currentStep: prevIndex, seen: true });
    }
  }, [currentStepIndex]);
  
  // Skip onboarding
  const skipOnboarding = useCallback(() => {
    setIsVisible(false);
    setState(prev => ({ ...prev, completed: true, currentStep: 0 }));
    setOnboardingState({ completed: true, currentStep: 0, seen: true });
  }, []);
  
  // Complete onboarding
  const completeOnboarding = useCallback(() => {
    setIsVisible(false);
    setState(prev => ({ ...prev, completed: true, currentStep: 0 }));
    setOnboardingState({ completed: true, currentStep: 0, seen: true });
  }, []);
  
  const value: any = {
    isOnboarding: isVisible,
    currentStep: currentStep,
    steps: filteredSteps,
    currentStepIndex,
    totalSteps: filteredSteps.length,
    startOnboarding,
    nextStep,
    prevStep,
    skipOnboarding,
    completeOnboarding,
  };
  
  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {isVisible && currentStep && (
        <OnboardingOverlay 
          step={currentStep} 
          onNext={nextStep} 
          onPrev={prevStep} 
          onSkip={skipOnboarding} 
          onComplete={completeOnboarding} 
          currentStepIndex={currentStepIndex}
          totalSteps={filteredSteps.length}
        />
      )}
    </OnboardingContext.Provider>
  );
}

/**
 * Onboarding Overlay Component
 */
function OnboardingOverlay({ 
  step, 
  onNext, 
  onPrev, 
  onSkip, 
  onComplete,
  currentStepIndex,
  totalSteps 
}: any) {
  const { isDark } = useTheme();
  const [targetElement, setTargetElement] = useState<Element | null>(null);
  
  // Find target element
  useEffect(() => {
    if (step.target) {
      const element = document.querySelector(step.target);
      setTargetElement(element);
    }
  }, [step.target]);
  
  // Calculate position
  const getPosition = (): React.CSSProperties => {
    if (!targetElement || step.position === 'center') {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }
    
    const rect = targetElement.getBoundingClientRect();
    
    switch (step.position) {
      case 'top':
        return {
          top: `${rect.top + window.scrollY - 10}px`,
          left: `${rect.left + rect.width / 2}px`,
          transform: 'translateX(-50%) translateY(-100%)',
        };
      case 'bottom':
        return {
          top: `${rect.bottom + window.scrollY + 10}px`,
          left: `${rect.left + rect.width / 2}px`,
          transform: 'translateX(-50%)',
        };
      case 'left':
        return {
          top: `${rect.top + rect.height / 2 + window.scrollY}px`,
          left: `${rect.left - 10}px`,
          transform: 'translateY(-50%) translateX(-100%)',
        };
      case 'right':
        return {
          top: `${rect.top + rect.height / 2 + window.scrollY}px`,
          left: `${rect.right + 10}px`,
          transform: 'translateY(-50%)',
        };
      default:
        return {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        };
    }
  };
  
  const position = getPosition();
  
  // Modal for center-positioned steps
  if (step.position === 'center') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-zinc-900/90 backdrop-blur-xl rounded-2xl p-8 max-w-md w-full shadow-2xl border border-zinc-800">
          {/* Progress */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 flex items-center justify-center bg-lime-400 rounded-lg">
                  <span className="text-black font-bold text-sm">{currentStepIndex + 1}</span>
                </div>
                <div>
                  <h2 className="font-semibold text-white">{step.title}</h2>
                  <p className="text-sm text-zinc-300">{step.description}</p>
                </div>
              </div>
              
              {step.showSkip && (
                <button
                  onClick={onSkip}
                  className="text-sm text-zinc-500 hover:text-white transition-colors"
                >
                  Skip
                </button>
              )}
            </div>
            
            {/* Progress bar */}
            <div className="h-1 bg-zinc-800 rounded-full mt-4">
              <div 
                className="h-1 bg-lime-400 rounded-full transition-all duration-300"
                style={{ width: `${((currentStepIndex + 1) / totalSteps) * 100}%` }}
              />
            </div>
          </div>
          
          {/* Content */}
          <div className="mb-8">
            {step.id === 'welcome' && (
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 bg-lime-400/20 rounded-2xl flex items-center justify-center">
                  <svg className="w-10 h-10 text-lime-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  Welcome to DopaQueue
                </h3>
                <p className="text-zinc-300">
                  Take control of your video consumption. Save intentionally, watch mindfully.
                </p>
              </div>
            )}
            
            {step.id === 'complete' && (
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 bg-lime-400/20 rounded-2xl flex items-center justify-center">
                  <svg className="w-10 h-10 text-lime-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  You're All Set!
                </h3>
                <p className="text-zinc-300">
                  Your focus plant is ready to grow. Start saving videos intentionally!
                </p>
              </div>
            )}
          </div>
          
          {/* Actions */}
          <div className="flex gap-3 justify-end">
            {step.showNext && (
              <button
                onClick={onNext}
                className="px-6 py-2 bg-lime-400 text-black rounded-lg hover:bg-lime-500 transition-colors font-semibold"
              >
                Next
              </button>
            )}
            
            {step.showDone && (
              <button
                onClick={onComplete}
                className="px-6 py-2 bg-lime-400 text-black rounded-lg hover:bg-lime-500 transition-colors font-semibold"
              >
                Get Started
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  // Tooltip for positioned steps
  return (
    <div 
      className="fixed z-50 transition-all duration-300"
      style={position}
    >
      <div className="max-w-xs">
        {/* Tooltip arrow */}
        {step.position !== 'center' && (
          <div 
            className={`absolute w-4 h-4 bg-zinc-900/90 backdrop-blur-xl border border-zinc-800`}
            style={{
              [step.position === 'top' ? 'bottom' : step.position === 'bottom' ? 'top' : step.position === 'left' ? 'right' : 'left']: '-8px',
              transform: step.position === 'top' ? 'rotate(45deg)' : step.position === 'bottom' ? 'rotate(-45deg)' : step.position === 'left' ? 'rotate(135deg)' : 'rotate(-135deg)',
            }}
          />
        )}
        
        {/* Tooltip content */}
        <div className="bg-zinc-900/90 backdrop-blur-xl rounded-xl p-4 shadow-xl border border-zinc-800">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 flex items-center justify-center bg-lime-400 rounded-lg flex-shrink-0">
              <span className="text-black font-bold text-sm">{currentStepIndex + 1}</span>
            </div>
            
            <div className="flex-1">
              <h3 className="font-semibold text-white mb-1">
                {step.title}
              </h3>
              <p className="text-sm text-zinc-300">
                {step.description}
              </p>
            </div>
          </div>
          
          {/* Progress */}
          <div className="mt-4 pt-3 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="h-1 bg-zinc-800 rounded-full flex-1 mr-3">
                <div 
                  className="h-1 bg-lime-400 rounded-full transition-all duration-300"
                  style={{ width: `${((currentStepIndex + 1) / totalSteps) * 100}%` }}
                />
              </div>
              
              <div className="flex gap-2 text-xs font-semibold">
                {step.showSkip && (
                  <button
                    onClick={onSkip}
                    className="text-zinc-500 hover:text-white transition-colors"
                  >
                    Skip
                  </button>
                )}
                
                {currentStepIndex > 0 && (
                  <button
                    onClick={onPrev}
                    className="text-zinc-500 hover:text-white transition-colors"
                  >
                    Back
                  </button>
                )}
                
                {step.showNext && (
                  <button
                    onClick={onNext}
                    className="text-lime-400 hover:text-lime-300 transition-colors"
                  >
                    Next
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * useOnboarding hook
 */
export function useOnboarding() {
  const context = React.useContext(OnboardingContext);
  
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  
  return context;
}

/**
 * Onboarding Tooltip Component
 * For showing tooltips on specific elements
 */
export function OnboardingTooltip({ 
  stepId, 
  title, 
  description, 
  position = 'bottom',
  children 
}: {
  stepId: string;
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  children: ReactNode;
}) {
  const { currentStep, isOnboarding } = useOnboarding();
  
  if (!isOnboarding || currentStep?.id !== stepId) {
    return <>{children}</>;
  }
  
  return (
    <div className="relative">
      {children}
      <div 
        className={`absolute z-50 ${position === 'top' ? 'bottom-full left-1/2 -translate-x-1/2 mb-2' : 
          position === 'bottom' ? 'top-full left-1/2 -translate-x-1/2 mt-2' :
          position === 'left' ? 'right-full top-1/2 -translate-y-1/2 mr-2' :
          'left-full top-1/2 -translate-y-1/2 ml-2'}`}
      >
        <div className="bg-zinc-900/90 backdrop-blur-xl rounded-xl p-3 shadow-xl border border-zinc-800 min-w-[200px]">
          {/* Arrow */}
          <div 
            className={`absolute w-4 h-4 bg-zinc-900/90 backdrop-blur-xl border border-zinc-800`}
            style={{
              [position === 'top' ? 'top' : position === 'bottom' ? 'bottom' : position === 'left' ? 'left' : 'right']: '-8px',
              left: position === 'top' || position === 'bottom' ? '50%' : undefined,
              top: position === 'left' || position === 'right' ? '50%' : undefined,
              transform: position === 'top' ? 'translateX(-50%) rotate(45deg)' : 
                        position === 'bottom' ? 'translateX(-50%) rotate(-45deg)' :
                        position === 'left' ? 'translateY(-50%) rotate(135deg)' : 
                        'translateY(-50%) rotate(-135deg)',
            }}
          />
          
          <h4 className="font-semibold text-white mb-1">{title}</h4>
          <p className="text-sm text-zinc-300">{description}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Check if onboarding is completed
 */
export function isOnboardingCompleted() {
  const state = getOnboardingState();
  return state.completed;
}

/**
 * Reset onboarding
 */
export function resetOnboarding() {
  setOnboardingState({ completed: false, currentStep: 0, seen: false });
}

export default OnboardingProvider;
