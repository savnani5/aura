'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { SignInButton, SignUpButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Play, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  MessageSquare, 
  FileText, 
  CheckSquare, 
  Workflow,
  ArrowRight,
  Video,
  Bot,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function AuraLanding() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqItems = [
    {
      question: 'Which tools does Aura replace?',
      answer: 'Aura replaces Zoom + Meeting Bots + Manual Work. It combines video conferencing, AI transcription, meeting summaries, task tracking, and follow-up automation in one platform.'
    },
    {
      question: 'Can I use Aura with existing video conferencing tools?',
      answer: 'Aura works best as your primary video platform, but we\'re building integrations with popular tools. Contact us for specific integration needs.'
    },
    {
      question: 'Is Aura free?',
      answer: 'Yes, Aura is free to use for up to 10 meetings per month. After that, you can upgrade to the pro plan.'
    },
    {
      question: 'Is my data secure?',
      answer: 'Yes, absolutely. All meeting data is encrypted end-to-end, stored securely, and never shared with third parties. We comply with enterprise security standards.'
    },
    {
      question: "What is Aura's refund policy?",
      answer: 'We do not offer refunds on pro plan, but you can cancel anytime with no long-term commitments.'
    }
  ];

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-100 to-blue-100">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-gray-200/50">
        <div className="w-full mx-auto px-2 sm:px-4 lg:px-6 xl:px-8">
          <div className="flex h-20 items-center justify-between">
            <div className="flex items-center gap-3">
              <Image 
                src="/images/aura_full.svg" 
                alt="Aura" 
                width={400} 
                height={100}
                className="h-20 w-auto"
              />
            </div>
            <div className="flex items-center gap-3">
              <SignInButton mode="modal">
                <Button variant="ghost" size="sm" className="text-gray-700 hover:text-gray-900">
                  Sign In
                </Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button size="sm" className="bg-slate-800 hover:bg-slate-900 text-white">
                  Get Started
                </Button>
              </SignUpButton>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 md:pt-16 md:pb-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl text-center">
            {/* Bubble */}
            <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/70 backdrop-blur-sm border border-slate-300/50 px-4 py-2 text-sm text-slate-700 shadow-sm">
              <div className="w-2 h-2 rounded-full bg-slate-600"></div>
              Replaces Zoom + Fathom + Granola
            </div>
            
            {/* Headlines */}
            <h1 className="mb-6 text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-slate-900 leading-tight">
              AI-Native Video Conferencing
            </h1>
            
            <p className="mb-12 text-lg md:text-xl text-slate-700 max-w-3xl mx-auto leading-relaxed">
              Aura&apos;s AI-native video calls turn every meeting into a searchable, sharable, actionable workspace. Just one place for answers, notes, and next steps.
            </p>
            
            {/* CTAs */}
            <div className="mb-8 flex flex-col sm:flex-row gap-4 sm:justify-center">
              <Button 
                className="bg-slate-800 hover:bg-slate-900 text-white px-8 py-3 rounded-lg font-medium text-base"
                onClick={() => window.location.href = '/sign-up'}
              >
                Get Started Now
              </Button>
              <Button 
                variant="outline" 
                className="px-8 py-3 rounded-lg font-medium text-base border-slate-400 text-slate-700 hover:bg-white/50"
                onClick={() => window.open('https://calendly.com/thebottleneck/meeting-tool', '_blank')}
              >
                Book Demo
              </Button>
            </div>
            
            {/* Aura Demo Video */}
            <div className="mt-16 relative">
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-300/50 shadow-2xl p-3 max-w-4xl mx-auto">
                <div className="aspect-video rounded-xl overflow-hidden">
                  <iframe
                    src="https://www.loom.com/embed/474c8fd4264e4bdbbcc2166e6a623633?sid=93fa10a0-a888-460a-a9d7-5b309a975f52&speed=1.5"
                    frameBorder="0"
                    allowFullScreen
                    className="w-full h-full"
                    {...({ webkitallowfullscreen: "true", mozallowfullscreen: "true" } as any)}
                  ></iframe>
                </div>
                <div className="text-center mt-4">
                  <p className="text-slate-600 font-medium">See Aura in Action</p>
                  <p className="text-sm text-slate-500">Watch how AI transforms your meetings</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Before/After Section */}
      <section className="relative py-20 md:py-32 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/70 backdrop-blur-sm border border-slate-300/50 px-4 py-2 text-sm text-slate-700 shadow-sm">
                <div className="w-2 h-2 rounded-full bg-slate-600"></div>
                Why Aura
              </div>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 mb-4">
                We cut 15+ hours of<br />
                meeting busywork
              </h2>
            </div>
            
            <div className="grid gap-8 md:grid-cols-2 max-w-5xl mx-auto">
              {/* Before Aura */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-300/50 shadow-lg p-8">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">Before Aura</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-500 flex-shrink-0" />
                    <p className="text-slate-700 leading-relaxed">
                      You walk into meetings unsure what&apos;s still open or what was decided last time.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-500 flex-shrink-0" />
                    <p className="text-slate-700 leading-relaxed">
                      You leave meetings overwhelmed and unsure who&apos;s doing what or what happens next.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-500 flex-shrink-0" />
                    <p className="text-slate-700 leading-relaxed">
                      You spend hours following up, reconnecting dots, and hoping nothing slips.
                    </p>
                  </div>
                </div>
              </div>

              {/* After Aura */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl p-8 text-white">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold mb-2">After Aura</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-300 flex-shrink-0" />
                    <p className="text-slate-200 leading-relaxed">
                      You show up already knowing what matters. No prep scramble, no context hunting, no worries.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-300 flex-shrink-0" />
                    <p className="text-slate-200 leading-relaxed">
                      You leave every call with clarity. You&apos;ll always know what was said, what&apos;s next, and who owns what.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-300 flex-shrink-0" />
                    <p className="text-slate-200 leading-relaxed">
                      You finally trust that nothing will be forgotten, missed, or left behind.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-20 md:py-32 bg-gradient-to-br from-blue-50 via-slate-100 to-blue-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 mb-4">
                With Aura, You Get
              </h2>
            </div>
            
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {/* Live Meeting Agent */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-300/50 shadow-lg p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
                  <Bot className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Live Meeting Agent</h3>
                <p className="text-slate-700 text-sm leading-relaxed">
                  Ask about anything. Could be last week&apos;s decision, this week&apos;s pricing update, or live web info without leaving the call.
                </p>
              </div>

              {/* Instant Meeting Summary */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-300/50 shadow-lg p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
                  <FileText className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Instant Meeting Summary</h3>
                <p className="text-slate-700 text-sm leading-relaxed">
                  Get structured notes and transcripts delivered to your inbox the moment the call ends.
                </p>
              </div>

              {/* Auto-Tracked Tasks */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-300/50 shadow-lg p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
                  <CheckSquare className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Auto-Tracked Tasks</h3>
                <p className="text-slate-700 text-sm leading-relaxed">
                  Everything that sounded like a to-do? Captured, assigned, and ready for review. No need for you to remember.
                </p>
              </div>

              {/* One Place for Everything */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-300/50 shadow-lg p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
                  <Workflow className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">One Place for Prep, Call, and Follow-Up</h3>
                <p className="text-slate-700 text-sm leading-relaxed">
                  No bouncing between Notion, Slack, ClickUp, and docs. Aura handles the flow end-to-end.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="relative py-20 md:py-32 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/70 backdrop-blur-sm border border-slate-300/50 px-4 py-2 text-sm text-slate-700 shadow-sm">
                <div className="w-2 h-2 rounded-full bg-slate-600"></div>
                Transparent Pricing, No Surprises
              </div>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 mb-4">
                Flexible Plans For All
              </h2>
            </div>
            
            <div className="grid gap-8 md:grid-cols-2 max-w-5xl mx-auto">
              {/* Free Plan */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-300/50 shadow-lg p-8">
                <div className="mb-8">
                  <h3 className="text-3xl font-bold text-slate-900 mb-2">Free</h3>
                  <p className="text-slate-700 text-lg">Everything Included</p>
                </div>
                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-slate-700">10 Meetings You Can Host</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-slate-700">Unlimited Guests on Call</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-slate-700">Unlimited AI Chat</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-slate-700">Post Meeting Follow Up Emails</span>
                  </div>
                </div>
              </div>

              {/* Pro Plan */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-300/50 shadow-lg p-8">
                <div className="mb-8">
                  <div className="flex items-baseline gap-2 mb-2">
                    <h3 className="text-4xl font-bold text-slate-900">$25</h3>
                    <span className="text-slate-700 text-lg">/month</span>
                  </div>
                  <p className="text-slate-700 text-lg">Everything Included in Free Plus:</p>
                </div>
                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-slate-700">Unlimited Minutes</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-slate-700">Unlimited Integrations</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-slate-700">Unlimited Automations</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-slate-700">Access to Slack Community</span>
                  </div>
                </div>
              </div>
            </div>


          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="relative py-20 md:py-32 bg-gradient-to-br from-blue-50 via-slate-100 to-blue-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="text-center mb-16">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/70 backdrop-blur-sm border border-slate-300/50 px-4 py-2 text-sm text-slate-700 shadow-sm">
                <div className="w-2 h-2 rounded-full bg-slate-600"></div>
                Your Queries, Simplified
              </div>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 mb-4">
                Questions? Answers!
              </h2>
              <p className="text-lg md:text-xl text-slate-700 max-w-2xl mx-auto leading-relaxed">
                Find quick answers to the most common questions about our platform
              </p>
            </div>
            
            <div className="space-y-4">
              {faqItems.map((item, index) => (
                <div key={index} className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-300/50 shadow-lg overflow-hidden">
                  <button 
                    className="w-full text-left p-6 hover:bg-white/90 transition-colors"
                    onClick={() => toggleFaq(index)}
                    aria-expanded={openFaq === index}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900 pr-4">{item.question}</h3>
                      {openFaq === index ? (
                        <ChevronUp className="h-5 w-5 text-slate-600 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-slate-600 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                  {openFaq === index && (
                    <div className="px-6 pb-6 bg-white/60 border-t border-slate-200/50">
                      <p className="text-slate-800 leading-relaxed font-medium mt-4">{item.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>


    </div>
  );
} 