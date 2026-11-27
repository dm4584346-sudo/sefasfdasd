export const HERO_OPTIONS = ['Chaos Knight','Skywrath Mage','Centaur Warrunner','Axe','Underlord','Tusk','Rubick','Hoodwink','Dazzle','Mars','Puck','Slardar','Clockwerk','Lion','Disruptor','Oracle','Shadow Shaman','Dark Seer','Dawnbreaker','Earthshaker'];
export const ITEM_CHOICES = [
  { name:'Black King Bar', problem:'Magic damage, disables and the need to keep acting during a fight.', alternative:'A defensive dispel or positioning-focused option may be better when control is avoidable or physical damage is the real threat.', caveat:'Check current spell interactions and patch notes before treating this as a universal answer.' },
  { name:'Blink Dagger', problem:'You need reliable access to a target or a faster way to start a fight.', alternative:'A survivability or utility item can be better if you die before getting a second spell cycle.', caveat:'Initiation value depends on vision, enemy counter-initiation and your team being in range.' },
  { name:'Heaven’s Halberd', problem:'An enemy right-click core is deciding fights and your team needs a way to disrupt their attack window.', alternative:'Armor, a save, or a hard disable may offer more if the threat is not attack-based.', caveat:'Verify current disarm rules and immunity interactions for the active patch.' },
  { name:'Pipe of Insight', problem:'Your team is taking substantial spell-based area damage and needs team-wide mitigation.', alternative:'A personal defensive item or initiation tool may be better if damage is focused or the team cannot group.', caveat:'Do not buy it solely because the enemy has several intelligence heroes; identify actual damage sources.' },
  { name:'Force Staff', problem:'You need repositioning, ally rescue or a way to cross terrain and break formation.', alternative:'A dispel or stronger personal save can be more valuable against a specific disable.', caveat:'Check whether the target can be repositioned and whether the enemy can immediately re-engage.' },
  { name:'Lotus Orb', problem:'Targeted spells, dispellable debuffs or armor needs are central to the matchup.', alternative:'A different save or team utility item may fit better when reflected spells are not meaningful.', caveat:'Spell reflection is matchup-specific; inspect the enemy spell list.' },
  { name:'Aghanim’s Shard', problem:'A hero-specific upgrade may change your role or solve a matchup issue.', alternative:'A core stat/utility item may be more reliable if the upgrade does not address the current game.', caveat:'Shard effects are hero- and patch-specific. Verify the current in-game description.' },
  { name:'Glimmer Cape', problem:'You need a save, temporary concealment or a way to help an ally survive focused damage.', alternative:'Force Staff can be better against positioning hazards; other saves may be better against detection or area damage.', caveat:'Account for detection, dust and the current invisibility rules.' },
];
export const DRAFT_HEROES = [
  { name:'Chaos Knight', roles:['Position 1','Position 3'], tags:['single-target','illusion','catch','physical'] },
  { name:'Centaur Warrunner', roles:['Position 3'], tags:['frontline','initiation','team-mobility','durable'] },
  { name:'Axe', roles:['Position 3'], tags:['initiation','frontline','counter-attackers','durable'] },
  { name:'Underlord', roles:['Position 3'], tags:['frontline','area-control','team-mobility','durable'] },
  { name:'Mars', roles:['Position 3'], tags:['initiation','teamfight','area-control','physical'] },
  { name:'Tusk', roles:['Position 4'], tags:['save','catch','initiation','roaming'] },
  { name:'Rubick', roles:['Position 4','Position 5'], tags:['spell-steal','disruption','ranged','teamfight'] },
  { name:'Hoodwink', roles:['Position 4'], tags:['ranged','catch','physical','wave-clear'] },
  { name:'Skywrath Mage', roles:['Position 4','Position 5'], tags:['magic','burst','silence','ranged'] },
  { name:'Dazzle', roles:['Position 5'], tags:['save','sustain','ranged','utility'] },
  { name:'Oracle', roles:['Position 5'], tags:['save','dispel','sustain','ranged'] },
  { name:'Disruptor', roles:['Position 4','Position 5'], tags:['teamfight','catch','silence','ranged'] },
];
