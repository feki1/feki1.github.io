/**
 * TypeScript Type Definitions for Mohamed Seddik Feki's Centralized Portfolio Data Core
 * File: data/portfolio-data.d.ts
 */

export interface ContactInfo {
  email: string;
  phone: string;
  phoneRaw: string;
  phoneSecondary?: string;
  phoneSecondaryRaw?: string;
  whatsapp?: string;
  whatsappUrl: string;
  whatsappUrlSecondary?: string;
  github: string;
  githubUrl: string;
  linkedin: string;
  linkedinUrl: string;
  locationDisplay: string;
}

export interface MobilityBadge {
  id: string;
  label: string;
  sublabel: string;
  icon: 'map-pin' | 'globe' | 'plane' | string;
  highlight: boolean;
}

export interface EducationEntry {
  institution: string;
  degree: string;
  duration: string;
  honors?: string;
  meritScholarship?: string;
  status: string;
  location?: string;
  focusAreas: string[];
  courseworkHighlights: string[];
}

export interface BaccalaureateInfo {
  qualification: string;
  track: string;
  honors: string;
  mathScore: string;
  school: string;
  year?: string;
}

export interface TechnicalSkillsDomain {
  domainId: 'web' | 'mobile' | 'robotics' | 'cloud' | string;
  categoryName: string;
  skills: string[];
}

export interface LanguageEntry {
  language: string;
  nativeName: string;
  proficiency: string;
  levelTag: string;
  cert?: string;
  notes?: string;
}

export interface CertificationEntry {
  title: string;
  issuer: string;
  score: string;
  level: string;
  date: string;
  description: string;
}

export interface ProjectLinks {
  github: string;
  demo?: string;
}

export interface ShowcaseProject {
  id: string;
  title: string;
  fullTitle?: string;
  category: 'web' | 'mobile' | 'robotics' | string;
  categoryLabel: string;
  summary: string;
  techStack: string[];
  highlights: string[];
  metrics?: string;
  links: ProjectLinks;
  featured: boolean;
}

export interface ExperienceEntry {
  role: string;
  organization: string;
  duration: string;
  location: string;
  summary: string;
  achievements: string[];
  technologiesUsed: string[];
}

export interface CommunityEntry {
  organization: string;
  role: string;
  duration: string;
  honors?: string;
  achievements: string[];
}

export interface ServiceOffer {
  id: string;
  title: string;
  icon: string;
  description: string;
  deliverables: string[];
}

export interface CvSettings {
  atsSummary: string;
  targetRoles: string[];
  showContactIconsOnPrint: boolean;
}

export interface PersonalProfile {
  name: string;
  headline: string;
  bioSummary: string;
  location: string;
  contacts: ContactInfo;
  mobilityBadges: MobilityBadge[];
}

export interface EducationCollection extends Array<EducationEntry> {
  institution: string;
  degree: string;
  duration: string;
  honors?: string;
  meritScholarship?: string;
  status: string;
  location?: string;
  focusAreas: string[];
  courseworkHighlights: string[];
}

export interface PortfolioData {
  personal: PersonalProfile;
  mobility: MobilityBadge[];
  education: EducationCollection;
  baccalaureate: BaccalaureateInfo;
  skills: TechnicalSkillsDomain[];
  technicalSkills: TechnicalSkillsDomain[];
  languages: LanguageEntry[];
  certifications: CertificationEntry[];
  projects: ShowcaseProject[];
  showcaseProjects: ShowcaseProject[];
  experience: ExperienceEntry[];
  community: CommunityEntry[];
  services: ServiceOffer[];
  cvSettings: CvSettings;
}

declare const PORTFOLIO_DATA: PortfolioData;

export default PORTFOLIO_DATA;

declare global {
  interface Window {
    PORTFOLIO_DATA: PortfolioData;
  }
}
