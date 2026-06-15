import { SignInButton, SignedIn, SignedOut } from "@clerk/clerk-react";
import { ShieldCheck } from "lucide-react";
import React from "react";

export default function AuthGate({ children }) {
  return (
    <>
      <SignedOut>
        <main className="auth-screen">
          <section className="auth-panel">
            <img src="/reclaimit-logo.png" alt="ReclaimIt" />
            <div>
              <span className="eyebrow">Admin Portal</span>
              <h1>ReclaimIt control room</h1>
              <p>Sign in to manage institutions, reports, users, and more.</p>
            </div>
            <SignInButton mode="modal">
              <button className="primary-button">
                <ShieldCheck size={17} /> Sign in
              </button>
            </SignInButton>
          </section>
        </main>
      </SignedOut>
      <SignedIn>{children}</SignedIn>
    </>
  );
}
