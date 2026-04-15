import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  { qAr: "ما هي الخدمات التي تقدمونها؟", qEn: "What services do you offer?", aAr: "نقدم خدمات شاملة تشمل القبول الجامعي، تحضير IELTS، التأشيرات والإقامة، السكن الطلابي، استقبال المطار، فتح الحساب البنكي، والمزيد.", aEn: "We offer comprehensive services including university admissions, IELTS preparation, visas and residence permits, student housing, airport pickup, bank account setup, and more." },
  { qAr: "كم تستغرق عملية القبول الجامعي؟", qEn: "How long does the university admission process take?", aAr: "تختلف المدة حسب الجامعة والبلد، لكن عادةً تتراوح بين 2 إلى 8 أسابيع من تقديم الطلب الكامل.", aEn: "The duration varies by university and country, but typically ranges from 2 to 8 weeks from submitting a complete application." },
  { qAr: "هل تساعدون في الحصول على التأشيرة؟", qEn: "Do you help with visa applications?", aAr: "نعم، نقدم مساعدة كاملة في إجراءات التأشيرة بما في ذلك تجهيز المستندات والتقديم والمتابعة.", aEn: "Yes, we provide full assistance with visa procedures including document preparation, application submission, and follow-up." },
  { qAr: "ما هي الدول المتاحة للدراسة؟", qEn: "What countries are available for study?", aAr: "نوفر فرص دراسية في أكثر من 30 دولة تشمل بريطانيا، أمريكا، كندا، أستراليا، ماليزيا، تركيا، روسيا والمزيد.", aEn: "We provide study opportunities in over 30 countries including UK, USA, Canada, Australia, Malaysia, Turkey, Russia, and more." },
  { qAr: "هل خدماتكم مجانية؟", qEn: "Are your services free?", aAr: "الاستشارة الأولية مجانية. بعض الخدمات الإضافية قد تتطلب رسوماً يتم توضيحها مسبقاً.", aEn: "The initial consultation is free. Some additional services may require fees which are clarified in advance." },
  { qAr: "كيف يمكنني التواصل معكم؟", qEn: "How can I contact you?", aAr: "يمكنك التواصل معنا عبر واتساب، البريد الإلكتروني، أو من خلال صفحة اتصل بنا على الموقع.", aEn: "You can reach us via WhatsApp, email, or through the Contact Us page on our website." },
];

export default function FAQ() {
  const { language } = useLanguage();
  const isAr = language === "ar";

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            {isAr ? "الأسئلة الشائعة" : "Frequently Asked Questions"}
          </h1>
          <p className="text-lg text-muted-foreground">
            {isAr ? "إجابات على أكثر الأسئلة شيوعاً" : "Answers to the most commonly asked questions"}
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="bg-card border border-border rounded-xl px-6 data-[state=open]:shadow-sm">
              <AccordionTrigger className="text-foreground font-medium hover:no-underline py-5">
                {isAr ? faq.qAr : faq.qEn}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
                {isAr ? faq.aAr : faq.aEn}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Layout>
  );
}
