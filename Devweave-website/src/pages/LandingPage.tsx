import React from 'react';
import { BackgroundVideo } from '../components/BackgroundVideo';
import { Navbar } from '../components/Navbar';
import { Hero } from '../components/Hero';
import { Features } from '../components/Features';
import { PlatformArchitecture } from '../components/PlatformArchitecture';
import { IntegrationsSection } from '../components/IntegrationsSection';
import { AISection } from '../components/AISection';
import { CTASection } from '../components/CTASection';
import { Footer } from '../components/Footer';

export const LandingPage: React.FC = () => {
  return (
    <div className="relative w-full min-h-screen bg-black text-white flex flex-col justify-between select-none font-sans antialiased overflow-x-hidden">
      {/* Fullscreen Background Video with JS rAF Fade System */}
      <BackgroundVideo />

      {/* Floating Top Navbar */}
      <Navbar />

      {/* Centered Hero Section */}
      <Hero />

      {/* Features Section */}
      <Features />

      {/* Platform Architecture Centerpiece Section */}
      <PlatformArchitecture />

      {/* Integrations Section */}
      <IntegrationsSection />

      {/* AI Experience Section */}
      <AISection />

      {/* Call To Action Section */}
      <CTASection />

      {/* Premium Minimal Footer */}
      <Footer />
    </div>
  );
};
