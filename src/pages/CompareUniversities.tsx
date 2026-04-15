import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";

function money(v?: number | null, c = "USD") {
  if (v == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: c,
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `${c} ${Math.round(v)}`;
  }
}

export default function CompareUniversities() {
  const { search } = useLocation();
  const nav = useNavigate();
  const { t, language } = useLanguage();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const ids = (params.get("universities") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);

  useEffect(() => {
    (async () => {
      if (!ids.length) {
        setLoading(false);
        return;
      }
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-universities-details`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        }
      );
      const j = await res.json();
      setItems(j.items || []);
      setLoading(false);
    })();
  }, [search]);

  if (loading)
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8" dir="ltr">
          {t("common.loading")}
        </div>
      </Layout>
    );

  if (!ids.length)
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8" dir="ltr">
          {t("compare.noItems")}{" "}
          <a href="/universities?tab=universities" className="text-primary underline">
            {t("compare.searchLink")}
          </a>{" "}
          {t("compare.selectUp")}
        </div>
      </Layout>
    );

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8" dir="ltr">
        <button
          onClick={() => nav(-1)}
          className="mb-4 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80"
        >
          ← {t("common.back")}
        </button>
        <h1 className="text-3xl font-bold mb-6">{t("compare.title")}</h1>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-border">
            <thead>
              <tr className="bg-muted">
                <th className="border border-border p-3 text-left font-semibold">
                  {t("compare.feature")}
                </th>
                {items.map((x, i) => (
                  <th
                    key={i}
                    className="border border-border p-3 text-left font-semibold"
                  >
                    {x[`university_name_${language}`] || x.university_name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-border p-3 font-medium">
                  {t("compare.countryCity")}
                </td>
                {items.map((x, i) => (
                  <td key={i} className="border border-border p-3">
                    {x[`country_name_${language}`] || x.country_name}
                    {x.city ? `, ${x.city}` : ""}
                  </td>
                ))}
              </tr>
              <tr className="bg-muted/50">
                <td className="border border-border p-3 font-medium">
                  {t("compare.worldRanking")}
                </td>
                {items.map((x, i) => (
                  <td key={i} className="border border-border p-3">
                    {x.ranking ?? "—"}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border border-border p-3 font-medium">
                  {t("compare.programsCount")}
                </td>
                {items.map((x, i) => (
                  <td key={i} className="border border-border p-3">
                    {x.programs_count ?? 0}
                  </td>
                ))}
              </tr>
              <tr className="bg-muted/50">
                <td className="border border-border p-3 font-medium">
                  {t("compare.minIelts")}
                </td>
                {items.map((x, i) => (
                  <td key={i} className="border border-border p-3">
                    {x.min_program_ielts ?? "—"}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border border-border p-3 font-medium">
                  {t("compare.nextIntake")}
                </td>
                {items.map((x, i) => (
                  <td key={i} className="border border-border p-3">
                    {x.next_program_intake
                      ? new Date(x.next_program_intake).toLocaleDateString()
                      : "—"}
                  </td>
                ))}
              </tr>
              <tr className="bg-muted/50">
                <td className="border border-border p-3 font-medium">
                  {t("compare.feesPerYear")}
                </td>
                {items.map((x, i) => (
                  <td key={i} className="border border-border p-3">
                    {money(x.annual_fees, x.currency_code)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border border-border p-3 font-medium">
                  {t("compare.livingPerMonth")}
                </td>
                {items.map((x, i) => (
                  <td key={i} className="border border-border p-3">
                    {money(x.monthly_living, x.currency_code)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
