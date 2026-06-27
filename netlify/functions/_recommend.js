'use strict';
// Shared recommendation + REASON engine for the Apropos Business Center.
// Turns a member's intake answers into a diagnosed path, the services we
// recommend, and a plain-English reason for each ("Because you indicated X").
// Used by generate-plan.js (fresh assessment) AND member-otp-verify.js
// (returning visit) so the AI Agent greets every member identically.

const SERVICE_LIBRARY = {
  business_plan: { label: 'Business Plan', icon: '📄', href: '#results', blurb: 'Your tailored business plan and operating roadmap.' },
  formation: { label: 'Business Formation Guidance', icon: '🏢', href: '#assistant', blurb: 'Registration, EIN, business bank account, and startup checklist guidance.' },
  documents: { label: 'Business Documents', icon: '📑', href: '#documents', blurb: 'Generate NDAs, agreements, proposals, invoices, and other business documents.' },
  website: { label: 'Website Design', icon: '🌐', href: 'https://ai4websitedesign.com', blurb: 'Move from idea to a live customer-facing website.' },
  branding: { label: 'Branding', icon: '✨', href: 'https://ai4websitedesign.com', blurb: 'Clarify your offer, name, message, and visual presence.' },
  marketing: { label: 'Marketing Agent', icon: '📣', href: 'https://ai4-product-purchasing.ai4businesses.org/marketing-agent-offer.html', blurb: 'Create consistent promotional content and customer outreach.' },
  customers: { label: 'Getting Customers', icon: '🤝', href: '#assistant', blurb: 'Build your first customer acquisition plan and follow-up motion.' },
  funding: { label: 'Funding Readiness', icon: '💵', href: '#assistant', blurb: 'Prepare your business for grants, loans, and funding applications.' },
  contracts: { label: 'Government Contracts', icon: '🏛', href: 'https://capgenmkt.aproposgroupllc.com', blurb: 'Federal contract intelligence via CapGen — plus Nevada & California state matching.' },
  capability: { label: 'Capability Statement', icon: '🧾', href: 'https://capgenmkt.aproposgroupllc.com', blurb: 'Build the profile government buyers and partners expect.' },
  proposal: { label: 'Proposal Writing', icon: '📝', href: '#assistant', blurb: 'Turn opportunities into organized proposal responses.' },
  automation: { label: 'Business Automation', icon: '⚙️', href: '#assistant', blurb: 'Identify repeatable tasks that can be systemized.' },
  assistant: { label: 'AI Business Advisor', icon: '💬', href: '#assistant', blurb: 'Ask follow-up questions and get practical next-step guidance.' },
};

function arr(v) { return Array.isArray(v) ? v.map(x => String(x || '').trim()).filter(Boolean) : []; }

// input: { businessStatus[], servicesNeeded[], businessStageInput }
// businessStageInput accepts EITHER a raw intake stage (idea/funding/growing/contracts/customers/not_sure)
// OR an already-diagnosed stage (START/BUILD/MARKET/WIN CONTRACTS/GROW) — so it works on returning members too.
function recommend(input) {
  const statuses = new Set(arr(input.businessStatus));
  const needs = new Set(arr(input.servicesNeeded));
  const stage = String(input.businessStageInput || input.businessStage || 'not_sure').toLowerCase();

  const registrationExists = statuses.has('registered') || statuses.has('gov_regs');
  const noBasics = ['idea', 'starting', 'start'].includes(stage) || statuses.has('none');
  const wantsContracts = ['contracts', 'win contracts'].includes(stage) || needs.has('contracts') || needs.has('capability') || needs.has('proposal');
  const wantsFunding = ['funding', 'grow', 'growing'].includes(stage) || needs.has('funding');
  const wantsCustomers = ['customers', 'market'].includes(stage) || needs.has('marketing') || needs.has('customers');

  const missing = [];
  if (!registrationExists) missing.push('Business Registration');
  if (!registrationExists && !statuses.has('ein')) missing.push('EIN');
  if (!statuses.has('bank')) missing.push('Business Bank Account');
  if (!statuses.has('website')) missing.push('Website');
  if (!statuses.has('social')) missing.push('Social Media Presence');
  if (!statuses.has('customers')) missing.push('Customer Acquisition System');
  if (wantsContracts && !registrationExists) missing.push('Government Registrations');
  if (wantsContracts && !statuses.has('capability')) missing.push('Capability Statement');

  // Ordered recommendations, each carrying the reason it was selected.
  const rec = [];
  const seen = new Set();
  const add = (key, reason) => { if (seen.has(key) || !SERVICE_LIBRARY[key]) return; seen.add(key); rec.push({ key, reason }); };

  add('business_plan', 'Every path starts from your tailored business plan.');
  if (wantsCustomers) { add('marketing', 'Because your business needs stronger customer acquisition support.'); add('customers', 'Because you need a repeatable way to land your first or next customers.'); }
  if (wantsFunding) add('funding', 'Because you indicated funding is a current priority.');
  if (wantsContracts) { add('contracts', registrationExists ? 'Because your existing registration can be used to open your contract intelligence dashboard.' : 'Because government contract readiness is part of your growth path.'); add('capability', 'Because government buyers will expect a strong capability statement.'); add('proposal', 'Because winning contracts means responding with organized proposals.'); }
  if (noBasics && !registrationExists) { add('formation', "Because you're still standing up the basics of your business."); add('documents', "Because you'll need core business documents in place early."); }
  if (!statuses.has('website') || needs.has('website')) add('website', needs.has('website') ? 'Because you asked for help getting your website built.' : "Because you don't have a customer-facing website yet.");
  if (needs.has('branding')) add('branding', 'Because you asked for help clarifying your brand and message.');
  if (needs.has('automation')) add('automation', 'Because you want to automate repeatable tasks.');
  if (needs.has('documents')) add('documents', 'Because you asked for help generating business documents.');
  add('assistant', "Because I'm here to help you action all of this, anytime.");

  const recommendedServices = rec.slice(0, 8).map(({ key, reason }) => ({ key, ...SERVICE_LIBRARY[key], reason }));

  let businessStage = 'BUILD';
  if (noBasics && !registrationExists) businessStage = 'START';
  if (wantsCustomers) businessStage = 'MARKET';
  if (wantsContracts) businessStage = 'WIN CONTRACTS';
  if (wantsFunding || stage === 'growing' || stage === 'grow') businessStage = 'GROW';
  if (stage === 'not_sure' && noBasics && !registrationExists) businessStage = 'START';

  const nextSteps = [
    'Review and save your AI-generated business plan.',
    missing.length ? `Start with the missing foundation item: ${missing[0]}.` : 'Choose the highest-priority service card in your dashboard.',
    wantsContracts ? (registrationExists ? 'Use your Business Center access to review the CapGen-suite contract dashboards.' : 'Prepare your capability profile before pursuing contract opportunities.') : 'Use the AI Business Advisor to turn this plan into a 7-day action list.',
  ];

  return { businessStage, missingItems: missing.slice(0, 8), recommendedServices, nextSteps };
}

module.exports = { recommend, SERVICE_LIBRARY };
