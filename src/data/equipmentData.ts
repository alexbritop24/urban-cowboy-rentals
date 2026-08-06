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
import bauer65JDemolitionHammerImage from "../assets/equipment/bauer-65j-demolition-hammer.jpg";
import rawmaxxDtx24TiltDeckImage from "../assets/equipment/rawmaxx-dtx-24-tilt-deck.jpg";

import type { EquipmentItem } from "../types/equipment";
import { getCatalogMetadata } from "./catalogContract";

export const equipmentData: readonly EquipmentItem[] = [
  {
    ...getCatalogMetadata("bobcat-t550-skid-steer"),
    startingPrice: 120,
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
      { label: "1 Day", price: 120 },
      { label: "1 Week", price: 1000 },
      { label: "2 Weeks", price: 2000 },
      { label: "4 Weeks", price: 2800 },
    ],
  },
  {
    ...getCatalogMetadata("bobcat-e35r2-compact-excavator"),
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
  },
  {
    ...getCatalogMetadata("lamar-telescopic-dump-9-ton"),
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
    ...getCatalogMetadata("rawmax-tilt-deck-22"),
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
  },
  {
    ...getCatalogMetadata("rawmaxx-dtx-24-tilt-deck"),
    startingPrice: 150,
    image: rawmaxxDtx24TiltDeckImage,
    description:
      "Heavy-duty RawMaxx DTX 24’ tilt deck trailer built for hauling equipment, vehicles, materials, and jobsite loads.",
    specs: [
      "16,000 lb GVWR",
      "24’ tilt deck",
      "83” wide",
      "Tandem 7K axles",
      "Rubrail and stake pockets",
      "Full power tilt deck",
      "LED lighting package",
      "Adjustable coupler",
    ],
    rates: [
      { label: "1 Day", price: 150 },
      { label: "1 Week", price: 800 },
      { label: "4 Weeks", price: 2000 },
    ],
  },
  {
    ...getCatalogMetadata("utility-trailer"),
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
    ...getCatalogMetadata("scissor-lift"),
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
    ...getCatalogMetadata("hercules-sds-max-demolition-hammer"),
    startingPrice: 50,
    image: herculesHammerDrillImage,
    description:
      "Hercules 14.5 Amp SDS-MAX demolition hammer built for concrete breaking, chiseling, and tough demolition jobs.",
    specs: [
      "Model: HE36",
      "14.5 Amp",
      "23 lb operating weight",
      "1,900 BPM",
      "SDS-MAX chuck",
      "Variable-speed control",
      "Maximum vibration control",
      "360° auxiliary handle",
      "Heavy-duty storage case included",
      "Chisels sold separately",
      "$100 refundable security deposit",
    ],
    rates: [
      { label: "1 Day", price: 50 },
      { label: "1 Week", price: 200 },
      { label: "4 Weeks", price: 600 },
    ],
  },
  {
    ...getCatalogMetadata("bauer-65j-demolition-hammer"),
    startingPrice: 50,
    image: bauer65JDemolitionHammerImage,
    description:
      "Heavy-duty Bauer demolition hammer for breaking concrete, asphalt, rock, and other demanding demolition work.",
    specs: [
      "65 Joules impact energy",
      "120V / 15 Amp",
      "1-1/8 in. Hex shank",
      "1,400 BPM",
      "63 lb operating weight",
      "Includes point chisel",
      "Low vibration technology",
    ],
    rates: [
      { label: "1 Day", price: 50 },
      { label: "1 Week", price: 200 },
      { label: "4 Weeks", price: 600 },
    ],
  },
  {
    ...getCatalogMetadata("plate-compactor"),
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
    ...getCatalogMetadata("wacker-rd12-roller"),
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
    ...getCatalogMetadata("kobalt-hand-tamper"),
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
  {
    ...getCatalogMetadata("harley-road-glide-2003"),
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
    ...getCatalogMetadata("harley-fld-switchback-2012"),
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
];

export const equipmentCategories = [
  "All",
  "Heavy Equipment",
  "Trailers",
  "Tools",
  "Motorcycles",
] as const;
