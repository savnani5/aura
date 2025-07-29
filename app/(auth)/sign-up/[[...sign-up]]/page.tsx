import { SignUp } from '@clerk/nextjs';
import styles from '@/styles/auth.module.css';

export default function SignUpPage() {
  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <div className={styles.authHeader}>
          <h1 className={styles.authTitle}>Join Ohm</h1>
          <p className={styles.authSubtitle}>Your AI meeting copilot</p>
        </div>
        <div className={styles.clerkWrapper}>
          <SignUp 
            redirectUrl="/"
            signInUrl="/sign-in"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "bg-transparent border-0 shadow-none",
                headerTitle: "text-white text-xl",
                headerSubtitle: "text-gray-400",
                socialButtonsBlockButton: "bg-gray-800 border-gray-600 text-white hover:bg-gray-700 transition-colors",
                dividerLine: "bg-gray-600",
                dividerText: "text-gray-400",
                formFieldLabel: "text-gray-300",
                formFieldInput: "bg-gray-800 text-white border-gray-600 focus:border-purple-500",
                footerActionLink: "text-purple-400 hover:text-purple-300",
                formButtonPrimary: "bg-purple-600 hover:bg-purple-700 text-white transition-colors",
                footer: "text-gray-400",
                footerActionText: "text-gray-400",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
} 