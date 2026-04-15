import { useNavigate, useLocation } from "react-router-dom";
import { DSButton } from "./design-system/DSButton";

type PagerProps = {
  count: number;
  limit?: number;
};

export function Pager({ count, limit = 20 }: PagerProps) {
  const { search } = useLocation();
  const navigate = useNavigate();
  
  const params = new URLSearchParams(search);
  const page = Math.max(1, parseInt(params.get("page") || "1", 10));
  const pages = Math.max(1, Math.ceil(count / limit));

  const goToPage = (newPage: number) => {
    const newParams = new URLSearchParams(search);
    newParams.set("page", String(newPage));
    newParams.set("offset", String((newPage - 1) * limit));
    navigate(`?${newParams.toString()}`, { replace: true });
  };

  if (pages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-4 mt-8">
      <DSButton
        variant="outline"
        size="sm"
        onClick={() => goToPage(Math.max(1, page - 1))}
        disabled={page <= 1}
      >
        السابق
      </DSButton>
      
      <div className="text-sm text-muted-foreground">
        صفحة <strong>{page}</strong> من <strong>{pages}</strong>
      </div>
      
      <DSButton
        variant="outline"
        size="sm"
        onClick={() => goToPage(Math.min(pages, page + 1))}
        disabled={page >= pages}
      >
        التالي
      </DSButton>
    </div>
  );
}
