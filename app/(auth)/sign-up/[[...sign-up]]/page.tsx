import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-100 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Join Aura</h1>
          <p className="text-slate-600">Your AI-native video conferencing platform</p>
        </div>
        
        <SignUp 
          redirectUrl="/"
          signInUrl="/sign-in"
                      appearance={{
              elements: {
                rootBox: "w-full",
                card: "bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-300/50 shadow-xl p-6",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                socialButtonsBlockButton: "bg-slate-800 border-slate-600 text-white hover:bg-slate-700 transition-colors rounded-lg",
                dividerLine: "bg-slate-300",
                dividerText: "text-slate-600",
                formFieldLabel: "text-slate-700 font-medium",
                formFieldInput: "bg-white/80 text-slate-800 border-slate-300 focus:border-slate-500 focus:ring-slate-500 rounded-lg",
                footerActionLink: "text-slate-700 hover:text-slate-800 font-medium",
                formButtonPrimary: "bg-slate-800 hover:bg-slate-700 text-white transition-colors rounded-lg font-medium",
                footer: "text-slate-600",
                footerActionText: "text-slate-600",
                identityPreviewText: "text-slate-700",
                identityPreviewEditButton: "text-slate-700 hover:text-slate-800",
              },
            }}
        />
      </div>
    </div>
  );
} 