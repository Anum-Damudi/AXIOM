export const USERS = {
  "admin@nexus.com": {
    name: "Admin User",
    role: "investigator"
  },
  "lead@nexus.com": {
    name: "Lead Investigator",
    role: "investigator"
  },
  "investigator@nexus.com": {
    name: "Investigator",
    role: "investigator"
  }
};

export const DEMO_USERS = [
  {
    id: 'USR-001',
    name: 'Insp. Arjun K.',
    initials: 'AK',
    email: 'arjun@nexus.com',
    password: 'admin123',
    role: 'investigator',
    roleLabel: 'Lead Investigator',
    department: 'Cybercrime Division',
    status: 'Online',
    lastLogin: null,
  },
  {
    id: 'USR-002',
    name: 'DCP Meera S.',
    initials: 'MS',
    email: 'meera@nexus.com',
    password: 'admin123',
    role: 'investigator',
    roleLabel: 'Deputy Commissioner',
    department: 'Organized Crime',
    status: 'Online',
    lastLogin: null,
  },
  {
    id: 'USR-003',
    name: 'ACP Vikram R.',
    initials: 'VR',
    email: 'vikram@nexus.com',
    password: 'admin123',
    role: 'investigator',
    roleLabel: 'Assistant Commissioner',
    department: 'Intelligence Bureau',
    status: 'Away',
    lastLogin: null,
  },
  {
    id: 'USR-004',
    name: 'Insp. Priya D.',
    initials: 'PD',
    email: 'priya@nexus.com',
    password: 'admin123',
    role: 'investigator',
    roleLabel: 'Investigator',
    department: 'Financial Crimes',
    status: 'Offline',
    lastLogin: null,
  },
  {
    id: 'USR-005',
    name: 'Admin User',
    initials: 'AU',
    email: 'admin@nexus.com',
    password: 'admin123',
    role: 'admin',
    roleLabel: 'System Administrator',
    department: 'Platform Administration',
    status: 'Online',
    lastLogin: null,
  },
];

export function sanitizeUser(user) {
  const { password, ...safe } = user
  return safe
}

export const getNavByRole = () => [
  { id: "dashboard", label: "Dashboard", icon: "home" },
  { id: "cases", label: "Cases", icon: "briefcase" },
  { id: "suspects", label: "Suspects", icon: "users" },
  { id: "evidence", label: "Evidence", icon: "shield" },
  { id: "intelligence", label: "Intelligence", icon: "activity" },
  { id: "network", label: "Network Analysis", icon: "network" },
  { id: "reports", label: "Reports", icon: "fileText" },
  { id: "analytics", label: "Analytics", icon: "chart" },
  { id: "map", label: "Map View", icon: "map" },
  { id: "settings", label: "Settings", icon: "settings" }
];
