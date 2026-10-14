// Public contact data shown in the site footer and in every email footer. `''` means "not shown".
export type ContactInfo = {
  address: string;
  hours: string;
  whatsapp: string;
  instagram: string;
  email: string;
  mapsUrl: string;
};

// Contact data plus the address that receives the staff notifications (never public).
export type StaffContactInfo = ContactInfo & { staffNotificationsEmail: string };
