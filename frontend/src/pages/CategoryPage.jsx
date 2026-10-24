import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { SlidersHorizontal, X } from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import api from "../api/client";
import WishlistButton from "../components/WishlistButton";

const formatPrice = (price) => `₹${Number(price).toLocaleString("en-IN")}`;

export default function CategoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "";
  const [sort, setSort] = useState("newest");
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brandFilter, setBrandFilter] = useState(null);
  const [priceFilter, setPriceFilter] = useState(null);
  const [categoryError, setCategoryError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api
      .get("/products", { params: { search, limit: 48 } })
      .then(({ data }) => {
        if (active) setProducts(data.products || []);
      })
      .catch((requestError) => {
        if (active)
          setError(
            requestError.response?.data?.message ||
              "Unable to load products. Check that the API is running.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [search]);

  useEffect(() => {
    api
      .get("/categories")
      .then(({ data }) => setCategories(data))
      .catch((requestError) =>
        setCategoryError(
          requestError.response?.data?.message ||
            "Category filters could not be loaded.",
        ),
      );
  }, []);

  const brands = useMemo(
    () => [...new Set(products.map((product) => product.brand).filter(Boolean))].sort(),
    [products],
  );
  const priceBounds = useMemo(() => {
    const prices = products
      .map((product) => Number(product.price))
      .filter(Number.isFinite);
    return {
      min: prices.length ? Math.floor(Math.min(...prices)) : 0,
      max: prices.length ? Math.ceil(Math.max(...prices)) : 0,
    };
  }, [products]);
  const selectedBrands =
    brandFilter?.search === search ? brandFilter.brands : [];
  const priceRange =
    priceFilter?.search === search ? priceFilter : priceBounds;

  const filteredProducts = products.filter((product) => {
    const price = Number(product.price);
    return (
      (!category || product.category === category) &&
      (!selectedBrands.length || selectedBrands.includes(product.brand)) &&
      price >= priceRange.min &&
      price <= priceRange.max
    );
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sort === "price-low") return a.price - b.price;
    if (sort === "price-high") return b.price - a.price;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  const updateCategory = (nextCategory) => {
    const next = new URLSearchParams(searchParams);
    if (nextCategory) next.set("category", nextCategory);
    else next.delete("category");
    setSearchParams(next);
  };

  const toggleBrand = (brand) => {
    setBrandFilter({
      search,
      brands: selectedBrands.includes(brand)
        ? selectedBrands.filter((item) => item !== brand)
        : [...selectedBrands, brand],
    });
  };

  const clearFilters = () => {
    setBrandFilter(null);
    setPriceFilter(null);
    updateCategory("");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
              SHOPMART COLLECTION
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {category
                ? category
                : search
                  ? `Results for "${search}"`
                  : "Shop all products"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {loading ? "Loading products..." : `${sortedProducts.length} products`}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
            Sort by
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="newest">Newest</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
            </select>
          </label>
        </div>

        {categoryError && (
          <p role="alert" className="mb-4 text-xs text-amber-700">
            {categoryError}
          </p>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold text-slate-900">
                <SlidersHorizontal className="h-4 w-4 text-blue-600" />
                Filters
              </h2>
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Clear all
              </button>
            </div>

            <fieldset className="border-t border-slate-100 py-4">
              <legend className="mb-3 pt-4 text-sm font-semibold text-slate-800">
                Category
              </legend>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600">
                  <input
                    type="radio"
                    name="category-filter"
                    checked={!category}
                    onChange={() => updateCategory("")}
                    className="accent-blue-600"
                  />
                  All categories
                </label>
                {categories.map((item) => (
                  <label
                    key={item._id}
                    className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600"
                  >
                    <input
                      type="radio"
                      name="category-filter"
                      value={item.name}
                      checked={category === item.name}
                      onChange={() => updateCategory(item.name)}
                      className="accent-blue-600"
                    />
                    {item.name}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="border-t border-slate-100 py-4">
              <legend className="mb-3 pt-4 text-sm font-semibold text-slate-800">
                Brand
              </legend>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {brands.length ? (
                  brands.map((brand) => (
                    <label
                      key={brand}
                      className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBrands.includes(brand)}
                        onChange={() => toggleBrand(brand)}
                        className="h-4 w-4 rounded accent-blue-600"
                      />
                      {brand}
                    </label>
                  ))
                ) : (
                  <p className="text-xs text-slate-400">No brands available</p>
                )}
              </div>
            </fieldset>

            <fieldset className="border-t border-slate-100 pt-4">
              <legend className="mb-3 text-sm font-semibold text-slate-800">
                Price range
              </legend>
              <div className="mb-3 flex items-center justify-between text-xs font-medium text-slate-600">
                <span>{formatPrice(priceRange.min)}</span>
                <span>{formatPrice(priceRange.max)}</span>
              </div>
              <label className="mb-3 block text-xs text-slate-500">
                Minimum price
                <input
                  type="range"
                  min={priceBounds.min}
                  max={Math.max(priceBounds.max, priceBounds.min + 1)}
                  value={priceRange.min}
                  onChange={(event) =>
                    setPriceFilter((current) => {
                      const range =
                        current?.search === search ? current : priceBounds;
                      return {
                        search,
                        min: Math.min(Number(event.target.value), range.max),
                        max: range.max,
                      };
                    })
                  }
                  className="mt-2 block w-full accent-blue-600"
                />
              </label>
              <label className="block text-xs text-slate-500">
                Maximum price
                <input
                  type="range"
                  min={priceBounds.min}
                  max={Math.max(priceBounds.max, priceBounds.min + 1)}
                  value={priceRange.max}
                  onChange={(event) =>
                    setPriceFilter((current) => {
                      const range =
                        current?.search === search ? current : priceBounds;
                      return {
                        search,
                        min: range.min,
                        max: Math.max(Number(event.target.value), range.min),
                      };
                    })
                  }
                  className="mt-2 block w-full accent-blue-600"
                />
              </label>
            </fieldset>
          </aside>

          <section>
            {error ? (
              <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
                {error}
              </p>
            ) : loading ? (
              <p className="rounded-xl border border-slate-200 bg-white py-16 text-center text-slate-500">
                Loading products...
              </p>
            ) : sortedProducts.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
                  <X className="h-5 w-5 text-slate-500" />
                </div>
                <p className="font-semibold text-slate-800">No products found</p>
                <p className="mt-1 text-sm text-slate-500">
                  Try adjusting your filters or search.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {sortedProducts.map((product) => {
                  const originalPrice = product.originalPrice || product.price;
                  const currentPrice = Number(product.dealPrice ?? product.price);
                  const discount =
                    product.activeSpecialDeal?.discountPercentage ||
                    (originalPrice > currentPrice
                      ? Math.max(1, Math.round((1 - currentPrice / originalPrice) * 100))
                      : 0);
                  return (
                    <article
                      key={product._id}
                      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      <WishlistButton
                        product={product}
                        className="absolute right-5 top-5 z-10"
                      />
                      <Link to={`/product/${product._id}`} className="block">
                        <div className="relative mb-3 overflow-hidden rounded-xl bg-slate-100">
                          <img
                            src={product.images?.[0]}
                            alt={product.title}
                            className="h-48 w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                          />
                          {discount > 0 && (
                            <span className="absolute left-2 top-2 rounded-full bg-rose-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow">
                              {product.activeSpecialDeal
                                ? `${discount}% special deal`
                                : `${discount}% off`}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          {product.brand}
                        </p>
                        <h2 className="mt-1 truncate text-sm font-semibold text-slate-900">
                          {product.title}
                        </h2>
                        <div className="mt-2 flex flex-wrap items-baseline gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            {formatPrice(currentPrice)}
                          </span>
                          {product.activeSpecialDeal ? (
                            <span className="text-xs text-slate-400 line-through">
                              {formatPrice(product.price)}
                            </span>
                          ) : originalPrice > currentPrice ? (
                            <span className="text-xs text-slate-400 line-through">
                              {formatPrice(originalPrice)}
                            </span>
                          ) : null}
                        </div>
                      </Link>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
