export interface GuestItem {
  id: string;
  nameBn: string;
  nameEn: string;
  honorsBn?: string;
  honorsEn?: string;
  designationBn: string;
  designationEn: string;
}

export interface HighlightItem {
  id: string;
  textBn: string;
  textEn: string;
}

export interface DocumentData {
  uploadsOnly?: boolean;
  translationCorrections?: Record<string, string>;
  templates?: Partial<Record<Exclude<DocumentType, 'dual-invitation' | 'dual-press-release'>, {filename: string; text: string; html?: string}>>;
  // Event basics
  eventTitleBn: string;
  eventTitleEn: string;
  editionBn: string;
  editionEn: string;
  scopeBn: string;
  scopeEn: string;
  organizerBn: string;
  organizerEn: string;

  // Dates & Times
  issueDateBn: string;
  issueDateEn: string;
  eventDateBn: string;
  eventDateEn: string;
  eventDurationBn: string;
  eventDurationEn: string;
  inaugurationTimeBn: string;
  inaugurationTimeEn: string;
  visitingHoursBn: string;
  visitingHoursEn: string;

  // Venue
  venueBn: string;
  venueEn: string;

  // Chief Guest
  chiefGuest: {
    nameBn: string;
    nameEn: string;
    honorsBn: string;
    honorsEn: string;
    designationBn: string;
    designationEn: string;
  };

  // Special Guests
  specialGuests: GuestItem[];

  // Event features / Highlights
  highlights: HighlightItem[];

  // PR Spokesperson / Sender
  sender: {
    nameBn: string;
    nameEn: string;
    designationBn: string;
    designationEn: string;
    organizationBn: string;
    organizationEn: string;
    phone: string;
    email: string;
  };

  // Media recipient
  mediaAddresseeBn: string;
  mediaAddresseeEn: string;
}

export type DocumentType = 
  | 'invitation-bn' 
  | 'invitation-en' 
  | 'press-release-bn' 
  | 'press-release-en' 
  | 'dual-invitation'
  | 'dual-press-release';
