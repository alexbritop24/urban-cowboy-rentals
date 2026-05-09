import { useMemo, useState } from "react";

import MainLayout from "../components/layout/MainLayout";
import CategoryFilter from "../components/equipment/CategoryFilter";
import EquipmentGrid from "../components/equipment/EquipmentGrid";

import { equipmentCategories, equipmentData } from "../data/equipmentData";

import type { EquipmentCategory } from "../types/equipment";

type FilterCategory = "All" | EquipmentCategory;

const EquipmentPage = () => {
  const [activeCategory, setActiveCategory] =
    useState<FilterCategory>("All");

  const filteredEquipment = useMemo(() => {
    if (activeCategory === "All") {
      return equipmentData;
    }

    return equipmentData.filter(
      (item) => item.category === activeCategory
    );
  }, [activeCategory]);

  return (
    <MainLayout>
      <section className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.35em] text-[#f4b000]">
              Rental Catalog
            </p>

            <h1 className="mt-5 text-5xl font-black tracking-tight text-[#fff7ed] md:text-7xl">
              Equipment ready for the jobsite, haul, or open road.
            </h1>

            <p className="mt-6 text-lg leading-relaxed text-[#b8a99a]">
              Browse heavy equipment, trailers, tools, and motorcycles.
              Choose what you need, review the rates, and submit a rental
              request.
            </p>
          </div>

          <div className="mt-12">
            <CategoryFilter
              categories={equipmentCategories}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
            />
          </div>

          <div className="mt-12">
            <EquipmentGrid equipment={filteredEquipment} />
          </div>
        </div>
      </section>
    </MainLayout>
  );
};

export default EquipmentPage;