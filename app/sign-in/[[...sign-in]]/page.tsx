import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-purple-400">Welcome to Ohm</h1>
          <p className="text-gray-400 mt-2">AI-first video conferencing</p>
        </div>
        <SignIn 
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "bg-gray-900 border border-gray-700",
              headerTitle: "text-white",
              headerSubtitle: "text-gray-400",
              socialButtonsBlockButton: "bg-gray-800 border-gray-600 text-white hover:bg-gray-700",
              dividerLine: "bg-gray-600",
              dividerText: "text-gray-400",
              formFieldLabel: "text-gray-300",
              formFieldInput: "bg-gray-800 text-white border-gray-600",
              footerActionLink: "text-purple-400 hover:text-purple-300",
              formButtonPrimary: "bg-purple-600 hover:bg-purple-700 text-white",
              footer: "text-gray-400",
              footerActionText: "text-gray-400",
            },
          }}
        />
      </div>
    </div>
  );
} 