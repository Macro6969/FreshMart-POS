import React, { useState } from "react";

const LeftComp = ({ ifos = [], onSelectCategory, onSelectItem }) => {
  const [text, setText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const filteredCategories = ifos.filter((cat) =>
    cat.name.toLowerCase().includes(text.trim().toLowerCase()),
  );

  const filteredItems = selectedCategory
    ? (selectedCategory.items || []).filter((item) =>
        `${item.name} ${item.description || ""}`
          .toLowerCase()
          .includes(text.trim().toLowerCase()),
      )
    : [];
  const handleCategoryClick = (category) => {
    setSelectedCategory(category);
    setText("");
    onSelectCategory?.(category);
  };
  const handleBack = () => {
    setSelectedCategory(null);
    setText("");
  };
  const handleItemClick = (item) => {
    onSelectItem?.({
      ...item,
      category: selectedCategory.name,
    });
  };

  return (
    <div className="w-full space-y-5 p-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            🔍
          </span>
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              selectedCategory
                ? `Search ${selectedCategory.name} products...`
                : "Search categories..."
            }
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
          {text && (
            <button
              onClick={() => setText("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      {selectedCategory ? (
        <>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700"
            >
              ← Back
            </button>

            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {selectedCategory.name}
              </h2>
              <p className="text-xs text-slate-400">
                {filteredItems.length} products found
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  disabled={Number(item.stock) <= 0}
                  className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="flex h-32 items-center justify-center overflow-hidden bg-slate-100 sm:h-36">
                    {item.image ? (
                      <img src={item.image} alt={item.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <span className="text-3xl font-semibold text-slate-300">{item.name.slice(0, 1).toUpperCase()}</span>
                    )}
                  </div>

                  <div className="p-3">
                    <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                      {item.name}
                    </h3>

                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {item.description}
                    </p>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="font-bold text-emerald-700">₹{Number(item.price).toFixed(2)}</span>
                      <span className={`rounded-lg px-2 py-1 text-xs ${Number(item.stock) > 0 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {Number(item.stock) > 0 ? "+ Add" : "Out of stock"}
                      </span>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
                <p className="font-semibold text-slate-700">No products in this category</p>
                <p className="mt-1 text-sm text-slate-500">Add products from the owner panel to start billing.</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800">Categories</h2>

            <span className="text-sm text-slate-400">
              {filteredCategories.length} categories
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {filteredCategories.length > 0 ? (
              filteredCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat)}
                  className="group flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-4 text-slate-800 shadow-sm transition hover:border-emerald-300 hover:shadow-md active:scale-[0.99]"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-xl font-bold text-emerald-700">
                    {cat.name.slice(0, 1).toUpperCase()}
                  </div>
                  <span className="mt-3 text-center text-sm font-semibold sm:text-base">{cat.name}</span>
                  <span className="mt-1 text-xs text-slate-400">{cat.items?.length || 0} products</span>
                </button>
              ))
            ) : (
              <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
                <p className="font-semibold text-slate-700">No categories yet</p>
                <p className="mt-1 text-sm text-slate-500">The shop owner can add categories and products from the owner panel.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default LeftComp;
