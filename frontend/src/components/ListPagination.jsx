import { ChevronLeft, ChevronRight } from "lucide-react";

export default function ListPagination({
  page,
  totalPages,
  total,
  label = "items",
  onPageChange,
}) {
  if (!total) return null;
  return (
    <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 text-xs text-gray-500">
      <span>
        Showing {(page - 1) * 10 + 1}–{Math.min(page * 10, total)} of {total}{" "}
        {label}
      </span>
      <div className="flex items-center gap-2">
        <span>
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label={`Previous ${label} page`}
          className="rounded-lg border p-1.5 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={!totalPages || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label={`Next ${label} page`}
          className="rounded-lg border p-1.5 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
