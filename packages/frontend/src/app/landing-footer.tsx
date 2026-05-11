"use client";

import { BriefcaseBusiness, Camera, MessageCircle, Send } from "lucide-react";
import { motion } from "motion/react";

const footerColumns = [
  {
    title: "Company",
    links: ["Founding", "Platform", "Proof log"],
  },
  {
    title: "Product",
    links: ["Wallet app", "Treasury OS", "Agent API"],
  },
  {
    title: "Controls",
    links: ["Private data", "User consent", "Audit keys"],
  },
] as const;

const socials = [
  { label: "Community", Icon: MessageCircle },
  { label: "Announcements", Icon: Send },
  { label: "Media", Icon: Camera },
  { label: "Business", Icon: BriefcaseBusiness },
] as const;

export function LandingFooter() {
  return (
    <>
      <section className="footer-spacer">
        <motion.span initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ duration: 0.8 }}>
          View below
        </motion.span>
      </section>
      <section className="landing-parallax-footer" id="help">
        <motion.div
          className="footer-card-wrap"
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div className="footer-card">
            <div className="footer-card-top">
              <div className="footer-logo-area">
                <span className="footer-logo-box">
                  <FooterMark />
                </span>
                <strong>ARCPAY</strong>
              </div>
              <div className="footer-link-grid">
                {footerColumns.map((column) => (
                  <div key={column.title}>
                    <h3>{column.title}</h3>
                    {column.links.map((link) => (
                      <a href="#network" key={link}>
                        {link}
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="footer-card-bottom">
              <span>Copyright 2026 ArcPay. All rights reserved.</span>
              <div className="footer-socials">
                {socials.map(({ label, Icon }) => (
                  <a aria-label={label} href="#help" key={label}>
                    <Icon size={20} />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
        <motion.div className="footer-foreground" />
      </section>
    </>
  );
}

function FooterMark() {
  return (
    <svg viewBox="0 0 256 256" aria-hidden="true">
      <path
        fill="currentColor"
        d="M 228 0 C 172.772 0 128 44.772 128 100 L 128 0 L 0 0 L 0 28 C 0 83.228 44.772 128 100 128 L 0 128 L 0 256 L 28 256 C 83.228 256 128 211.228 128 156 L 128 256 L 256 256 L 256 228 C 256 172.772 211.228 128 156 128 L 256 128 L 256 0 Z"
      />
    </svg>
  );
}
