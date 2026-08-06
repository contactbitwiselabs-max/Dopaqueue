import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Crown, Zap, Sparkles, Shield, Cloud, Download, 
  Users, BarChart2, Sparkle, Crown as CrownIcon,
  Loader2, Check, X, ArrowRight, ExternalLink,
  ChevronUp, ChevronDown
} from 'lucide-react';
import { useI18n } from '../shared/i18n';

interface UpgradeCTAProps {
  variant?: 'banner' | 'modal' | 'inline' | 'sidebar';
  trigger?: 'limit_reached' | 'feature_blocked' | 'onboarding' | 'settings' | 'manual';
  onUpgrade?: (plan: 'pro_monthly' | 'pro_annual' | 'lifetime') => void;
  onDismiss?: () => void;
  className?: string;
}

interface Plan {
  id: 'pro_monthly' | 'pro_annual' | 'lifetime';
  name: string;
  price: { monthly: number; yearly: number };
  originalPrice?: { monthly: number; yearly: number };
  features: string[];
  badge?: string;
  popular?: boolean;
  ctaText: string;
}

const PLANS: Plan[] = [
  {
    id: 'pro_monthly',
    name: 'Pro Monthly',
    price: { monthly: 4.99, yearly: 59.88 },
    originalPrice: { monthly: 7.99, yearly: 95.88 },
    features: [
      'Unlimited saves per month',
      '50 AI summaries/month',
      'Cloud sync across devices',
      'Advanced export (PDF, Markdown, Notion)',
      'Custom templates',
      'Analytics dashboard',
      'Priority support',
    ],
    badge: 'Most Flexible',
    ctaText: 'Start Monthly',
  },
  {
    id: 'pro_annual',
    name: 'Pro Annual',
    price: { monthly: 3.99, yearly: 47.88 },
    originalPrice: { monthly: 7.99, yearly: 95.88 },
    features: [
      'Everything in Monthly',
      '500 AI summaries/month',
      'Team collaboration (up to 3 members)',
      'Advanced analytics',
      'Custom branding',
      'API access',
      'Priority support',
    ],
    badge: 'Best Value - Save 50%',
    popular: true,
    ctaText: 'Start Annual',
  },
  {
    id: 'lifetime',
    name: 'Lifetime',
    price: { monthly: 0, yearly: 149 },
    originalPrice: { monthly: 7.99, yearly: 479.40 },
    features: [
      'Everything in Annual',
      'Unlimited AI summaries forever',
      'Unlimited team members',
      'Lifetime updates',
      'Self-hosted option',
      'Custom integrations',
      'Dedicated support',
    ],
    badge: 'One-time Payment',
    ctaText: 'Get Lifetime Access',
  },
];

const FREE_LIMITS = {
  maxSavesPerMonth: 20,
  maxAiSummariesPerMonth: 5,
  cloudSync: false,
  teamSync: false,
  advancedExport: false,
  customTemplates: false,
  analytics: false,
  prioritySupport: false,
};

