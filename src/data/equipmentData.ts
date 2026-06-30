import bauerBreakerJackHammerImage from "../assets/equipment/bauer-breaker-jack-hammer.jpg";
import bobcatT550Image from "../assets/equipment/bobcat-t550-skid-steer-1.jpg";
import dumpTrailerImage from "../assets/equipment/dump-trailer-1.jpg";
import equipmentTrailerImage from "../assets/equipment/equipment-trailer.jpg";
import harleyRoadGlideImage from "../assets/equipment/harley-road-glide.jpg";
import harleySwitchbackImage from "../assets/equipment/harley-switchback.jpg";
import herculesHammerDrillImage from "../assets/equipment/hercules-hammer-drill-1.jpg";
import miniExcavatorImage from "../assets/equipment/mini-excavator-1.jpg";
import scissorLiftImage from "../assets/equipment/scissor-lift.jpg";
import utilityTrailerImage from "../assets/equipment/utility-trailer.jpg";
import plateCompactorImage from "../assets/equipment/plate-compactor-1.jpg";
import wackerRd12RollerImage from "../assets/equipment/wacker-rd12-roller-1.jpg";
import kobaltHandTamperImage from "../assets/equipment/kobalt-hand-tamper-1.jpg";

import type { EquipmentItem } from "../types/equipment";

