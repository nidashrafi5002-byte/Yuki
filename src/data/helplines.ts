import { VerifiedHelpline } from '../types';

export const VERIFIED_HELPLINES: VerifiedHelpline[] = [
  {
    id: 'hl-112',
    name: 'National Emergency Response (Emergency Helpline)',
    category: 'National Emergency',
    number: '112',
    hours: '24/7 (365 Days)',
    description: 'Unified national emergency helpline integrating Police, Fire, and Ambulance services across India. Supports instant emergency dispatch.',
    region: 'Pan-India (Also US: 911 / UK: 999 / Europe: 112)',
    tollFree: true
  },
  {
    id: 'hl-1091',
    name: 'Women in Distress Helpline',
    category: 'Women Helpline',
    number: '1091',
    hours: '24/7 (365 Days)',
    description: 'Dedicated police assistance and rapid response service for women facing immediate danger, harassment, stalking, or physical threats.',
    region: 'Pan-India',
    tollFree: true
  },
  {
    id: 'hl-ncw-whatsapp',
    name: 'National Commission for Women (NCW) WhatsApp Emergency',
    category: 'Legal & NCW',
    number: '+917827170170',
    whatsapp: '7827170170',
    hours: '24/7 (365 Days)',
    description: 'Official WhatsApp helpline run by the National Commission for Women (NCW) for immediate intervention and reporting of domestic abuse and violence.',
    region: 'National',
    tollFree: true,
    website: 'https://ncw.nic.in'
  },
  {
    id: 'hl-181',
    name: 'Women Helpline & One-Stop Crisis Centres (OSC)',
    category: 'Women Helpline',
    number: '181',
    hours: '24/7',
    description: 'Provides integrated support including medical aid, police assistance, legal guidance, and temporary shelter under the Sakhi scheme.',
    region: 'All States & UTs',
    tollFree: true
  },
  {
    id: 'hl-1930',
    name: 'National Cyber Crime Reporting Portal Helpline',
    category: 'Cyber Crime',
    number: '1930',
    hours: '24/7',
    description: 'Helpline for cyber fraud, non-consensual image sharing (intimate image abuse), online stalking, cyber blackmail, and fake social media profiles.',
    region: 'Pan-India',
    tollFree: true,
    website: 'https://cybercrime.gov.in'
  },
  {
    id: 'hl-1090',
    name: 'Women Power Line (Anti-Stalking)',
    category: 'Women Helpline',
    number: '1090',
    hours: '24/7',
    description: 'Specialized helpline for anonymous reporting of persistent phone harassment, digital stalking, street harassment, and eve-teasing.',
    region: 'Regional / State Police',
    tollFree: true
  },
  {
    id: 'hl-1098',
    name: 'CHILDLINE (Child & Minor Safety)',
    category: 'Child Protection',
    number: '1098',
    hours: '24/7',
    description: 'Emergency assistance, rescue, and rehabilitation for young girls, minors, and teenagers in need of protection from violence or trafficking.',
    region: 'Pan-India',
    tollFree: true
  },
  {
    id: 'hl-kiran',
    name: 'KIRAN Mental Health & Trauma Helpline',
    category: 'Mental Health',
    number: '18005990019',
    hours: '24/7',
    description: 'Free psychosocial support, mental health counseling, panic management, and trauma support for survivors of abuse and distress.',
    region: 'Pan-India (Multiple Languages)',
    tollFree: true
  },
  {
    id: 'hl-rpf-139',
    name: 'Railway Protection Force (RPF) Security Helpline',
    category: 'National Emergency',
    number: '139',
    hours: '24/7',
    description: 'Immediate railway security response for women travelling on trains or present at railway stations facing safety threats.',
    region: 'Indian Railways',
    tollFree: true
  },
  {
    id: 'hl-ncw-domestic',
    name: 'NCW Domestic Violence Complaint Cell',
    category: 'Legal & NCW',
    number: '+911126944754',
    hours: '9:00 AM - 5:30 PM (Mon-Fri)',
    description: 'Official cell of the National Commission for Women for legal counseling, formal complaints, and police escalation against perpetrators.',
    region: 'Central HQ',
    tollFree: false,
    website: 'http://ncw.nic.in'
  }
];
