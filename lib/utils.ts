import { v4 as uuidv4 } from 'uuid';

// Generate a unique room code (4-6 uppercase characters)
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Generate a device ID (stored in localStorage)
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') {
    return uuidv4();
  }
  
  let deviceId = localStorage.getItem('popqiz_device_id');
  if (!deviceId) {
    deviceId = uuidv4();
    localStorage.setItem('popqiz_device_id', deviceId);
  }
  return deviceId;
}

// Team colors from UX.md (database enum values)
export const TEAM_COLORS = ['yellow', 'teal', 'red', 'orange', 'light-blue', 'pink', 'lime', 'white'] as const;
export type TeamColor = typeof TEAM_COLORS[number] | string; // Allow string for database values

// Team names (fun AI-generated names) - 100 total
export const TEAM_NAMES = [
  'Team Thunderbolts',
  'Team Starlights',
  'Team Fireflies',
  'Team Moonbeams',
  'Team Sunbeams',
  'Team Comets',
  'Team Nebulas',
  'Team Galaxies',
  'Team Meteors',
  'Team Auroras',
  'Team Phoenix',
  'Team Dragons',
  'Team Warriors',
  'Team Champions',
  'Team Legends',
  'Team Titans',
  'Team Eagles',
  'Team Lions',
  'Team Sharks',
  'Team Wolves',
  'Team Panthers',
  'Team Falcons',
  'Team Hawks',
  'Team Ravens',
  'Team Owls',
  'Team Bears',
  'Team Tigers',
  'Team Jaguars',
  'Team Cheetahs',
  'Team Leopards',
  'Team Rhinos',
  'Team Elephants',
  'Team Giraffes',
  'Team Zebras',
  'Team Monkeys',
  'Team Gorillas',
  'Team Pandas',
  'Team Koalas',
  'Team Penguins',
  'Team Dolphins',
  'Team Whales',
  'Team Orcas',
  'Team Seals',
  'Team Otters',
  'Team Beavers',
  'Team Squirrels',
  'Team Rabbits',
  'Team Foxes',
  'Team Badgers',
  'Team Raccoons',
  'Team Chipmunks',
  'Team Hedgehogs',
  'Team Sloths',
  'Team Anteaters',
  'Team Armadillos',
  'Team Kangaroos',
  'Team Wallabies',
  'Team Wombats',
  'Team Platypus',
  'Team Emus',
  'Team Ostriches',
  'Team Flamingos',
  'Team Peacocks',
  'Team Parrots',
  'Team Toucans',
  'Team Hummingbirds',
  'Team Robins',
  'Team Bluebirds',
  'Team Cardinals',
  'Team Finches',
  'Team Sparrows',
  'Team Kingfishers',
  'Team Woodpeckers',
  'Team Magpies',
  'Team Crows',
  'Team Jays',
  'Team Mockingbirds',
  'Team Wrens',
  'Team Thrushes',
  'Team Larks',
  'Team Canaries',
  'Team Doves',
  'Team Pigeons',
  'Team Starlings',
  'Team Grackles',
  'Team Orioles',
  'Team Tanagers',
  'Team Warblers',
  'Team Vireos',
  'Team Flycatchers',
  'Team Chickadees',
  'Team Buntings',
  'Team Gnatcatchers',
  'Team Kinglets',
  'Team Waxwings',
  'Team Herons',
  'Team Egrets',
  'Team Pelicans',
  'Team Cormorants',
  'Team Gulls',
];

// Get team color hex value
export function getTeamColorHex(color: string): string {
  const colorMap: Record<string, string> = {
    'yellow': '#FDBA2D',
    'teal': '#2EC4D6',
    'red': '#E63946',
    'orange': '#F77F00',
    'light-blue': '#7ED6DF',
    'light_blue': '#7ED6DF', // Handle underscore variant
    'pink': '#FF85C0',
    'lime': '#B6E600',
    'white': '#FFFFFF',
  };
  return colorMap[color] || '#6366F1'; // Default to brand color
}

// Assign team color and name based on existing players
export function assignTeamColorAndName(existingPlayers: Array<{ team_color: string; team_name: string }>): { color: TeamColor; name: string } {
  const usedColors = new Set(existingPlayers.map(p => p.team_color));
  const usedNames = new Set(existingPlayers.map(p => p.team_name));
  
  // Find available colors
  const availableColors = TEAM_COLORS.filter(c => !usedColors.has(c));
  
  // Randomly select from available colors, or cycle through all if all are used
  let color: TeamColor;
  if (availableColors.length > 0) {
    color = availableColors[Math.floor(Math.random() * availableColors.length)];
  } else {
    // All colors used, cycle through them randomly
    color = TEAM_COLORS[Math.floor(Math.random() * TEAM_COLORS.length)];
  }
  
  // Find available names (not used in this room)
  const availableNames = TEAM_NAMES.filter(n => !usedNames.has(n));
  
  // Randomly select from available names
  let name: string;
  if (availableNames.length > 0) {
    name = availableNames[Math.floor(Math.random() * availableNames.length)];
  } else {
    // All names used in this room, create a numbered variant
    // Pick a random base name and add a number
    const baseName = TEAM_NAMES[Math.floor(Math.random() * TEAM_NAMES.length)];
    let nameIndex = 1;
    while (usedNames.has(`${baseName} ${nameIndex}`)) {
      nameIndex++;
    }
    name = `${baseName} ${nameIndex}`;
  }
  
  return { color, name };
}