export const equipmentData: EquipmentItem[] = [
  {
    id: "bobcat-t550-skid-steer",
    name: "2025 Bobcat T550 Skid Steer",
    category: "Heavy Equipment",
    startingPrice: 225,
    image: bobcatT550Image,
    description:
      "Compact track skid steer built for grading, loading, clearing, and heavy jobsite work.",
    specs: [
      "Weight: 7,557 lbs",
      "Width: 67” without bucket / 68” with bucket",
      "Height: 77.8”",
      "Length: 104.5” / 133” with bucket",
      "68” heavy duty grading bucket",
    ],
    rates: [
      { label: "4hr", price: 225 },
      { label: "1 Day", price: 275 },
      { label: "1 Week", price: 1000 },
      { label: "2 Weeks", price: 2000 },
      { label: "4 Weeks", price: 2800 },
    ],
    featured: true,
  },
  {
    id: "bobcat-e35r2-compact-excavator",
    name: "2025 Bobcat E35R2 Compact Excavator",
    category: "Heavy Equipment",
    startingPrice: 225,
    image: miniExcavatorImage,
    description:
      "Compact diesel excavator with long arm reach and optional bucket attachments for digging, trenching, and grading.",
    specs: [
      "Weight: 7,659 lbs",
      "Width: 69.7”",
      "Height with cab: 96.2”",
      "Length: 190”",
      "Diesel",
      "Maximum reach: 215.8”",
      "Lift radius: 118”",
      "Boom swing: left 75° / right 55°",
    ],
    rates: [
      { label: "4hr", price: 225 },
      { label: "1 Day", price: 275 },
      { label: "1 Week", price: 1000 },
      { label: "2 Weeks", price: 2000 },
      { label: "3 Weeks", price: 2400 },
      { label: "4 Weeks", price: 2800 },
    ],
    addOns: [
      '12” bucket with teeth: 1 Day $25 / 1 Week $65 / 4 Weeks $175',
      '24” bucket with teeth: 1 Day $25 / 1 Week $65 / 4 Weeks $175',
      '48” grading bucket: 1 Day $30 / 1 Week $90 / 4 Weeks $220',
    ],
    featured: true,
  },
  {
    id: "lamar-telescopic-dump-9-ton",
    name: "2025 Lamar Telescopic Dump 9 Ton Trailer",
    category: "Trailers",
    startingPrice: 130,
    image: dumpTrailerImage,
    description:
      "9 ton telescopic dump trailer for hauling dirt, gravel, debris, and jobsite materials.",
    specs: ["Weight: 3,200 lbs", "Width: 7’", "Height: 48”", "Length: 16’"],
    rates: [
      { label: "4hr", price: 130 },
      { label: "1 Day", price: 175 },
      { label: "1 Week", price: 900 },
      { label: "2 Weeks", price: 1800 },
      { label: "3 Weeks", price: 2100 },
      { label: "4 Weeks", price: 2400 },
    ],
  },
  {
    id: "rawmax-tilt-deck-22",
    name: "2025 RawMax Tilt Deck 22’",
    category: "Trailers",
    startingPrice: 125,
    image: equipmentTrailerImage,
    description:
      "Heavy-duty tilt deck trailer with a 17,000 lb waterproof winch for equipment and vehicle hauling.",
    specs: [
      "Weight: 4,150 lbs",
      "Length: 22’",
      "Width: 7’ / 84”",
      "SmittyBilt X2O-17.5K waterproof 17,000 lb winch",
    ],
    rates: [
      { label: "4hr", price: 125 },
      { label: "1 Day", price: 150 },
      { label: "2 Days", price: 300 },
      { label: "1 Week", price: 600 },
      { label: "2 Weeks", price: 1200 },
      { label: "4 Weeks", price: 1800 },
    ],
    featured: true,
  },
  {
    id: "utility-trailer",
    name: "Utility Trailer",
    category: "Trailers",
    startingPrice: 75,
    image: utilityTrailerImage,
    description:
      "Open utility trailer for hauling equipment, tools, landscaping materials, and light-duty cargo.",
    specs: [
      "Open deck utility trailer",
      "Rear ramp gate",
      "Steel frame",
      "Wood deck",
      "Ideal for light-duty hauling",
    ],
    rates: [
      { label: "4hr", price: 75 },
      { label: "1 Day", price: 100 },
      { label: "1 Week", price: 450 },
      { label: "2 Weeks", price: 850 },
      { label: "4 Weeks", price: 1500 },
    ],
  },
  {
    id: "scissor-lift",
    name: "Electric Scissor Lift",
    category: "Heavy Equipment",
    startingPrice: 140,
    image: scissorLiftImage,
    description:
      "Electric scissor lift designed for elevated indoor and outdoor construction, maintenance, and warehouse access work.",
    specs: [
      "Working height: 26 ft",
      "Electric powered",
      "Indoor / outdoor use",
      "Non-marking tires",
      "Compact maneuverability",
    ],
    rates: [
      { label: "1 Day", price: 140 },
      { label: "1 Week", price: 700 },
      { label: "2 Weeks", price: 1300 },
      { label: "4 Weeks", price: 2400 },
    ],
  },
  {
    id: "hercules-hammer-drill",
    name: "Hercules Hammer Drill",
    category: "Tools",
    startingPrice: 60,
    image: herculesHammerDrillImage,
    description:
      "12 Amp SDS-MAX rotary hammer drill with variable speed and vibration control.",
    specs: [
      "12 Amp",
      "1-9/16 in. SDS-MAX type",
      "Variable-speed rotary hammer",
      "Maximum vibration control",
      "Weight: 23 lbs",
      "Height: 11 1/8”",
      "Width: 4 3/8”",
      "Length: 22”",
    ],
    rates: [
      { label: "1 Day", price: 60 },
      { label: "1 Week", price: 280 },
      { label: "2 Weeks", price: 560 },
      { label: "3 Weeks", price: 1000 },
      { label: "4 Weeks", price: 1200 },
    ],
  },
  {
    id: "bauer-breaker-jack-hammer",
    name: "Bauer Breaker Jack Hammer",
    category: "Tools",
    startingPrice: 60,
    image: bauerBreakerJackHammerImage,
    description:
      "Heavy-duty breaker jack hammer for demolition, concrete breaking, and removal work.",
    specs: [
      "Weight: 70 lbs",
      "16’ power cord",
      "120 VAC / 60 Hz / 15A",
      "Accepts 1-1/8” / 28mm hex steel",
      "Heavy duty bit retainer",
    ],
    rates: [{ label: "1 Day", price: 60 }],
  },
  {
    id: "harley-road-glide-2003",
    name: "2003 Harley Davidson Road Glide",
    category: "Motorcycles",
    startingPrice: 180,
    image: harleyRoadGlideImage,
    description:
      "Classic Harley Davidson Road Glide built for comfortable rides, open-road cruising, and weekend adventure.",
    specs: [
      "Length: 93.7”",
      "Width: 35.8”",
      "Height: 29.5”",
      "Weight: 761 lbs",
      "Wheelbase: 63.5”",
      "Ground clearance: 5.1”",
      "Fuel capacity: 5 gallons",
    ],
    rates: [
      { label: "1 Day", price: 180 },
      { label: "1 Week", price: 980 },
      { label: "2 Weeks", price: 1680 },
      { label: "3 Weeks", price: 2520 },
      { label: "4 Weeks", price: 3300 },
    ],
  },
  {
    id: "harley-fld-switchback-2012",
    name: "2012 Harley Davidson FLD Switchback",
    category: "Motorcycles",
    startingPrice: 130,
    image: harleySwitchbackImage,
    description:
      "Harley Davidson FLD Switchback rental for day rides, trips, and open-road use.",
    specs: [
      "Length: 92.8”",
      "Seat height laden: 26.1”",
      "Seat height unladen: 27.4”",
      "Wheelbase: 62.8”",
      "Ground clearance: 4.3”",
      "Fuel capacity: 4.7 gallons",
      "Running order weight: 718 lbs",
    ],
    rates: [
      { label: "4hr", price: 150 },
      { label: "1 Day", price: 130 },
      { label: "1 Week", price: 600 },
      { label: "2 Weeks", price: 1100 },
      { label: "3 Weeks", price: 1600 },
      { label: "4 Weeks", price: 2000 },
    ],
  },

  {
  id: "plate-compactor",
  name: "Central Machinery Plate Compactor",
  category: "Tools",
  startingPrice: 60,
  image: plateCompactorImage,
  description:
    "Gas-powered plate compactor for soil, gravel, asphalt, pavers, and base preparation.",
  specs: [
    "7 HP gas engine",
    "212cc Predator engine",
    "Heavy-duty steel construction",
    "Fold-up handle and wheel kit",
    "Ideal for soil, gravel, asphalt and pavers",
  ],
  rates: [
    { label: "1 Day", price: 60 },
    { label: "1 Week", price: 280 },
    { label: "4 Weeks", price: 900 },
  ],
},
{
  id: "wacker-rd12-roller",
  name: "Wacker Neuson RD12 Roller",
  category: "Heavy Equipment",
  startingPrice: 180,
  image: wackerRd12RollerImage,
  description:
    "Ride-on vibratory roller for asphalt, gravel and soil compaction.",
  specs: [
    "Operating weight: 8,623 lbs",
    "Drum width: 47.2 in",
    "Travel speed: up to 7.1 mph",
    "Diesel engine",
    "Articulated steering",
  ],
  rates: [
    { label: "1 Day", price: 180 },
    { label: "1 Week", price: 800 },
    { label: "4 Weeks", price: 1800 },
  ],
},
{
  id: "kobalt-hand-tamper",
  name: "Kobalt 10×10 Hand Tamper",
  category: "Tools",
  startingPrice: 10,
  image: kobaltHandTamperImage,
  description:
    "Manual steel tamper for compacting soil, gravel, pavers and landscaping projects.",
  specs: [
    '10" × 10" steel head',
    "13.6 lbs",
    "Heavy-duty steel construction",
    "Cushioned grip",
    "Ideal for pavers, sod and trench backfill",
  ],
  rates: [
    { label: "1 Day", price: 10 },
    { label: "1 Week", price: 40 },
    { label: "4 Weeks", price: 120 },
  ],
},




];




export const equipmentCategories = [
  "All",
  "Heavy Equipment",
  "Trailers",
  "Tools",
  "Motorcycles",
] as const;