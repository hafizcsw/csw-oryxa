import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

interface UniRow {
  id: string;
  name_en: string | null;
  name_ar: string | null;
  country_code: string | null;
  city: string | null;
}

export default function UniversitiesWithoutWebsitePdf() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");

  const generate = async () => {
    setLoading(true);
    setProgress("جاري جلب البيانات...");

    const sanitizePdfText = (value: string) =>
      value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\x20-\x7E\xA0-\xFF]/g, "-")
        .replace(/\s+/g, " ")
        .trim();

    const yieldToUI = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

    try {
      // Fetch all universities without website in batches
      const allRows: UniRow[] = [];
      let from = 0;
      const batchSize = 1000;

      while (true) {
        const { data, error } = await supabase
          .from("universities")
          .select("id, name_en, name_ar, country_code, city")
          .or("website.is.null,website.eq.")
          .order("country_code", { ascending: true, nullsFirst: false })
          .order("name_en", { ascending: true })
          .range(from, from + batchSize - 1);

        if (error) throw error;

        const batch = (data || []) as UniRow[];
        allRows.push(...batch);

        if (batch.length < batchSize) break;
        from += batchSize;
      }

      setProgress(`تم جلب ${allRows.length} جامعة — جاري توليد PDF...`);

      // Country counts for grouped headers
      const countryCounts = new Map<string, number>();
      for (const row of allRows) {
        const cc = sanitizePdfText(row.country_code || "UNKNOWN");
        countryCounts.set(cc, (countryCounts.get(cc) || 0) + 1);
      }

      // Build PDF
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const PAGE_W = 595;
      const PAGE_H = 842;
      const MARGIN = 40;
      const LINE_H = 14;
      let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      let y = PAGE_H - MARGIN;

      const drawText = (text: string, x: number, yy: number, f = font, size = 9) => {
        page.drawText(sanitizePdfText(text || "—"), {
          x,
          y: yy,
          size,
          font: f,
          color: rgb(0.1, 0.1, 0.1),
        });
      };

      const drawHeader = () => {
        drawText("#", MARGIN, y, fontBold, 8);
        drawText("Country", MARGIN + 25, y, fontBold, 8);
        drawText("City", MARGIN + 75, y, fontBold, 8);
        drawText("University Name (EN)", MARGIN + 170, y, fontBold, 8);
        y -= LINE_H;
        page.drawLine({
          start: { x: MARGIN, y: y + 4 },
          end: { x: PAGE_W - MARGIN, y: y + 4 },
          thickness: 0.5,
          color: rgb(0.5, 0.5, 0.5),
        });
        y -= 4;
      };

      // Title
      drawText("Universities Without Official Website", MARGIN, y, fontBold, 16);
      y -= 20;
      drawText(
        `Total: ${allRows.length} universities | Generated: ${new Date().toISOString().slice(0, 10)}`,
        MARGIN,
        y,
        font,
        10
      );
      y -= 30;

      drawHeader();

      let idx = 0;
      let currentCountry = "";

      for (const uni of allRows) {
        const cc = sanitizePdfText(uni.country_code || "UNKNOWN");

        if (cc !== currentCountry) {
          currentCountry = cc;

          if (y < MARGIN + 40) {
            page = pdfDoc.addPage([PAGE_W, PAGE_H]);
            y = PAGE_H - MARGIN;
            drawHeader();
          }

          y -= 4;
          drawText(`- ${cc} (${countryCounts.get(cc) || 0})`, MARGIN, y, fontBold, 9);
          y -= LINE_H + 2;
        }

        idx++;

        if (y < MARGIN + 20) {
          page = pdfDoc.addPage([PAGE_W, PAGE_H]);
          y = PAGE_H - MARGIN;
          drawHeader();
        }

        const nameEn = sanitizePdfText(uni.name_en || "—").slice(0, 55);
        const city = sanitizePdfText(uni.city || "—").slice(0, 18);

        drawText(String(idx), MARGIN, y, font, 7);
        drawText(cc, MARGIN + 25, y, font, 7);
        drawText(city, MARGIN + 75, y, font, 7);
        drawText(nameEn, MARGIN + 170, y, font, 7);
        y -= LINE_H;

        if (idx % 400 === 0) {
          setProgress(`جاري التوليد... ${idx}/${allRows.length}`);
          await yieldToUI();
        }
      }

      setProgress("جاري حفظ الملف...");
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as unknown as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `universities-without-website-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      setProgress(`تم تحميل PDF — ${allRows.length} جامعة`);
    } catch (error) {
      console.error("[UniversitiesWithoutWebsitePdf] generate error:", error);
      setProgress("حدث خطأ أثناء توليد الملف، حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="text-center space-y-6 max-w-md">
        <h1 className="text-2xl font-bold text-foreground">
          تقرير الجامعات بدون موقع إلكتروني
        </h1>
        <p className="text-muted-foreground text-sm">
          يقوم بتوليد ملف PDF يحتوي على جميع الجامعات التي لا تملك موقعاً إلكترونياً رسمياً في قاعدة البيانات
        </p>
        <Button onClick={generate} disabled={loading} size="lg" className="gap-2">
          {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Download className="h-5 w-5" />}
          {loading ? "جاري التوليد..." : "توليد وتحميل PDF"}
        </Button>
        {progress && <p className="text-sm text-muted-foreground">{progress}</p>}
      </div>
    </div>
  );
}
