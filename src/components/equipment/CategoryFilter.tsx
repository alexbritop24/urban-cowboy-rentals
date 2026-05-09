import type { EquipmentCategory } from "../../types/equipment";

type FilterCategory = "All" | EquipmentCategory;

interface CategoryFilterProps {
  categories: readonly FilterCategory[];
  activeCategory: FilterCategory;
  onCategoryChange: (category: FilterCategory) => void;
}

const CategoryFilter = ({
  categories,
  activeCategory,
  onCategoryChange,
}: CategoryFilterProps) => {
  return (
    <div className="flex flex-wrap gap-3">
      {categories.map((category) => {
        const isActive = activeCategory === category;

        return (
          <button
            key={category}
            type="button"
            onClick={() => onCategoryChange(category)}
            className={`rounded-full px-5 py-3 text-sm font-black uppercase tracking-[0.08em] transition ${
              isActive
                ? "bg-[#f4b000] text-black"
                : "border border-yellow-500/20 bg-[#11100d] text-[#fff7ed] hover:border-yellow-500/50 hover:bg-[#1a1612]"
            }`}
          >
            {category}
          </button>
        );
      })}
    </div>
  );
};

export default CategoryFilter;