export function UpgradeCTA({
  variant = 'modal',
  trigger = 'manual',
  onUpgrade,
  onDismiss,
  className = '',
}: UpgradeCTAProps {
  const { t } = useI18n();
  const [selectedPlan, setSelectedPlan] = useState<'pro_monthly' | 'pro_annual' | 'lifetime'>('pro_annual');
  const [isLoading, setIsLoading] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);

  // Trigger-specific messaging
  const triggerMessages = {
    limit_reached: {
      title: t('upgrade.limitReached.title'),
      subtitle: t('upgrade.limitReached.subtitle'),
      icon: Zap,
      urgency: 'high',
    },
    feature_blocked: {
      title: t('upgrade.featureBlocked.title'),
      subtitle: t('upgrade.featureBlocked.subtitle'),
      icon: Shield,
      urgency: 'medium',
    },
    onboarding: {
      title: t('upgrade.onboarding.title'),
      subtitle: t('upgrade.onboarding.subtitle'),
      icon: Sparkles,
      urgency: 'low',
    },
    settings: {
      title: t('upgrade.settings.title'),
      subtitle: t('upgrade.settings.subtitle'),
      icon: CrownIcon,
      urgency: 'low',
    },
    manual: {
      title: t('upgrade.manual.title'),
      subtitle: t('upgrade.manual.subtitle'),
      icon: Crown,
      urgency: 'low',
    },
  };

  const { title, subtitle, icon: Icon, urgency } = triggerMessages[trigger];

  // Animation triggers
  useEffect(() => {
    setAnimationKey(k => k + 1);
  }, [trigger, variant]);

  const handleUpgrade = async (planId: 'pro_monthly' | 'pro_annual' | 'lifetime') => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      onUpgrade?.(planId);
    } catch (error) {
      console.error('Upgrade failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    onDismiss?.();
  };

  const formatPrice = (plan: typeof PLANS[0]) => {
    if (plan.id === 'lifetime') {
      return `$${plan.price.yearly}`;
    }
    return `$${plan.price.monthly}/mo`;
  };

  const getSavings = (plan: typeof PLANS[0]) => {
    if (!plan.originalPrice) return null;
    if (plan.id === 'lifetime') {
      return plan.originalPrice.yearly - plan.price.yearly;
    }
    return plan.originalPrice.yearly - plan.price.yearly;
  };

  // Render based on variant
  switch (variant) {
    case 'banner':
      return renderBanner();
    case 'inline':
      return renderInline();
    case 'sidebar':
      return renderSidebar();
    case 'modal':
    default:
      return renderModal();
  }

  function renderBanner() {
    const plan = PLANS.find(p => p.id === selectedPlan)!;
    const savings = getSavings(plan);
    
    return (
      <motion.div
        key={animationKey}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`relative overflow-hidden rounded-2xl p-6 ${urgency === 'high' ? 'bg-gradient-to-r from-lime-500/20 to-amber-500/20 border-lime-500/50' : urgency === 'medium' ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-500/50' : 'bg-gradient-to-r from-lime-500/10 to-emerald-500/10 border-lime-500/30'} border`}
        className={className}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className={`p-3 rounded-xl ${urgency === 'high' ? 'bg-lime-500/20 text-lime-400' : urgency === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-lime-500/20 text-lime-400'}`}
            >
              <Icon className="w-6 h-6" />
            </motion.div>
            <div>
              <h3 className="font-bold text-lg text-white">{title}</h3>
              <p className="text-sm text-slate-300 mt-1">{subtitle}</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value as 'pro_monthly' | 'pro_annual' | 'lifetime')}
              className="bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-lime-500"
            >
              {PLANS.map(plan => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} - {formatPrice(plan)}
                </option>
              ))}
            </select>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleUpgrade(selectedPlan)}
              disabled={isLoading}
              className="bg-gradient-to-r from-lime-500 to-emerald-500 text-black font-semibold px-6 py-2.5 rounded-xl text-sm transition-all hover:shadow-lg hover:shadow-lime-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                plan.ctaText
              )}
            </motion.button>
            
            <button
              onClick={handleDismiss}
              className="p-2 text-slate-400 hover:text-white transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {savings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 pt-4 border-t border-white/10"
          >
            <p className="text-xs text-slate-400 text-center">
              Save ${savings.toFixed(2)}/year vs monthly pricing
            </p>
          </motion.div>
        )}
      </motion.div>
    );
  }

  function renderInline() {
    return (
      <motion.div
        key={animationKey}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl p-6 ${urgency === 'high' ? 'bg-gradient-to-r from-lime-500/10 to-amber-500/10 border-lime-500/30' : 'bg-slate-800/50 border-slate-700'} border`}
        className={className}
      >
        <div className="flex items-center gap-3 mb-4">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="p-3 rounded-xl bg-lime-500/20 text-lime-400"
          >
            <Icon className="w-6 h-6" />
          </motion.div>
          <div>
            <h3 className="font-bold text-lg text-white">{title}</h3>
            <p className="text-sm text-slate-300">{subtitle}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {PLANS.map(plan => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: PLANS.indexOf(plan) * 0.1 }}
              whileHover={{ y: -4 }}
              className={`relative rounded-2xl p-5 transition-all ${
                selectedPlan === plan.id 
                  ? 'bg-gradient-to-br from-lime-500/20 to-emerald-500/20 border-2 border-lime-500' 
                  : 'bg-slate-800/50 border-slate-700 hover:border-lime-500/30'
              }`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              {plan.popular && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-2 left-1/2 -translate-x-1/2"
                >
                  <span className="bg-gradient-to-r from-lime-500 to-emerald-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
                    {t('upgrade.mostPopular')}
                  </span>
                </motion.div>
              )}
              
              <div className="mb-4">
                <h4 className="font-bold text-lg text-white mb-1">{plan.name}</h4>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-2xl font-bold text-white">
                    {plan.id === 'lifetime' ? `$${plan.price.yearly}` : `$${plan.price.monthly}`}
                  </span>
                  {plan.id !== 'lifetime' && (
                    <span className="text-sm text-slate-400">/mo</span>
                  )}
                  {plan.originalPrice && (
                    <span className="text-xs text-slate-500 line-through">
                      ${plan.originalPrice.monthly}/mo
                    </span>
                  )}
                </div>
                {plan.badge && (
                  <span className="inline-block bg-lime-500/20 text-lime-400 text-xs font-medium px-2 py-0.5 rounded-full">
                    {plan.badge}
                  </span>
                )}
              </div>
              
              <ul className="space-y-2 mb-5">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                    <Check className="w-4 h-4 text-lime-500 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleUpgrade(plan.id)}
                disabled={isLoading || selectedPlan === plan.id}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                  selectedPlan === plan.id
                    ? 'bg-gradient-to-r from-lime-500 to-emerald-500 text-black'
                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isLoading && selectedPlan === plan.id ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : selectedPlan === plan.id ? (
                  'Current Plan'
                ) : (
                  plan.ctaText
                )}
              </motion.button>
            </motion.div>
          ))}
        </div>
        
        <AnimatePresence>
          {showComparison && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-6 pt-6 border-t border-slate-700"
            >
              <h4 className="font-semibold text-white mb-4 text-center">{t('upgrade.featureComparison')}</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-2 text-slate-400">{t('upgrade.features')}</th>
                      {PLANS.map(plan => (
                        <th key={plan.id} className="text-center py-2 font-semibold text-white">
                          {plan.name}
                        </th>
                      ))}
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-300">{t('upgrade.unlimitedSaves')}</td>
                      {PLANS.map(plan => (
                        <td key={plan.id} className="text-center py-2">
                          {plan.features.some(f => f.includes('Unlimited saves')) ? (
                            <span className="text-lime-400">✓</span>
                          ) : (
                            <span className="text-slate-500">{FREE_LIMITS.maxSavesPerMonth}/mo</span>
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-300">{t('upgrade.aiSummaries')}</td>
                      {PLANS.map(plan => (
                        <td key={plan.id} className="text-center py-2">
                          {plan.features.some(f => f.includes('Unlimited AI')) ? (
                            <span className="text-lime-400">∞</span>
                          ) : plan.features.some(f => f.includes('500 AI')) ? (
                            <span className="text-lime-400">500/mo</span>
                          ) : plan.features.some(f => f.includes('50 AI')) ? (
                            <span className="text-lime-400">50/mo</span>
                          ) : (
                            <span className="text-slate-500">{FREE_LIMITS.maxAiSummariesPerMonth}/mo</span>
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-300">{t('upgrade.cloudSync')}</td>
                      {PLANS.map(plan => (
                        <td key={plan.id} className="text-center py-2">
                          {plan.features.some(f => f.includes('Cloud sync')) ? (
                            <span className="text-lime-400">✓</span>
                          ) : (
                            <span className="text-slate-500">✗</span>
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-300">{t('upgrade.teamCollab')}</td>
                      {PLANS.map(plan => (
                        <td key={plan.id} className="text-center py-2">
                          {plan.features.some(f => f.includes('Team collaboration') || f.includes('Unlimited team')) ? (
                            <span className="text-lime-400">✓</span>
                          ) : (
                            <span className="text-slate-500">✗</span>
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-300">{t('upgrade.advancedExport')}</td>
                      {PLANS.map(plan => (
                        <td key={plan.id} className="text-center py-2">
                          {plan.features.some(f => f.includes('Advanced export')) ? (
                            <span className="text-lime-400">✓</span>
                          ) : (
                            <span className="text-slate-500">✗</span>
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 text-slate-300">{t('upgrade.analytics')}</td>
                      {PLANS.map(plan => (
                        <td key={plan.id} className="text-center py-2">
                          {plan.features.some(f => f.includes('Analytics')) ? (
                            <span className="text-lime-400">✓</span>
                          ) : (
                            <span className="text-slate-500">✗</span>
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-300">{t('upgrade.prioritySupport')}</td>
                      {PLANS.map(plan => (
                        <td key={plan.id} className="text-center py-2">
                          {plan.features.some(f => f.includes('Priority support')) ? (
                            <span className="text-lime-400">✓</span>
                          ) : (
                            <span className="text-slate-500">✗</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
          
          <div className="flex justify-center mt-4">
            <button
              onClick={() => setShowComparison(!showComparison)}
              className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            >
              {showComparison ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  {t('upgrade.hideComparison')}
                </>
              ) : (
                <>
                  {t('upgrade.showComparison')}
                  <ChevronDown className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  function renderSidebar() {
    const plan = PLANS.find(p => p.id === selectedPlan)!;
    
    return (
      <motion.div
        key={animationKey}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className={`rounded-2xl p-5 ${urgency === 'high' ? 'bg-gradient-to-br from-lime-500/10 to-amber-500/10 border-lime-500/30' : 'bg-slate-800/50 border-slate-700'} border`}
        className={className}
      >
        <div className="flex items-center gap-3 mb-4">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="p-3 rounded-xl bg-lime-500/20 text-lime-400"
          >
            <Icon className="w-6 h-6" />
          </motion.div>
          <div>
            <h3 className="font-bold text-lg text-white">{title}</h3>
            <p className="text-sm text-slate-300">{subtitle}</p>
          </div>
        </div>
        
        <div className="space-y-3 mb-4">
          {PLANS.map(plan => (
            <button
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id)}
              className={`w-full text-left rounded-xl p-4 transition-all ${
                selectedPlan === plan.id
                  ? 'bg-gradient-to-r from-lime-500/20 to-emerald-500/20 border-2 border-lime-500'
                  : 'bg-slate-800/50 border-slate-700 hover:border-lime-500/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-white">{plan.name}</h4>
                    {plan.popular && (
                      <span className="bg-gradient-to-r from-lime-500 to-emerald-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
                        {t('upgrade.mostPopular')}
                      </span>
                    )}
                    {plan.badge && !plan.popular && (
                      <span className="bg-lime-500/20 text-lime-400 text-xs font-medium px-2 py-0.5 rounded-full">
                        {plan.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400">
                    {plan.id === 'lifetime' 
                      ? `One-time: $${plan.price.yearly}`
                      : `$${plan.price.monthly}/mo`
                    }
                  </p>
                </div>
                {plan.popular && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="inline-flex items-center gap-1 text-lime-400 text-xs font-medium"
                  >
                    <Sparkle className="w-3 h-3" />
                    {t('upgrade.mostPopular')}
                  </motion.span>
                )}
              </div>
              <ul className="space-y-1.5 mt-3 pt-3 border-t border-slate-700">
                {plan.features.slice(0, 4).map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                    <Check className="w-4 h-4 text-lime-500 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
                {plan.features.length > 4 && (
                  <li className="flex items-center gap-2 text-sm text-lime-400 mt-1">
                    <Sparkle className="w-3 h-3" />
                    +{plan.features.length - 4} more features
                  </li>
                )}
              </ul>
            </button>
          ))}
        </div>
        
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleUpgrade(selectedPlan)}
          disabled={isLoading}
          className="w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-lime-500 to-emerald-500 text-black transition-all hover:shadow-lg hover:shadow-lime-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            plan.ctaText
          )}
        </motion.button>
      </motion.div>
    );
  }

  function renderModal() {
    return (
      <AnimatePresence>
        <motion.div
          key={animationKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={handleDismiss}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  className={`p-3 rounded-xl ${urgency === 'high' ? 'bg-lime-500/20 text-lime-400' : urgency === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-lime-500/20 text-lime-400'}`}
                >
                  <Icon className="w-7 h-7" />
                </motion.div>
                <div>
                  <h2 className="font-bold text-xl text-white">{title}</h2>
                  <p className="text-sm text-slate-300 mt-1">{subtitle}</p>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Plan Selection */}
            <div className="p-6 border-b border-slate-700">
              <h3 className="font-semibold text-white mb-4">{t('upgrade.choosePlan')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PLANS.map(plan => (
                  <motion.button
                    key={plan.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: PLANS.indexOf(plan) * 0.1 }}
                    whileHover={{ y: -4 }}
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`relative rounded-2xl p-5 transition-all ${
                      selectedPlan === plan.id
                        ? 'bg-gradient-to-br from-lime-500/20 to-emerald-500/20 border-2 border-lime-500'
                        : 'bg-slate-800/50 border-slate-700 hover:border-lime-500/30'
                    }`}
                  >
                    {plan.popular && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-2 left-1/2 -translate-x-1/2"
                      >
                        <span className="bg-gradient-to-r from-lime-500 to-emerald-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
                          {t('upgrade.mostPopular')}
                        </span>
                      </motion.div>
                    )}
                    
                    <div className="mb-4">
                      <h4 className="font-bold text-lg text-white mb-1">{plan.name}</h4>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-2xl font-bold text-white">
                          {plan.id === 'lifetime' ? `$${plan.price.yearly}` : `$${plan.price.monthly}`}
                        </span>
                        {plan.id !== 'lifetime' && (
                          <span className="text-sm text-slate-400">/mo</span>
                        )}
                        {plan.originalPrice && (
                          <span className="text-xs text-slate-500 line-through">
                            ${plan.originalPrice.monthly}/mo
                          </span>
                        )}
                      </div>
                      {plan.badge && (
                        <span className="inline-block bg-lime-500/20 text-lime-400 text-xs font-medium px-2 py-0.5 rounded-full">
                          {plan.badge}
                        </span>
                      )}
                    </div>
                    
                    <ul className="space-y-2 mb-5">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                          <Check className="w-4 h-4 text-lime-500 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                        selectedPlan === plan.id
                          ? 'bg-gradient-to-r from-lime-500 to-emerald-500 text-black'
                          : 'bg-slate-700 hover:bg-slate-600 text-white'
                      }`}
                    >
                      {selectedPlan === plan.id ? t('upgrade.currentPlan') : plan.ctaText}
                    </motion.button>
                  </motion.button>
                ))}
              </div>
            </div>
            
            {/* Comparison Toggle */}
            <div className="px-6 py-4 border-t border-slate-700">
              <button
                onClick={() => setShowComparison(!showComparison)}
                className="w-full flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                {showComparison ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    {t('upgrade.hideComparison')}
                  </>
                ) : (
                  <>
                    {t('upgrade.showComparison')}
                    <ChevronDown className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
            
            {/* Comparison Table */}
            <AnimatePresence>
              {showComparison && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-6 pb-6"
                >
                  <h4 className="font-semibold text-white mb-4 text-center">{t('upgrade.featureComparison')}</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="text-left py-2 text-slate-400">{t('upgrade.features')}</th>
                          {PLANS.map(plan => (
                            <th key={plan.id} className="text-center py-2 font-semibold text-white">
                              {plan.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-800">
                          <td className="py-2 text-slate-300">{t('upgrade.unlimitedSaves')}</td>
                          {PLANS.map(plan => (
                            <td key={plan.id} className="text-center py-2">
                              {plan.features.some(f => f.includes('Unlimited saves')) ? (
                                <span className="text-lime-400">✓</span>
                              ) : (
                                <span className="text-slate-500">{FREE_LIMITS.maxSavesPerMonth}/mo</span>
                              )}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b border-slate-800">
                          <td className="py-2 text-slate-300">{t('upgrade.aiSummaries')}</td>
                          {PLANS.map(plan => (
                            <td key={plan.id} className="text-center py-2">
                              {plan.features.some(f => f.includes('Unlimited AI')) ? (
                                <span className="text-lime-400">∞</span>
                              ) : plan.features.some(f => f.includes('500 AI')) ? (
                                <span className="text-lime-400">500/mo</span>
                              ) : plan.features.some(f => f.includes('50 AI')) ? (
                                <span className="text-lime-400">50/mo</span>
                              ) : (
                                <span className="text-slate-500">{FREE_LIMITS.maxAiSummariesPerMonth}/mo</span>
                              )}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b border-slate-800">
                          <td className="py-2 text-slate-300">{t('upgrade.cloudSync')}</td>
                          {PLANS.map(plan => (
                            <td key={plan.id} className="text-center py-2">
                              {plan.features.some(f => f.includes('Cloud sync')) ? (
                                <span className="text-lime-400">✓</span>
                              ) : (
                                <span className="text-slate-500">✗</span>
                              )}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b border-slate-800">
                          <td className="py-2 text-slate-300">{t('upgrade.teamCollab')}</td>
                          {PLANS.map(plan => (
                            <td key={plan.id} className="text-center py-2">
                              {plan.features.some(f => f.includes('Team collaboration') || f.includes('Unlimited team')) ? (
                                <span className="text-lime-400">✓</span>
                              ) : (
                                <span className="text-slate-500">✗</span>
                              )}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b border-slate-800">
                          <td className="py-2 text-slate-300">{t('upgrade.advancedExport')}</td>
                          {PLANS.map(plan => (
                            <td key={plan.id} className="text-center py-2">
                              {plan.features.some(f => f.includes('Advanced export')) ? (
                                <span className="text-lime-400">✓</span>
                              ) : (
                                <span className="text-slate-500">✗</span>
                              )}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b border-slate-800">
                          <td className="py-2 text-slate-300">{t('upgrade.analytics')}</td>
                          {PLANS.map(plan => (
                            <td key={plan.id} className="text-center py-2">
                              {plan.features.some(f => f.includes('Analytics')) ? (
                                <span className="text-lime-400">✓</span>
                              ) : (
                                <span className="text-slate-500">✗</span>
                              )}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2 text-slate-300">{t('upgrade.prioritySupport')}</td>
                          {PLANS.map(plan => (
                            <td key={plan.id} className="text-center py-2">
                              {plan.features.some(f => f.includes('Priority support')) ? (
                                <span className="text-lime-400">✓</span>
                              ) : (
                                <span className="text-slate-500">✗</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </div>
            
            {/* Footer Actions */}
            <div className="px-6 py-6 border-t border-slate-700">
              <div className="flex flex-col sm:flex-row gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleUpgrade(selectedPlan)}
                  disabled={isLoading}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-lime-500 to-emerald-500 text-black transition-all hover:shadow-lg hover:shadow-lime-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    PLANS.find(p => p.id === selectedPlan)!.ctaText
                  )}
                </motion.button>
                
                <button
                  onClick={handleDismiss}
                  className="px-6 py-3 rounded-xl font-semibold text-sm bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                >
                  {t('upgrade.later')}
                </button>
              </div>
              
              <p className="text-center text-xs text-slate-500 mt-4">
                {t('upgrade.securePayment')}{' '}
                <ExternalLink className="w-3 h-3 inline align-middle ml-1" />
              </p>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }
}

export default UpgradeCTA;