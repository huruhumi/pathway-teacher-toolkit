import { Clock, BookOpen, Sun, CloudRain, Microscope, Palette, Theater, Utensils, Hammer, Calculator, Globe, Coins, Music } from 'lucide-react';

export const ACTIVITY_FOCUS_OPTIONS = [
  { id: 'biology', label: 'Biology & Ecology', icon: Microscope },
  { id: 'physics', label: 'Physics & Forces', icon: Hammer },
  { id: 'chemistry', label: 'Chemistry & Matter', icon: Utensils },
  { id: 'engineering', label: 'Engineering & Design', icon: Hammer },
  { id: 'earth', label: 'Earth & Space', icon: Globe },
  { id: 'math', label: 'Math & Logic', icon: Calculator },
  { id: 'art', label: 'Visual Arts', icon: Palette },
  { id: 'theater', label: 'Theater & Drama', icon: Theater },
  { id: 'music', label: 'Music & Sound', icon: Music },
  { id: 'social', label: 'Social Science', icon: Globe },
  { id: 'economy', label: 'Economy & Trade', icon: Coins },
];

export const AGE_RANGES = [
  "6-8 years (Early Primary)",
  "9-10 years (Middle Primary)",
  "11-12 years (Late Primary)"
];

export const CEFR_LEVELS = [
  "Pre-A1 (Absolute Beginner)",
  "A1 (Beginner)",
  "A2 (Elementary)",
  "B1 (Intermediate)",
  "B2 (Upper Intermediate)"
];

export const SAMPLE_THEMES = [
  // Module 1: Living Systems (Biology/Ecology)
  "The Honeybee Kingdom: Pollination & Society",
  "Underground Architects: The Secret Life of Ants",
  "Photosynthesis Wizards: How Plants Eat Light",
  "The Mushroom Network: Nature's Internet",
  "Bird Song Symphony: Communication in the Canopy",
  
  // Module 2: Physical World (Physics/Chemistry)
  "The Secret Life of Flour: Chemistry of Baking",
  "Wind Chasers: Harnessing Kinetic Energy",
  "Water's Magic Tricks: States of Matter & Surface Tension",
  "The Gravity Games: Falling, Floating, & Flying",
  "Color Alchemists: Extracting Pigments from Nature",
  
  // Module 3: Earth & Space (Geology/Astronomy)
  "The Water Cycle Expedition: From Puddle to Cloud",
  "Rock Detectives: Reading the Earth's History",
  "Mars Rover: Backyard Edition (Robotics & Space)",
  "Lunar Legends: Phases of the Moon & Tides",
  "Soil Superheroes: The Foundation of Life",
  
  // Module 4: Engineering & Design
  "Bridge Builders of the Forest: Structural Integrity",
  "Bio-Mimicry Lab: Designing Like Nature",
  "The Solar Oven Challenge: Harnessing the Sun",
  "Wilderness Shelter: Engineering for Survival",
  "Paper Plane Pilots: Aerodynamics in Action"
];

export const SEASONS = [
  "Spring",
  "Summer",
  "Autumn",
  "Winter"
];