import React from 'react';

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterColumnProps {
  title: string;
  links: FooterLink[];
}

export const FooterColumn: React.FC<FooterColumnProps> = ({ title, links }) => {
  return (
    <div className="flex flex-col">
      <h3 className="text-xs uppercase tracking-widest font-semibold text-white/80 mb-4">
        {title}
      </h3>
      <ul className="space-y-2.5">
        {links.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              className="text-sm text-white/60 hover:text-white hover:translate-x-1 transition-all duration-200 inline-block font-normal"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};
