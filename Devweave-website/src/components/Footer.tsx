import React from 'react';
import { Globe } from 'lucide-react';
import { FooterColumn, type FooterLink } from './FooterColumn';
import { SocialButton } from './SocialButton';

// Custom SVG Icons for Social Links
const GithubIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

const LinkedinIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

const XTwitterIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
    <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
  </svg>
);

const DiscordIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M18 6h0a14 14 0 0 0-4-1.5 10 10 0 0 0-.5 1 13 13 0 0 0-3 0 10 10 0 0 0-.5-1A14 14 0 0 0 6 6a15 15 0 0 0-2 8.5 15 15 0 0 0 4.5 2.5 11 11 0 0 0 1-1.5 9 9 0 0 1-1.5-.8 1 1 0 0 1 .3-.2 10 10 0 0 0 7.4 0 1 1 0 0 1 .3.2 9 9 0 0 1-1.5.8 11 11 0 0 0 1 1.5 15 15 0 0 0 4.5-2.5A15 15 0 0 0 18 6z" />
    <circle cx="9.5" cy="11.5" r="1" fill="currentColor" />
    <circle cx="14.5" cy="11.5" r="1" fill="currentColor" />
  </svg>
);

const PRODUCT_LINKS: FooterLink[] = [
  { label: 'Platform', href: '#architecture' },
  { label: 'Features', href: '#features' },
  { label: 'Integrations', href: '#integrations' },
  { label: 'AI Assistant', href: '#ai-assistant' },
  { label: 'Roadmap', href: '#roadmap' },
];

const RESOURCES_LINKS: FooterLink[] = [
  { label: 'Documentation', href: '#docs' },
  { label: 'API Reference', href: '#api' },
  { label: 'Developer Guide', href: '#guide' },
  { label: 'Blog', href: '#blog' },
  { label: 'Release Notes', href: '#releases' },
];

const COMPANY_LINKS: FooterLink[] = [
  { label: 'About', href: '#about' },
  { label: 'Careers', href: '#careers' },
  { label: 'Contact', href: '#contact' },
  { label: 'Privacy Policy', href: '#privacy' },
  { label: 'Terms of Service', href: '#terms' },
];

const SOCIAL_LINKS = [
  { label: 'GitHub', href: 'https://github.com', icon: GithubIcon },
  { label: 'LinkedIn', href: 'https://linkedin.com', icon: LinkedinIcon },
  { label: 'X (Twitter)', href: 'https://x.com', icon: XTwitterIcon },
  { label: 'Discord', href: 'https://discord.com', icon: DiscordIcon },
];

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-black text-white border-t border-white/10 pt-16 pb-24 md:py-20 relative z-10 select-none">
      
      {/* Container */}
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Main Grid: 4 Columns (Desktop) / 1 Column (Mobile) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 md:gap-12 mb-16">
          
          {/* Column 1: Brand & Description (Spans 2 cols on Desktop) */}
          <div className="lg:col-span-2 flex flex-col items-start pr-0 lg:pr-8">
            <div className="flex items-center gap-2 mb-4 group cursor-pointer">
              <div className="p-1.5 rounded-full bg-white/5 border border-white/10 group-hover:border-white/20 transition-colors">
                <Globe className="w-6 h-6 text-white group-hover:rotate-12 transition-transform duration-500" />
              </div>
              <span className="font-semibold text-xl text-white tracking-tight">
                DevWeave
              </span>
            </div>

            <p className="text-white/60 text-sm leading-relaxed max-w-sm font-normal mb-6">
              DevWeave is the intelligent Internal Developer Platform that unifies development, deployment, monitoring, and AI into one seamless engineering experience.
            </p>

            {/* Social Links Row */}
            <div className="flex items-center gap-3">
              {SOCIAL_LINKS.map((social) => (
                <SocialButton
                  key={social.label}
                  label={social.label}
                  href={social.href}
                  icon={social.icon}
                />
              ))}
            </div>
          </div>

          {/* Column 2: Product */}
          <FooterColumn title="Product" links={PRODUCT_LINKS} />

          {/* Column 3: Resources */}
          <FooterColumn title="Resources" links={RESOURCES_LINKS} />

          {/* Column 4: Company */}
          <FooterColumn title="Company" links={COMPANY_LINKS} />

        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between text-xs text-white/50 gap-4">
          <p>© 2026 DevWeave. All rights reserved.</p>
          <p className="text-white/40">Built for modern engineering teams.</p>
        </div>

      </div>
    </footer>
  );
};
