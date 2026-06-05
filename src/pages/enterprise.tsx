export default function EnterpriseSubscriptionPage({ navigate }: { navigate: (page: any) => void }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white relative">
      {/* Premium subtle gradient background background blur */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] bg-gradient-to-b from-indigo-900/20 via-transparent to-transparent blur-3xl pointer-events-none" />

      {/* Navigation Header with Back Button */}
      <header className="relative max-w-7xl mx-auto px-6 pt-6 flex justify-between items-center z-10">
        <button 
          onClick={() => navigate("brand-dashboard")}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white font-medium transition-colors duration-200 cursor-pointer bg-transparent border-none p-0"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back to Dashboard
        </button>
      </header>

      {/* Hero Section */}
      <section className="relative max-w-5xl mx-auto px-6 pt-16 pb-16 text-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium text-indigo-400 bg-indigo-950/50 border border-indigo-800/50 rounded-full mb-6">
          FlipCollab Tier Upgrade
        </span>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent mb-6">
          Scale Your Creator Campaigns <br />With Zero Fees
        </h1>
        <p className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
          Unlock 0% platform fees for your entire team and your creators, plus advanced campaign management tools built for growing brands.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition-all duration-200 active:scale-[0.98]">
            Upgrade to Enterprise
          </button>
          <a href="#features" className="w-full sm:w-auto px-8 py-4 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold rounded-xl border border-slate-800 transition-all duration-200">
            Learn More
          </a>
        </div>
      </section>

      {/* The Fee Comparison Block */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Standard Card */}
          <div className="p-8 bg-slate-900/40 rounded-2xl border border-slate-800/80 backdrop-blur-sm">
            <h3 className="text-xl font-bold text-slate-300 mb-2">Standard Tier</h3>
            <p className="text-sm text-slate-500 mb-6">Pay as you go transaction model</p>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <span className="text-slate-400">Brand Platform Fee</span>
                <span className="font-semibold text-slate-200">5% added per checkout</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Creator Platform Fee</span>
                <span className="font-semibold text-slate-200">10% deducted from payout</span>
              </div>
            </div>
          </div>

          {/* Enterprise Card */}
          <div className="p-8 bg-gradient-to-b from-indigo-950/30 to-slate-900/30 rounded-2xl border-2 border-indigo-500/50 shadow-xl shadow-indigo-950/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-indigo-500 text-white font-semibold text-xs px-4 py-1 rounded-bl-xl tracking-wider uppercase">
              Maximize ROI
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Enterprise Subscription</h3>
            <p className="text-sm text-indigo-400/80 mb-6">Fixed predictable pricing</p>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <span className="text-slate-300 font-medium">Brand Platform Fee</span>
                <span className="font-bold text-emerald-400 text-lg">0% waived</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-medium">Creator Platform Fee</span>
                <span className="font-bold text-emerald-400 text-lg">0% waived</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section id="features" className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-white mb-12">Built for high-volume execution</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="p-6 bg-slate-900/30 rounded-xl border border-slate-800/60">
            <h4 className="text-lg font-semibold text-slate-200 mb-2">Zero Platform Fees</h4>
            <p className="text-slate-400 text-sm leading-relaxed">Completely eliminate percentages on your campaign budgets. What you assign goes completely to the media deal.</p>
          </div>
          <div className="p-6 bg-slate-900/30 rounded-xl border border-slate-800/60">
            <h4 className="text-lg font-semibold text-slate-200 mb-2">Unlimited Workflows</h4>
            <p className="text-slate-400 text-sm leading-relaxed">Deploy as many concurrent campaigns and accept as many applications as your operations require without thresholds.</p>
          </div>
          <div className="p-6 bg-slate-900/30 rounded-xl border border-slate-800/60">
            <h4 className="text-lg font-semibold text-slate-200 mb-2">Advanced Filters</h4>
            <p className="text-slate-400 text-sm leading-relaxed">Filter the talent database dynamically by deeper target profiles, explicit metric brackets, and historic data execution panels.</p>
          </div>
          <div className="p-6 bg-slate-900/30 rounded-xl border border-slate-800/60">
            <h4 className="text-lg font-semibold text-slate-200 mb-2">Priority Account Support</h4>
            <p className="text-slate-400 text-sm leading-relaxed">Direct communication pathways to resolve contract workflow modifications, platform inquiries, or settlement assistance.</p>
          </div>
        </div>
      </section>

      {/* Pricing Block */}
      <section className="max-w-3xl mx-auto px-6 py-12 text-center">
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-10 shadow-2xl">
          <h3 className="text-2xl font-bold text-white mb-2">Enterprise Plan</h3>
          <p className="text-slate-400 text-sm mb-6">Scalable access for modern brand workflows</p>
          <div className="mb-8">
            <span className="text-slate-500 text-sm font-medium line-through block h-5"></span>
            <span className="text-5xl font-extrabold text-white tracking-tight">Custom Plan</span>
            <span className="text-slate-400 text-sm block mt-2">Billed monthly or annually</span>
          </div>
          
          <ul className="text-left max-w-md mx-auto space-y-4 mb-8 text-slate-300 text-sm">
            <li className="flex items-center gap-3">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" /> Full waiver on brand and creator fees
            </li>
            <li className="flex items-center gap-3">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" /> Complete access to full talent parameters
            </li>
            <li className="flex items-center gap-3">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" /> Unlimited baseline monthly activations
            </li>
          </ul>

          <button className="w-full max-w-md py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg transition-all duration-200">
            Begin Setup Transition
          </button>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section className="max-w-3xl mx-auto px-6 py-16 border-t border-slate-900">
        <h2 className="text-2xl font-bold text-center text-white mb-10">Frequently Asked Questions</h2>
        <div className="space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h5 className="text-base font-semibold text-slate-200 mb-2">How exactly does the 0% platform fee operate?</h5>
            <p className="text-slate-400 text-sm leading-relaxed">
              Once your Enterprise status activates, the system bypasses calculating platform cuts at checkout for you. Creators applying to your campaigns also receive full contractual sums without platform deduction.
            </p>
          </div>
          <div className="border-b border-slate-800 pb-4">
            <h5 className="text-base font-semibold text-slate-200 mb-2">Are card payment processing parameters separate?</h5>
            <p className="text-slate-400 text-sm leading-relaxed">
              Yes, standard processing infrastructure charges remain structured separately. The Enterprise agreement strictly waives the software service platform fees usually collected by FlipCollab.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}