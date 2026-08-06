import { equipmentData } from "./equipmentData";
import type { EquipmentItem } from "../types/equipment";

export const getBookableEquipment = (): EquipmentItem[] =>
  equipmentData
    .filter((item) => item.status === "active")
    .sort((left, right) => left.catalogOrder - right.catalogOrder);

export const getEquipmentDailyRate = (item: EquipmentItem): number =>
  item.dailyRate;

export const getFeaturedEquipment = (): EquipmentItem[] =>
  getBookableEquipment().filter((item) => item.featured);

export const getEquipmentById = (id: string | undefined): EquipmentItem | undefined =>
  equipmentData.find((item) => item.id === id);
